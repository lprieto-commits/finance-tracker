'use client'

import { useEffect, useState } from 'react'
import { formatCurrency } from '@/lib/utils'
import { Target, Plus, Trash2, Calendar, TrendingUp, CheckCircle2, Wallet, PiggyBank, CreditCard, Building2, Banknote } from 'lucide-react'

type Meta = {
  id: string
  nombre: string
  monto_objetivo: number
  monto_actual: number
  fecha_objetivo: string
  cuenta_id: string | null
}

type Cuenta = { id: string; nombre: string; tipo: string; es_deuda: boolean }
type Movimiento = { cuenta_id: string | null; tipo: string; monto: number }

const CUENTA_ICONS: Record<string, React.ElementType> = {
  ahorro: PiggyBank, corriente: Building2, tarjeta: CreditCard,
  prestamo: Banknote, efectivo: Wallet,
}

function calcularMeses(fechaObjetivo: string): number {
  const hoy = new Date()
  const fin  = new Date(fechaObjetivo)
  return Math.max(1, (fin.getFullYear() - hoy.getFullYear()) * 12 + (fin.getMonth() - hoy.getMonth()))
}

function calcularSaldoCuenta(cuenta: Cuenta, movimientos: Movimiento[], saldoInicial: number): number {
  const movs    = movimientos.filter(m => m.cuenta_id === cuenta.id)
  const ingresos = movs.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + m.monto, 0)
  const egresos  = movs.filter(m => m.tipo === 'egreso').reduce((s, m) => s + m.monto, 0)
  return cuenta.es_deuda
    ? saldoInicial + egresos - ingresos
    : saldoInicial + ingresos - egresos
}

export default function MetasPage() {
  const [metas,       setMetas]       = useState<Meta[]>([])
  const [cuentas,     setCuentas]     = useState<Cuenta[]>([])
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])
  const [cuentasSaldos, setCuentasSaldos] = useState<Record<string, number>>({})
  const [loading,     setLoading]     = useState(true)
  const [showForm,    setShowForm]    = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState('')
  const [form, setForm] = useState({
    nombre: '', monto_objetivo: '', fecha_objetivo: '', cuenta_id: '',
  })

  async function load() {
    setLoading(true)
    const [mRes, cRes, movRes] = await Promise.all([
      fetch('/api/metas').then(r => r.json()),
      fetch('/api/cuentas').then(r => r.json()),
      fetch('/api/movimientos?all=true').then(r => r.json()),
    ])

    const cuentasData: (Cuenta & { saldo_inicial: number })[] = Array.isArray(cRes) ? cRes : []
    const movsData: Movimiento[] = Array.isArray(movRes) ? movRes : (movRes.movimientos ?? [])

    // Calcular saldo real por cuenta
    const saldos: Record<string, number> = {}
    for (const c of cuentasData) {
      saldos[c.id] = calcularSaldoCuenta(c, movsData, c.saldo_inicial)
    }

    setMetas(Array.isArray(mRes) ? mRes : [])
    setCuentas(cuentasData)
    setMovimientos(movsData)
    setCuentasSaldos(saldos)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nombre.trim()) { setError('Escribe un nombre'); return }
    setSaving(true)
    setError('')
    try {
      const payload: Record<string, unknown> = {
        nombre: form.nombre,
        monto_objetivo: parseFloat(form.monto_objetivo) || 0,
        monto_actual: 0,
        fecha_objetivo: form.fecha_objetivo,
      }
      if (form.cuenta_id) payload.cuenta_id = form.cuenta_id

      const res  = await fetch('/api/metas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Error al guardar'); return }
      setForm({ nombre: '', monto_objetivo: '', fecha_objetivo: '', cuenta_id: '' })
      setShowForm(false)
      load()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar esta meta?')) return
    await fetch(`/api/metas/${id}`, { method: 'DELETE' })
    load()
  }

  const cuentasActivas = cuentas.filter((c: Cuenta) => !c.es_deuda)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Metas de ahorro</h1>
          <p className="text-slate-500 text-sm mt-0.5">Progreso calculado desde tu cuenta vinculada</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-indigo-900/50">
          <Plus className="w-4 h-4" />
          Nueva meta
        </button>
      </div>

      {/* Formulario */}
      {showForm && (
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6">
          <h2 className="font-bold text-white mb-4">Nueva meta de ahorro</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Nombre de la meta</label>
                <input type="text" value={form.nombre}
                  onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                  placeholder="Ej: Fondo de emergencia"
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-white placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Fecha objetivo</label>
                <input type="date" value={form.fecha_objetivo}
                  onChange={e => setForm(f => ({ ...f, fecha_objetivo: e.target.value }))}
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Monto objetivo ($)</label>
              <input type="number" value={form.monto_objetivo}
                onChange={e => setForm(f => ({ ...f, monto_objetivo: e.target.value }))}
                placeholder="0.00" step="0.01" min="0" required
                className="w-full px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-white placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>

            {/* Vincular a cuenta */}
            {cuentasActivas.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                  Vincular a cuenta (opcional — el progreso se calcula automático)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {cuentasActivas.map((c: Cuenta) => {
                    const Icon = CUENTA_ICONS[c.tipo] ?? Wallet
                    const sel  = form.cuenta_id === c.id
                    return (
                      <button key={c.id} type="button"
                        onClick={() => setForm(f => ({ ...f, cuenta_id: sel ? '' : c.id }))}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all text-left ${
                          sel
                            ? 'border-indigo-500 bg-indigo-500/20 text-white'
                            : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600'
                        }`}>
                        <Icon className="w-4 h-4 shrink-0" />
                        <span className="truncate">{c.nombre}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {error && <p className="text-xs text-red-400 bg-red-900/20 border border-red-800/50 rounded-lg px-3 py-2">{error}</p>}

            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={saving}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-sm transition-all disabled:opacity-50">
                {saving ? 'Guardando...' : 'Guardar meta'}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setError('') }}
                className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-sm transition-all">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lista de metas */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : metas.length === 0 ? (
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto mb-4">
            <Target className="w-8 h-8 text-slate-600" />
          </div>
          <p className="text-slate-400 font-semibold">No tienes metas de ahorro</p>
          <p className="text-slate-600 text-sm mt-1">Define objetivos y vincúlalos a tus cuentas</p>
        </div>
      ) : (
        <div className="space-y-4">
          {metas.map(meta => {
            // Si tiene cuenta vinculada, el progreso es el saldo real de esa cuenta
            const cuentaVinculada = cuentas.find((c: Cuenta) => c.id === meta.cuenta_id)
            const montoActual = meta.cuenta_id && cuentasSaldos[meta.cuenta_id] !== undefined
              ? Math.max(0, cuentasSaldos[meta.cuenta_id])
              : meta.monto_actual

            const pct      = Math.min(100, (montoActual / meta.monto_objetivo) * 100)
            const restante = Math.max(0, meta.monto_objetivo - montoActual)
            const meses    = calcularMeses(meta.fecha_objetivo)
            const mensual  = restante / meses
            const cumplida = montoActual >= meta.monto_objetivo

            return (
              <div key={meta.id} className="bg-slate-900 rounded-2xl border border-slate-800 p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${cumplida ? 'bg-emerald-500/20' : 'bg-indigo-500/20'}`}>
                      {cumplida
                        ? <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        : <Target className="w-5 h-5 text-indigo-400" />
                      }
                    </div>
                    <div>
                      <p className="font-bold text-white">{meta.nombre}</p>
                      {cuentaVinculada && (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Wallet className="w-3 h-3 text-indigo-400" />
                          <p className="text-xs text-indigo-400">{cuentaVinculada.nombre}</p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(meta.fecha_objetivo).toLocaleDateString('es', { year: 'numeric', month: 'long' })}
                    </div>
                    <button onClick={() => handleDelete(meta.id)}
                      className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-slate-800 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Barra de progreso */}
                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-slate-400 font-semibold">{formatCurrency(montoActual)}</span>
                    <span className="text-slate-500">de {formatCurrency(meta.monto_objetivo)}</span>
                  </div>
                  <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${cumplida ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-1.5">
                    <span className={`text-xs font-semibold ${cumplida ? 'text-emerald-400' : 'text-indigo-400'}`}>
                      {pct.toFixed(0)}% completado
                    </span>
                    {!cumplida && <span className="text-xs text-slate-500">Faltan {formatCurrency(restante)}</span>}
                  </div>
                </div>

                {/* Proyección */}
                {!cumplida && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="bg-slate-800/60 rounded-xl p-3">
                      <div className="flex items-center gap-1.5 mb-1">
                        <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
                        <span className="text-xs text-slate-400">Ahorro mensual necesario</span>
                      </div>
                      <p className="font-bold text-white text-lg">{formatCurrency(mensual)}</p>
                      <p className="text-xs text-slate-500">por {meses} {meses === 1 ? 'mes' : 'meses'}</p>
                    </div>
                    <div className="bg-slate-800/60 rounded-xl p-3">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-xs text-slate-400">Tiempo restante</span>
                      </div>
                      <p className="font-bold text-white text-lg">{meses}</p>
                      <p className="text-xs text-slate-500">{meses === 1 ? 'mes' : 'meses'}</p>
                    </div>
                  </div>
                )}

                {/* Nota si no tiene cuenta vinculada */}
                {!cuentaVinculada && (
                  <p className="text-xs text-slate-600 mt-3">
                    💡 Vincula esta meta a una cuenta para que el progreso se actualice automáticamente
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

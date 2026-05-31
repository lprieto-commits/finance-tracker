'use client'

import { useEffect, useState } from 'react'
import { formatCurrency } from '@/lib/utils'
import {
  Target, Plus, Trash2, Calendar, TrendingUp, TrendingDown,
  CheckCircle2, Wallet, PiggyBank, CreditCard, Building2,
  Banknote, AlertTriangle, XCircle, ArrowUpRight, ArrowDownRight, Zap, Link, X,
} from 'lucide-react'

type Meta = {
  id: string
  nombre: string
  monto_objetivo: number
  monto_actual: number
  fecha_objetivo: string
  cuenta_id: string | null
}

type Cuenta = { id: string; nombre: string; tipo: string; es_deuda: boolean; saldo_inicial: number }
type Movimiento = { cuenta_id: string | null; tipo: string; monto: number; fecha: string; origen?: string }

const CUENTA_ICONS: Record<string, React.ElementType> = {
  ahorro: PiggyBank, corriente: Building2, tarjeta: CreditCard,
  prestamo: Banknote, efectivo: Wallet,
}

function calcularMeses(fechaObjetivo: string): number {
  const hoy = new Date()
  const fin  = new Date(fechaObjetivo)
  return Math.max(1, (fin.getFullYear() - hoy.getFullYear()) * 12 + (fin.getMonth() - hoy.getMonth()))
}

function calcularSaldoCuenta(cuenta: Cuenta, movimientos: Movimiento[]): number {
  const movs    = movimientos.filter(m => m.cuenta_id === cuenta.id && m.origen !== 'transferencia')
  const ingresos = movs.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + m.monto, 0)
  const egresos  = movs.filter(m => m.tipo === 'egreso').reduce((s, m) => s + m.monto, 0)
  return cuenta.es_deuda
    ? cuenta.saldo_inicial + egresos - ingresos
    : cuenta.saldo_inicial + ingresos - egresos
}

// Calcula el promedio de ahorro neto mensual de los últimos N meses para una cuenta
function calcularRitmoMensual(cuentaId: string, movimientos: Movimiento[], mesesAtras = 3): number {
  const hoy   = new Date()
  const movs  = movimientos.filter(m => m.cuenta_id === cuentaId && m.origen !== 'transferencia')
  let totalNeto = 0
  let mesesConData = 0

  for (let i = 0; i < mesesAtras; i++) {
    const mes = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1)
    const mesStr = `${mes.getFullYear()}-${String(mes.getMonth() + 1).padStart(2, '0')}`
    const delMes = movs.filter(m => m.fecha.startsWith(mesStr))
    if (delMes.length > 0) {
      const ing = delMes.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + m.monto, 0)
      const egr = delMes.filter(m => m.tipo === 'egreso').reduce((s, m) => s + m.monto, 0)
      totalNeto += ing - egr
      mesesConData++
    }
  }

  return mesesConData > 0 ? totalNeto / mesesConData : 0
}

// Datos del mes actual para una cuenta
function datosMesActual(cuentaId: string, movimientos: Movimiento[]) {
  const hoy    = new Date()
  const mesStr = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`
  const movs   = movimientos.filter(m => m.cuenta_id === cuentaId && m.fecha.startsWith(mesStr) && m.origen !== 'transferencia')
  const ingresos = movs.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + m.monto, 0)
  const egresos  = movs.filter(m => m.tipo === 'egreso').reduce((s, m) => s + m.monto, 0)
  return { ingresos, egresos, neto: ingresos - egresos }
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date)
  d.setMonth(d.getMonth() + Math.ceil(months))
  return d
}

export default function MetasPage() {
  const [metas,         setMetas]         = useState<Meta[]>([])
  const [cuentas,       setCuentas]       = useState<Cuenta[]>([])
  const [movimientos,   setMovimientos]   = useState<Movimiento[]>([])
  const [cuentasSaldos, setCuentasSaldos] = useState<Record<string, number>>({})
  const [loading,       setLoading]       = useState(true)
  const [showForm,      setShowForm]      = useState(false)
  const [saving,        setSaving]        = useState(false)
  const [error,         setError]         = useState('')
  const [vinculando,    setVinculando]    = useState<string | null>(null)
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

    const cuentasData: Cuenta[] = Array.isArray(cRes) ? cRes : []
    const movsData: Movimiento[] = Array.isArray(movRes) ? movRes : (movRes.movimientos ?? [])

    const saldos: Record<string, number> = {}
    for (const c of cuentasData) {
      saldos[c.id] = calcularSaldoCuenta(c, movsData)
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

  async function handleVincular(metaId: string, cuentaId: string | null) {
    await fetch(`/api/metas/${metaId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cuenta_id: cuentaId }),
    })
    setVinculando(null)
    load()
  }

  const cuentasActivas = cuentas.filter(c => !c.es_deuda)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Metas de ahorro</h1>
          <p className="text-slate-500 text-sm mt-0.5">Proyecciones y análisis en tiempo real</p>
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
            {cuentasActivas.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                  Vincular a cuenta (opcional)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {cuentasActivas.map(c => {
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
            const cuentaVinculada = cuentas.find(c => c.id === meta.cuenta_id)
            const montoActual = meta.cuenta_id && cuentasSaldos[meta.cuenta_id] !== undefined
              ? Math.max(0, cuentasSaldos[meta.cuenta_id])
              : meta.monto_actual

            const pct      = Math.min(100, (montoActual / meta.monto_objetivo) * 100)
            const restante = Math.max(0, meta.monto_objetivo - montoActual)
            const meses    = calcularMeses(meta.fecha_objetivo)
            const mensualNecesario = restante / meses
            const cumplida = montoActual >= meta.monto_objetivo

            // Análisis de ritmo y proyección (solo si tiene cuenta vinculada)
            const ritmoActual = meta.cuenta_id
              ? calcularRitmoMensual(meta.cuenta_id, movimientos)
              : null
            const mesActual = meta.cuenta_id
              ? datosMesActual(meta.cuenta_id, movimientos)
              : null

            // Proyección real
            const mesesProyectados = ritmoActual && ritmoActual > 0
              ? restante / ritmoActual
              : null
            const fechaProyectada = mesesProyectados !== null
              ? addMonths(new Date(), mesesProyectados)
              : null
            const fechaObjetivo = new Date(meta.fecha_objetivo)
            const adelantado = fechaProyectada !== null && fechaProyectada <= fechaObjetivo

            // Estado
            let estado: 'cumplida' | 'en_camino' | 'en_riesgo' | 'atrasado' | 'sin_datos'
            if (cumplida) estado = 'cumplida'
            else if (ritmoActual === null) estado = 'sin_datos'
            else if (ritmoActual <= 0) estado = 'atrasado'
            else if (ritmoActual >= mensualNecesario * 0.9) estado = 'en_camino'
            else if (ritmoActual >= mensualNecesario * 0.5) estado = 'en_riesgo'
            else estado = 'atrasado'

            const estadoConfig = {
              cumplida:   { label: '✅ Cumplida',   bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-800/50' },
              en_camino:  { label: '🟢 En camino',  bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-800/30' },
              en_riesgo:  { label: '🟡 En riesgo',  bg: 'bg-amber-500/10',   text: 'text-amber-400',   border: 'border-amber-800/30'   },
              atrasado:   { label: '🔴 Atrasado',   bg: 'bg-red-500/10',     text: 'text-red-400',     border: 'border-red-800/30'     },
              sin_datos:  { label: '⚪ Sin datos',  bg: 'bg-slate-800',      text: 'text-slate-400',   border: 'border-slate-700'      },
            }[estado]

            return (
              <div key={meta.id} className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
                {/* Header de la tarjeta */}
                <div className="p-6 pb-4">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${cumplida ? 'bg-emerald-500/20' : 'bg-indigo-500/20'}`}>
                        {cumplida
                          ? <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                          : <Target className="w-5 h-5 text-indigo-400" />
                        }
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-white">{meta.nombre}</p>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${estadoConfig.bg} ${estadoConfig.text} ${estadoConfig.border}`}>
                            {estadoConfig.label}
                          </span>
                        </div>
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
                        {new Date(meta.fecha_objetivo + 'T12:00:00').toLocaleDateString('es', { year: 'numeric', month: 'short' })}
                      </div>
                      <button onClick={() => handleDelete(meta.id)}
                        className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-slate-800 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Barra de progreso */}
                  <div className="mb-2">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-white font-bold">{formatCurrency(montoActual)}</span>
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
                        {pct.toFixed(1)}% completado
                      </span>
                      {!cumplida && <span className="text-xs text-slate-500">Faltan {formatCurrency(restante)}</span>}
                    </div>
                  </div>
                </div>

                {/* Panel de análisis (solo si no está cumplida y tiene cuenta) */}
                {!cumplida && cuentaVinculada && (
                  <div className="border-t border-slate-800 bg-slate-950/50 p-4 space-y-3">

                    {/* Ritmo actual vs necesario */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-800/60 rounded-xl p-3">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Zap className="w-3.5 h-3.5 text-indigo-400" />
                          <span className="text-xs text-slate-400">Ritmo actual</span>
                        </div>
                        <p className={`font-bold text-lg ${ritmoActual !== null && ritmoActual > 0 ? 'text-white' : 'text-slate-500'}`}>
                          {ritmoActual !== null ? formatCurrency(Math.max(0, ritmoActual)) : '—'}
                        </p>
                        <p className="text-xs text-slate-500">promedio/mes (3m)</p>
                      </div>
                      <div className="bg-slate-800/60 rounded-xl p-3">
                        <div className="flex items-center gap-1.5 mb-1">
                          <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                          <span className="text-xs text-slate-400">Necesitas ahorrar</span>
                        </div>
                        <p className="font-bold text-white text-lg">{formatCurrency(mensualNecesario)}</p>
                        <p className="text-xs text-slate-500">por mes para llegar</p>
                      </div>
                    </div>

                    {/* Proyección real */}
                    {fechaProyectada && (
                      <div className={`rounded-xl p-3 border flex items-center gap-3 ${
                        adelantado
                          ? 'bg-emerald-500/10 border-emerald-800/30'
                          : 'bg-amber-500/10 border-amber-800/30'
                      }`}>
                        {adelantado
                          ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          : <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                        }
                        <div>
                          <p className={`text-xs font-semibold ${adelantado ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {adelantado ? 'Vas adelantado 🎉' : 'Vas a llegar tarde ⚠️'}
                          </p>
                          <p className="text-xs text-slate-400">
                            A tu ritmo actual, lo lograrías en{' '}
                            <span className="text-white font-semibold">
                              {fechaProyectada.toLocaleDateString('es', { month: 'long', year: 'numeric' })}
                            </span>
                            {' '}({adelantado
                              ? `${Math.round(meses - (mesesProyectados ?? 0))} mes(es) antes`
                              : `${Math.round((mesesProyectados ?? 0) - meses)} mes(es) después`}
                            )
                          </p>
                        </div>
                      </div>
                    )}

                    {ritmoActual !== null && ritmoActual <= 0 && (
                      <div className="rounded-xl p-3 border bg-red-500/10 border-red-800/30 flex items-center gap-3">
                        <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                        <p className="text-xs text-red-400 font-semibold">
                          Estás gastando más de lo que ingresa — la meta no avanza a este ritmo
                        </p>
                      </div>
                    )}

                    {/* Cambiar cuenta vinculada */}
                    {vinculando === meta.id ? (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-slate-300">Selecciona otra cuenta:</p>
                        <div className="grid grid-cols-2 gap-2">
                          {cuentasActivas.map(c => {
                            const Icon = CUENTA_ICONS[c.tipo] ?? Wallet
                            return (
                              <button key={c.id} onClick={() => handleVincular(meta.id, c.id)}
                                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all text-left ${
                                  meta.cuenta_id === c.id
                                    ? 'border-indigo-500 bg-indigo-500/20 text-white'
                                    : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-indigo-500 hover:bg-indigo-500/10 hover:text-white'
                                }`}>
                                <Icon className="w-4 h-4 shrink-0" />
                                <span className="truncate">{c.nombre}</span>
                              </button>
                            )
                          })}
                        </div>
                        <div className="flex gap-3">
                          <button onClick={() => handleVincular(meta.id, null)}
                            className="text-xs text-red-400 hover:text-red-300 transition-colors">
                            Desvincular cuenta
                          </button>
                          <button onClick={() => setVinculando(null)}
                            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors">
                            <X className="w-3 h-3" /> Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setVinculando(meta.id)}
                        className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-indigo-400 transition-colors">
                        <Link className="w-3 h-3" />
                        Cambiar cuenta vinculada
                      </button>
                    )}

                    {/* Mes actual */}
                    {mesActual && (
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Este mes en esta cuenta</p>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="bg-emerald-500/10 rounded-xl p-2.5 text-center">
                            <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400 mx-auto mb-1" />
                            <p className="text-xs text-slate-400">Ingresos</p>
                            <p className="text-sm font-bold text-emerald-400">{formatCurrency(mesActual.ingresos)}</p>
                          </div>
                          <div className="bg-red-500/10 rounded-xl p-2.5 text-center">
                            <ArrowDownRight className="w-3.5 h-3.5 text-red-400 mx-auto mb-1" />
                            <p className="text-xs text-slate-400">Egresos</p>
                            <p className="text-sm font-bold text-red-400">{formatCurrency(mesActual.egresos)}</p>
                          </div>
                          <div className={`rounded-xl p-2.5 text-center ${mesActual.neto >= 0 ? 'bg-indigo-500/10' : 'bg-red-500/10'}`}>
                            <TrendingUp className={`w-3.5 h-3.5 mx-auto mb-1 ${mesActual.neto >= 0 ? 'text-indigo-400' : 'text-red-400'}`} />
                            <p className="text-xs text-slate-400">Neto</p>
                            <p className={`text-sm font-bold ${mesActual.neto >= 0 ? 'text-indigo-400' : 'text-red-400'}`}>
                              {mesActual.neto >= 0 ? '+' : ''}{formatCurrency(mesActual.neto)}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Sin cuenta vinculada */}
                {!cumplida && !cuentaVinculada && (
                  <div className="border-t border-slate-800 px-6 py-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-800/60 rounded-xl p-3">
                        <div className="flex items-center gap-1.5 mb-1">
                          <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
                          <span className="text-xs text-slate-400">Ahorro mensual necesario</span>
                        </div>
                        <p className="font-bold text-white text-lg">{formatCurrency(mensualNecesario)}</p>
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

                    {/* Selector de cuenta */}
                    {vinculando === meta.id ? (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-slate-300">Selecciona la cuenta a vincular:</p>
                        <div className="grid grid-cols-2 gap-2">
                          {cuentasActivas.map(c => {
                            const Icon = CUENTA_ICONS[c.tipo] ?? Wallet
                            return (
                              <button key={c.id} onClick={() => handleVincular(meta.id, c.id)}
                                className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 hover:border-indigo-500 hover:bg-indigo-500/10 hover:text-white text-sm font-medium transition-all text-left">
                                <Icon className="w-4 h-4 shrink-0" />
                                <span className="truncate">{c.nombre}</span>
                              </button>
                            )
                          })}
                        </div>
                        <button onClick={() => setVinculando(null)}
                          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors">
                          <X className="w-3 h-3" /> Cancelar
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setVinculando(meta.id)}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl border border-indigo-800/50 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 text-xs font-semibold transition-all w-full justify-center">
                        <Link className="w-3.5 h-3.5" />
                        Vincular a una cuenta
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

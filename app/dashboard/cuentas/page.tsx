'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { formatCurrency } from '@/lib/utils'
import { Wallet, CreditCard, Building2, Banknote, PiggyBank, Plus, Trash2, TrendingUp, TrendingDown, ArrowRight } from 'lucide-react'
import TransferenciaModal from '../TransferenciaModal'

type Cuenta = {
  id: string
  nombre: string
  tipo: 'ahorro' | 'corriente' | 'tarjeta' | 'prestamo' | 'efectivo'
  es_deuda: boolean
  saldo_inicial: number
  limite_credito: number | null
  scope: 'personal' | 'negocio'
  saldo_real?: number
}

const TIPO_ICONS: Record<string, React.ElementType> = {
  ahorro:   PiggyBank,
  corriente: Building2,
  tarjeta:  CreditCard,
  prestamo: Banknote,
  efectivo: Wallet,
}

const TIPO_LABELS: Record<string, string> = {
  ahorro:    'Cuenta de ahorro',
  corriente: 'Cuenta corriente',
  tarjeta:   'Tarjeta de crédito',
  prestamo:  'Préstamo',
  efectivo:  'Efectivo',
}

export default function CuentasPage() {
  const searchParams = useSearchParams()
  const router       = useRouter()
  const scope        = (searchParams.get('scope') === 'negocio' ? 'negocio' : 'personal') as 'personal' | 'negocio'

  const [cuentas,      setCuentas]      = useState<Cuenta[]>([])
  const [loading,      setLoading]      = useState(true)
  const [showForm,     setShowForm]     = useState(false)
  const [showTransfer, setShowTransfer] = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [form, setForm]         = useState({
    nombre: '', tipo: 'ahorro', es_deuda: false,
    saldo_inicial: '', limite_credito: '',
  })

  async function load() {
    setLoading(true)
    const [cRes, mRes] = await Promise.all([
      fetch(`/api/cuentas?scope=${scope}`).then(r => r.json()),
      fetch(`/api/movimientos?all=true&scope=${scope}`).then(r => r.json()),
    ])

    const cuentasBase: Cuenta[] = Array.isArray(cRes) ? cRes : []
    const movimientos: { cuenta_id: string; tipo: string; monto: number }[] = Array.isArray(mRes) ? mRes : (mRes.movimientos ?? [])

    // Calcular saldo real por cuenta
    const cuentasConSaldo = cuentasBase.map(c => {
      const movsCuenta = movimientos.filter(m => m.cuenta_id === c.id)
      const ingresos = movsCuenta.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + m.monto, 0)
      const egresos  = movsCuenta.filter(m => m.tipo === 'egreso').reduce((s, m) => s + m.monto, 0)

      let saldo_real: number
      if (c.es_deuda) {
        // Para deudas: saldo inicial + egresos (gastos en tarjeta aumentan deuda) - ingresos (pagos reducen deuda)
        saldo_real = c.saldo_inicial + egresos - ingresos
      } else {
        // Para activos: saldo inicial + ingresos - egresos
        saldo_real = c.saldo_inicial + ingresos - egresos
      }
      return { ...c, saldo_real }
    })

    setCuentas(cuentasConSaldo)
    setLoading(false)
  }

  useEffect(() => { load() }, [scope])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await fetch('/api/cuentas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: form.nombre,
        tipo: form.tipo,
        scope,
        es_deuda: form.tipo === 'tarjeta' || form.tipo === 'prestamo',
        saldo_inicial: parseFloat(form.saldo_inicial) || 0,
        limite_credito: form.limite_credito ? parseFloat(form.limite_credito) : null,
      }),
    })
    setForm({ nombre: '', tipo: 'ahorro', es_deuda: false, saldo_inicial: '', limite_credito: '' })
    setShowForm(false)
    setSaving(false)
    load()
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar esta cuenta?')) return
    await fetch(`/api/cuentas/${id}`, { method: 'DELETE' })
    load()
  }

  const activos  = cuentas.filter(c => !c.es_deuda).reduce((s, c) => s + (c.saldo_real ?? c.saldo_inicial), 0)
  const pasivos  = cuentas.filter(c => c.es_deuda).reduce((s, c) => s + (c.saldo_real ?? c.saldo_inicial), 0)
  const patrimon = activos - pasivos

  return (
    <>
    {showTransfer && (
      <TransferenciaModal
        onClose={() => setShowTransfer(false)}
        onSaved={() => { setShowTransfer(false); load() }}
      />
    )}
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Cuentas</h1>
          <p className="text-slate-500 text-sm mt-0.5">Saldos calculados en base a tus movimientos</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowTransfer(true)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-semibold rounded-xl transition-all">
            <ArrowRight className="w-4 h-4" />
            Transferir
          </button>
          <button onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-indigo-900/50">
            <Plus className="w-4 h-4" />
            Nueva cuenta
          </button>
        </div>
      </div>

      {/* Scope toggle */}
      <div className="flex gap-1 bg-slate-800 p-1 rounded-xl w-fit">
        {(['personal', 'negocio'] as const).map(s => (
          <button key={s} onClick={() => router.push(`/dashboard/cuentas?scope=${s}`)}
            className={`px-5 py-1.5 rounded-lg text-sm font-semibold transition-all capitalize ${
              scope === s ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}>
            {s === 'personal' ? 'Personal' : 'Negocio'}
          </button>
        ))}
      </div>

      {/* Net worth cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-emerald-900/80 to-emerald-950 rounded-2xl border border-emerald-800/50 p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wide">Activos</span>
          </div>
          <p className="text-2xl font-bold text-white">{formatCurrency(activos)}</p>
          <p className="text-xs text-emerald-600 mt-1">{cuentas.filter(c => !c.es_deuda).length} cuentas</p>
        </div>

        <div className="bg-gradient-to-br from-red-900/80 to-red-950 rounded-2xl border border-red-800/50 p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl bg-red-500/20 flex items-center justify-center">
              <TrendingDown className="w-4 h-4 text-red-400" />
            </div>
            <span className="text-xs font-semibold text-red-400 uppercase tracking-wide">Deudas</span>
          </div>
          <p className="text-2xl font-bold text-white">{formatCurrency(pasivos)}</p>
          <p className="text-xs text-red-600 mt-1">{cuentas.filter(c => c.es_deuda).length} cuentas</p>
        </div>

        <div className={`rounded-2xl border p-5 ${patrimon >= 0 ? 'bg-gradient-to-br from-indigo-900/80 to-indigo-950 border-indigo-800/50' : 'bg-gradient-to-br from-orange-900/80 to-orange-950 border-orange-800/50'}`}>
          <div className="flex items-center gap-2 mb-3">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${patrimon >= 0 ? 'bg-indigo-500/20' : 'bg-orange-500/20'}`}>
              <Wallet className={`w-4 h-4 ${patrimon >= 0 ? 'text-indigo-400' : 'text-orange-400'}`} />
            </div>
            <span className={`text-xs font-semibold uppercase tracking-wide ${patrimon >= 0 ? 'text-indigo-400' : 'text-orange-400'}`}>Patrimonio neto</span>
          </div>
          <p className={`text-2xl font-bold ${patrimon >= 0 ? 'text-white' : 'text-orange-200'}`}>
            {patrimon >= 0 ? '+' : ''}{formatCurrency(patrimon)}
          </p>
          <p className={`text-xs mt-1 ${patrimon >= 0 ? 'text-indigo-600' : 'text-orange-600'}`}>
            {patrimon >= 0 ? 'Saldo positivo' : 'Más deudas que activos'}
          </p>
        </div>
      </div>

      {/* New account form */}
      {showForm && (
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6">
          <h2 className="font-bold text-white mb-4">Nueva cuenta</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Nombre</label>
                <input type="text" value={form.nombre}
                  onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                  placeholder="Ej: Banco General Ahorro"
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-white placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Tipo</label>
                <select value={form.tipo}
                  onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  {Object.entries(TIPO_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
                  {form.tipo === 'tarjeta' || form.tipo === 'prestamo' ? 'Deuda actual' : 'Saldo actual'}
                </label>
                <input type="number" value={form.saldo_inicial}
                  onChange={e => setForm(f => ({ ...f, saldo_inicial: e.target.value }))}
                  placeholder="0.00" step="0.01" min="0"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-white placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              {form.tipo === 'tarjeta' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Límite de crédito</label>
                  <input type="number" value={form.limite_credito}
                    onChange={e => setForm(f => ({ ...f, limite_credito: e.target.value }))}
                    placeholder="0.00" step="0.01" min="0"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-white placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              )}
            </div>
            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={saving}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-sm transition-all disabled:opacity-50">
                {saving ? 'Guardando...' : 'Guardar cuenta'}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-sm transition-all">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Accounts list */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : cuentas.length === 0 ? (
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto mb-4">
            <Wallet className="w-8 h-8 text-slate-600" />
          </div>
          <p className="text-slate-400 font-semibold">No tienes cuentas registradas</p>
          <p className="text-slate-600 text-sm mt-1">Agrega tu cuenta de ahorro, tarjeta de crédito y préstamos</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Activos */}
          {cuentas.filter(c => !c.es_deuda).length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Activos</h2>
              <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
                {cuentas.filter(c => !c.es_deuda).map((c, i, arr) => {
                  const Icon = TIPO_ICONS[c.tipo] ?? Wallet
                  const saldo = c.saldo_real ?? c.saldo_inicial
                  return (
                    <div key={c.id} className={`flex items-center justify-between px-6 py-4 hover:bg-slate-800/50 transition-colors ${i < arr.length - 1 ? 'border-b border-slate-800/50' : ''}`}>
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center">
                          <Icon className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div>
                          <p className="font-semibold text-white">{c.nombre}</p>
                          <p className="text-xs text-slate-500">{TIPO_LABELS[c.tipo]}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-bold text-emerald-400 text-lg tabular-nums">{formatCurrency(saldo)}</p>
                          {c.saldo_real !== c.saldo_inicial && (
                            <p className="text-xs text-slate-500">Inicial: {formatCurrency(c.saldo_inicial)}</p>
                          )}
                        </div>
                        <button onClick={() => handleDelete(c.id)}
                          className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-slate-800 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Deudas */}
          {cuentas.filter(c => c.es_deuda).length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Deudas</h2>
              <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
                {cuentas.filter(c => c.es_deuda).map((c, i, arr) => {
                  const Icon = TIPO_ICONS[c.tipo] ?? Wallet
                  const saldo = c.saldo_real ?? c.saldo_inicial
                  const pctUsado = c.limite_credito ? Math.min(100, (saldo / c.limite_credito) * 100) : null
                  return (
                    <div key={c.id} className={`flex items-center justify-between px-6 py-4 hover:bg-slate-800/50 transition-colors ${i < arr.length - 1 ? 'border-b border-slate-800/50' : ''}`}>
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center">
                          <Icon className="w-5 h-5 text-red-400" />
                        </div>
                        <div>
                          <p className="font-semibold text-white">{c.nombre}</p>
                          <div className="flex items-center gap-2">
                            <p className="text-xs text-slate-500">{TIPO_LABELS[c.tipo]}</p>
                            {c.limite_credito && (
                              <>
                                <span className="text-slate-700">·</span>
                                <p className="text-xs text-slate-500">Límite: {formatCurrency(c.limite_credito)}</p>
                              </>
                            )}
                          </div>
                          {pctUsado !== null && (
                            <div className="mt-1.5 w-32 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${pctUsado > 80 ? 'bg-red-500' : pctUsado > 50 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                style={{ width: `${pctUsado}%` }} />
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-bold text-red-400 text-lg tabular-nums">{formatCurrency(saldo)}</p>
                          {pctUsado !== null && (
                            <p className="text-xs text-slate-500">{pctUsado.toFixed(0)}% usado</p>
                          )}
                        </div>
                        <button onClick={() => handleDelete(c.id)}
                          className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-slate-800 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
    </>
  )
}

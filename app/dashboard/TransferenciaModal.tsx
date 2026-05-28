'use client'

import { useState, useEffect } from 'react'
import { X, ArrowRight, Wallet, CreditCard, Building2, Banknote, PiggyBank } from 'lucide-react'

type Cuenta = { id: string; nombre: string; tipo: string; es_deuda: boolean }

const CUENTA_ICONS: Record<string, React.ElementType> = {
  ahorro:    PiggyBank,
  corriente: Building2,
  tarjeta:   CreditCard,
  prestamo:  Banknote,
  efectivo:  Wallet,
}

interface Props {
  onClose:  () => void
  onSaved:  () => void
}

export default function TransferenciaModal({ onClose, onSaved }: Props) {
  const [cuentas,  setCuentas]  = useState<Cuenta[]>([])
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [form, setForm] = useState({
    cuenta_origen:  '',
    cuenta_destino: '',
    monto:          '',
    fecha:          new Date().toISOString().slice(0, 10),
    descripcion:    'Transferencia',
  })

  useEffect(() => {
    fetch('/api/cuentas').then(r => r.json()).then(d => setCuentas(Array.isArray(d) ? d : []))
  }, [])

  const cuentaOrigen  = cuentas.find(c => c.id === form.cuenta_origen)
  const cuentaDestino = cuentas.find(c => c.id === form.cuenta_destino)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!form.cuenta_origen)  { setError('Selecciona la cuenta de origen'); return }
    if (!form.cuenta_destino) { setError('Selecciona la cuenta de destino'); return }
    if (form.cuenta_origen === form.cuenta_destino) { setError('Las cuentas deben ser diferentes'); return }
    const montoNum = parseFloat(form.monto)
    if (isNaN(montoNum) || montoNum <= 0) { setError('Monto inválido'); return }

    setLoading(true)
    try {
      const base = {
        fecha:       form.fecha,
        scope:       'personal',
        monto:       montoNum,
        origen:      'manual',
      }

      // Egreso de cuenta origen
      const r1 = await fetch('/api/movimientos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...base,
          tipo:        'egreso',
          cuenta_id:   form.cuenta_origen,
          descripcion: `${form.descripcion} → ${cuentaDestino?.nombre}`,
        }),
      })
      if (!r1.ok) { const d = await r1.json(); setError(d.error ?? 'Error'); return }

      // Ingreso a cuenta destino
      const r2 = await fetch('/api/movimientos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...base,
          tipo:        'ingreso',
          cuenta_id:   form.cuenta_destino,
          descripcion: `${form.descripcion} ← ${cuentaOrigen?.nombre}`,
        }),
      })
      if (!r2.ok) { const d = await r2.json(); setError(d.error ?? 'Error'); return }

      onSaved()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}>
      <div className="bg-slate-900 rounded-2xl shadow-2xl border border-slate-700 w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-500/20 flex items-center justify-center">
              <ArrowRight className="w-4 h-4 text-indigo-400" />
            </div>
            <h2 className="font-bold text-white">Transferencia entre cuentas</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-700 transition-colors">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">

          {/* Cuenta origen */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
              De (cuenta origen)
            </label>
            <div className="grid grid-cols-2 gap-2">
              {cuentas.map(c => {
                const Icon = CUENTA_ICONS[c.tipo] ?? Wallet
                const sel  = form.cuenta_origen === c.id
                return (
                  <button key={c.id} type="button"
                    onClick={() => setForm(f => ({ ...f, cuenta_origen: sel ? '' : c.id }))}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all text-left ${
                      sel
                        ? 'border-red-500 bg-red-500/20 text-white'
                        : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600'
                    }`}>
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{c.nombre}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Flecha visual */}
          {cuentaOrigen && cuentaDestino && (
            <div className="flex items-center justify-center gap-3 py-1">
              <span className="text-sm text-slate-400 truncate max-w-28">{cuentaOrigen.nombre}</span>
              <div className="flex items-center gap-1 text-indigo-400">
                <div className="h-px w-8 bg-indigo-500" />
                <ArrowRight className="w-4 h-4" />
              </div>
              <span className="text-sm text-slate-400 truncate max-w-28">{cuentaDestino.nombre}</span>
            </div>
          )}

          {/* Cuenta destino */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
              A (cuenta destino)
            </label>
            <div className="grid grid-cols-2 gap-2">
              {cuentas.filter(c => c.id !== form.cuenta_origen).map(c => {
                const Icon = CUENTA_ICONS[c.tipo] ?? Wallet
                const sel  = form.cuenta_destino === c.id
                return (
                  <button key={c.id} type="button"
                    onClick={() => setForm(f => ({ ...f, cuenta_destino: sel ? '' : c.id }))}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all text-left ${
                      sel
                        ? 'border-emerald-500 bg-emerald-500/20 text-white'
                        : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600'
                    }`}>
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{c.nombre}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Monto y Fecha */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Monto ($)</label>
              <input type="number" step="0.01" min="0.01"
                value={form.monto}
                onChange={e => setForm(f => ({ ...f, monto: e.target.value }))}
                placeholder="0.00"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-white placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Fecha</label>
              <input type="date"
                value={form.fecha}
                onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Descripción</label>
            <input type="text"
              value={form.descripcion}
              onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
              placeholder="Transferencia"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-white placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-900/20 border border-red-800/50 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-slate-600 text-sm font-semibold text-slate-300 hover:bg-slate-700 transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {loading ? 'Transfiriendo...' : <><ArrowRight className="w-4 h-4" /> Transferir</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

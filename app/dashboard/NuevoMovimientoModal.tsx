'use client'

import { useEffect, useState } from 'react'
import { X, Wallet, CreditCard, Building2, Banknote, PiggyBank } from 'lucide-react'

interface Categoria { id: string; nombre: string; tipo: 'ingreso' | 'egreso' }
interface Cuenta    { id: string; nombre: string; tipo: string; es_deuda: boolean }

interface Props {
  scope:    'personal' | 'negocio'
  onClose:  () => void
  onSaved:  () => void
  defaultTipo?: 'ingreso' | 'egreso'
}

const CUENTA_ICONS: Record<string, React.ElementType> = {
  ahorro:   PiggyBank,
  corriente: Building2,
  tarjeta:  CreditCard,
  prestamo: Banknote,
  efectivo: Wallet,
}

export default function NuevoMovimientoModal({ scope, onClose, onSaved, defaultTipo = 'egreso' }: Props) {
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [cuentas,    setCuentas]    = useState<Cuenta[]>([])
  const [tipo,       setTipo]       = useState<'ingreso' | 'egreso'>(defaultTipo)
  const [form, setForm] = useState({
    descripcion: '', monto: '',
    fecha: new Date().toISOString().slice(0, 10),
    categoria_id: '', notas: '', cuenta_id: '',
  })
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  useEffect(() => {
    fetch(`/api/categorias?scope=${scope}`)
      .then(r => r.json())
      .then(d => setCategorias(d.categorias ?? []))
    fetch('/api/cuentas')
      .then(r => r.json())
      .then(d => setCuentas(Array.isArray(d) ? d : []))
  }, [scope])

  const cats = categorias.filter(c => c.tipo === tipo)
  // Para egresos mostramos todas las cuentas (de donde sale el dinero)
  // Para ingresos mostramos cuentas activas (a donde entra el dinero)
  const cuentasFiltradas = tipo === 'egreso'
    ? cuentas
    : cuentas.filter(c => !c.es_deuda)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const montoNum = parseFloat(form.monto)
    if (!form.descripcion.trim()) { setError('Descripción requerida'); return }
    if (isNaN(montoNum) || montoNum <= 0) { setError('Monto inválido'); return }
    if (!form.fecha) { setError('Fecha requerida'); return }
    if (!form.cuenta_id) { setError('Selecciona una cuenta'); return }
    setLoading(true)
    try {
      const body: Record<string, unknown> = {
        descripcion: form.descripcion,
        monto: montoNum,
        fecha: form.fecha,
        tipo,
        scope,
      }
      if (form.categoria_id) body.categoria_id = form.categoria_id
      if (form.cuenta_id)    body.cuenta_id    = form.cuenta_id
      if (form.notas)        body.notas        = form.notas

      const res = await fetch('/api/movimientos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Error al guardar'); return }
      onSaved()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}>
      <div className="bg-slate-900 rounded-2xl shadow-2xl border border-slate-700 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <h2 className="font-bold text-white">Nuevo movimiento</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-700 transition-colors">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">

          {/* Tipo */}
          <div className="flex gap-2">
            {(['egreso', 'ingreso'] as const).map(t => (
              <button key={t} type="button"
                onClick={() => { setTipo(t); setForm(f => ({ ...f, categoria_id: '', cuenta_id: '' })) }}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors ${
                  tipo === t
                    ? t === 'ingreso' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}>
                {t === 'ingreso' ? '↑ Ingreso' : '↓ Egreso'}
              </button>
            ))}
          </div>

          {/* Cuenta */}
          {cuentasFiltradas.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-white mb-1.5">
                {tipo === 'egreso' ? '¿De qué cuenta sale el dinero?' : '¿A qué cuenta entra el dinero?'}
                <span className="text-red-400 ml-1">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {cuentasFiltradas.map(c => {
                  const Icon = CUENTA_ICONS[c.tipo] ?? Wallet
                  const selected = form.cuenta_id === c.id
                  return (
                    <button key={c.id} type="button"
                      onClick={() => setForm(f => ({ ...f, cuenta_id: selected ? '' : c.id }))}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all text-left ${
                        selected
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

          {/* Descripción */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Descripción</label>
            <input type="text" value={form.descripcion}
              onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
              placeholder="Ej: Supermercado"
              className="w-full px-3 py-2 rounded-xl border border-slate-600 bg-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>

          {/* Monto y Fecha */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Monto ($)</label>
              <input type="number" step="0.01" min="0.01" value={form.monto}
                onChange={e => setForm(f => ({ ...f, monto: e.target.value }))}
                placeholder="0.00"
                className="w-full px-3 py-2 rounded-xl border border-slate-600 bg-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Fecha</label>
              <input type="date" value={form.fecha}
                onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-slate-600 bg-slate-800 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>

          {/* Categoría */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Categoría</label>
            <select value={form.categoria_id}
              onChange={e => setForm(f => ({ ...f, categoria_id: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-slate-600 bg-slate-800 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="">Sin categoría</option>
              {cats.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>

          {/* Notas */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Notas (opcional)</label>
            <textarea value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
              rows={2} placeholder="Detalles adicionales..."
              className="w-full px-3 py-2 rounded-xl border border-slate-600 bg-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
          </div>

          {error && <p className="text-red-400 text-xs bg-red-900/20 border border-red-800/50 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 rounded-xl border border-slate-600 text-sm font-semibold text-slate-300 hover:bg-slate-700 transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors disabled:opacity-50">
              {loading ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

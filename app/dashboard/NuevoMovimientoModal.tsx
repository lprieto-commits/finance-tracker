'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

interface Categoria { id: string; nombre: string; tipo: 'ingreso' | 'egreso' }

interface Props {
  scope:    'personal' | 'negocio'
  onClose:  () => void
  onSaved:  () => void
  defaultTipo?: 'ingreso' | 'egreso'
}

export default function NuevoMovimientoModal({ scope, onClose, onSaved, defaultTipo = 'egreso' }: Props) {
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [tipo,       setTipo]       = useState<'ingreso' | 'egreso'>(defaultTipo)
  const [form, setForm] = useState({
    descripcion: '', monto: '',
    fecha: new Date().toISOString().slice(0, 10),
    categoria_id: '', notas: '',
  })
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  useEffect(() => {
    fetch(`/api/categorias?scope=${scope}`)
      .then(r => r.json())
      .then(d => setCategorias(d.categorias ?? []))
  }, [scope])

  const cats = categorias.filter(c => c.tipo === tipo)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const montoNum = parseFloat(form.monto)
    if (!form.descripcion.trim()) { setError('Descripción requerida'); return }
    if (isNaN(montoNum) || montoNum <= 0) { setError('Monto inválido'); return }
    if (!form.fecha) { setError('Fecha requerida'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/movimientos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, tipo, scope }),
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
      <div className="bg-slate-900 rounded-2xl shadow-2xl border border-slate-700 w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <h2 className="font-bold text-white">Nuevo movimiento</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-700 transition-colors">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="flex gap-2">
            {(['egreso', 'ingreso'] as const).map(t => (
              <button key={t} type="button"
                onClick={() => { setTipo(t); setForm(f => ({ ...f, categoria_id: '' })) }}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors ${
                  tipo === t
                    ? t === 'ingreso' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}>
                {t === 'ingreso' ? 'Ingreso' : 'Egreso'}
              </button>
            ))}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Descripción</label>
            <input type="text" value={form.descripcion}
              onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
              placeholder="Ej: Supermercado"
              className="w-full px-3 py-2 rounded-xl border border-slate-600 bg-slate-900 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Monto ($)</label>
              <input type="number" step="0.01" min="0.01" value={form.monto}
                onChange={e => setForm(f => ({ ...f, monto: e.target.value }))}
                placeholder="0.00"
                className="w-full px-3 py-2 rounded-xl border border-slate-600 bg-slate-900 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Fecha</label>
              <input type="date" value={form.fecha}
                onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-slate-600 bg-slate-900 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Categoría</label>
            <select value={form.categoria_id}
              onChange={e => setForm(f => ({ ...f, categoria_id: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-slate-600 bg-slate-900 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="">Sin categoría</option>
              {cats.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Notas (opcional)</label>
            <textarea value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
              rows={2} placeholder="Detalles adicionales..."
              className="w-full px-3 py-2 rounded-xl border border-slate-600 bg-slate-900 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 rounded-xl border border-slate-600 text-sm font-semibold text-slate-300 hover:bg-slate-700 transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors disabled:opacity-50">
              {loading ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

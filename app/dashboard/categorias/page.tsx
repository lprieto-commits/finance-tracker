'use client'

import { useEffect, useState } from 'react'
import { Plus, Trash2, Tag } from 'lucide-react'

type Categoria = {
  id: string
  nombre: string
  tipo: 'ingreso' | 'egreso'
  scope: 'personal' | 'negocio'
  color: string
}

const COLORES = [
  '#10b981', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6',
  '#a855f7', '#ec4899', '#ef4444', '#f97316', '#f59e0b',
  '#84cc16', '#64748b', '#dc2626', '#0ea5e9', '#14b8a6',
]

export default function CategoriasPage() {
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [loading, setLoading]       = useState(true)
  const [showForm, setShowForm]     = useState(false)
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState('')
  const [scope, setScope]           = useState<'personal' | 'negocio'>('personal')
  const [form, setForm]             = useState({
    nombre: '', tipo: 'egreso' as 'ingreso' | 'egreso',
    scope: 'personal' as 'personal' | 'negocio',
    color: '#6366f1',
  })

  async function load() {
    setLoading(true)
    const res  = await fetch('/api/categorias')
    const data = await res.json()
    setCategorias(data.categorias ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nombre.trim()) { setError('Escribe un nombre'); return }
    setSaving(true)
    setError('')
    const res = await fetch('/api/categorias', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Error al guardar'); setSaving(false); return }
    setForm({ nombre: '', tipo: 'egreso', scope: 'personal', color: '#6366f1' })
    setShowForm(false)
    setSaving(false)
    load()
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar esta categoría? Los movimientos que la usan quedarán sin categoría.')) return
    await fetch(`/api/categorias/${id}`, { method: 'DELETE' })
    load()
  }

  const filtradas = categorias.filter(c => c.scope === scope)
  const ingresos  = filtradas.filter(c => c.tipo === 'ingreso')
  const egresos   = filtradas.filter(c => c.tipo === 'egreso')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Categorías</h1>
          <p className="text-slate-500 text-sm mt-0.5">Organiza tus ingresos y gastos</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-indigo-900/50">
          <Plus className="w-4 h-4" />
          Nueva categoría
        </button>
      </div>

      {/* Scope tabs */}
      <div className="flex gap-2">
        {(['personal', 'negocio'] as const).map(s => (
          <button key={s} onClick={() => setScope(s)}
            className={`px-5 py-1.5 rounded-full text-sm font-semibold transition-all ${
              scope === s
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50'
                : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
            }`}>
            {s === 'personal' ? 'Personal' : 'Negocio'}
          </button>
        ))}
      </div>

      {/* Formulario nueva categoría */}
      {showForm && (
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6">
          <h2 className="font-bold text-white mb-4">Nueva categoría</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Nombre</label>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                  placeholder="Ej: Gimnasio"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-white placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Tipo</label>
                  <select value={form.tipo}
                    onChange={e => setForm(f => ({ ...f, tipo: e.target.value as 'ingreso' | 'egreso' }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="egreso">Gasto</option>
                    <option value="ingreso">Ingreso</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Alcance</label>
                  <select value={form.scope}
                    onChange={e => setForm(f => ({ ...f, scope: e.target.value as 'personal' | 'negocio' }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="personal">Personal</option>
                    <option value="negocio">Negocio</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Color picker */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Color</label>
              <div className="flex flex-wrap gap-2">
                {COLORES.map(c => (
                  <button key={c} type="button"
                    onClick={() => setForm(f => ({ ...f, color: c }))}
                    className="w-8 h-8 rounded-full transition-all"
                    style={{
                      backgroundColor: c,
                      outline: form.color === c ? `3px solid white` : 'none',
                      outlineOffset: '2px',
                      transform: form.color === c ? 'scale(1.2)' : 'scale(1)',
                    }}
                  />
                ))}
              </div>
            </div>

            {error && <p className="text-xs text-red-400 bg-red-900/20 border border-red-800/50 rounded-lg px-3 py-2">{error}</p>}

            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={saving}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-sm transition-all disabled:opacity-50">
                {saving ? 'Guardando...' : 'Guardar categoría'}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setError('') }}
                className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-sm transition-all">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Ingresos */}
          {ingresos.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Ingresos</h2>
              <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
                {ingresos.map((cat, i) => (
                  <div key={cat.id} className={`flex items-center justify-between px-6 py-3.5 hover:bg-slate-800/50 transition-colors ${i < ingresos.length - 1 ? 'border-b border-slate-800/50' : ''}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: cat.color + '30' }}>
                        <Tag className="w-4 h-4" style={{ color: cat.color }} />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                        <span className="text-white font-medium text-sm">{cat.nombre}</span>
                      </div>
                    </div>
                    <button onClick={() => handleDelete(cat.id)}
                      className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-slate-800 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Egresos */}
          {egresos.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Gastos</h2>
              <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
                {egresos.map((cat, i) => (
                  <div key={cat.id} className={`flex items-center justify-between px-6 py-3.5 hover:bg-slate-800/50 transition-colors ${i < egresos.length - 1 ? 'border-b border-slate-800/50' : ''}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: cat.color + '30' }}>
                        <Tag className="w-4 h-4" style={{ color: cat.color }} />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                        <span className="text-white font-medium text-sm">{cat.nombre}</span>
                      </div>
                    </div>
                    <button onClick={() => handleDelete(cat.id)}
                      className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-slate-800 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {filtradas.length === 0 && (
            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto mb-4">
                <Tag className="w-8 h-8 text-slate-600" />
              </div>
              <p className="text-slate-400 font-semibold">No hay categorías</p>
              <p className="text-slate-600 text-sm mt-1">Crea tu primera categoría personalizada</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

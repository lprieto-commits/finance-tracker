'use client'

import { useEffect, useState } from 'react'
import { formatCurrency } from '@/lib/utils'
import { Target, Plus, Trash2, Calendar, TrendingUp, CheckCircle2 } from 'lucide-react'

type Meta = {
  id: string
  nombre: string
  monto_objetivo: number
  monto_actual: number
  fecha_objetivo: string
  descripcion: string | null
}

function calcularMeses(fechaObjetivo: string): number {
  const hoy = new Date()
  const fin  = new Date(fechaObjetivo)
  return Math.max(1, (fin.getFullYear() - hoy.getFullYear()) * 12 + (fin.getMonth() - hoy.getMonth()))
}

export default function MetasPage() {
  const [metas, setMetas]       = useState<Meta[]>([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')
  const [form, setForm]         = useState({
    nombre: '', monto_objetivo: '', monto_actual: '',
    fecha_objetivo: '', descripcion: '',
  })

  async function load() {
    setLoading(true)
    const res = await fetch('/api/metas')
    const data = await res.json()
    setMetas(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload: Record<string, unknown> = {
        nombre: form.nombre,
        monto_objetivo: parseFloat(form.monto_objetivo) || 0,
        monto_actual: parseFloat(form.monto_actual) || 0,
        fecha_objetivo: form.fecha_objetivo,
      }
      if (form.descripcion) payload.descripcion = form.descripcion
      const res = await fetch('/api/metas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Error al guardar'); return }
      setForm({ nombre: '', monto_objetivo: '', monto_actual: '', fecha_objetivo: '', descripcion: '' })
      setShowForm(false)
      load()
    } catch (err) {
      setError('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar esta meta?')) return
    await fetch(`/api/metas/${id}`, { method: 'DELETE' })
    load()
  }

  async function handleUpdateActual(meta: Meta, nuevo: number) {
    await fetch(`/api/metas/${meta.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ monto_actual: nuevo }),
    })
    load()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Metas de ahorro</h1>
          <p className="text-slate-500 text-sm mt-0.5">Proyector de objetivos financieros</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-indigo-900/50">
          <Plus className="w-4 h-4" />
          Nueva meta
        </button>
      </div>

      {/* New goal form */}
      {showForm && (
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6">
          <h2 className="font-bold text-white mb-4">Nueva meta de ahorro</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Nombre de la meta</label>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                  placeholder="Ej: Fondo de emergencia"
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-white placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Fecha objetivo</label>
                <input
                  type="date"
                  value={form.fecha_objetivo}
                  onChange={e => setForm(f => ({ ...f, fecha_objetivo: e.target.value }))}
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Monto objetivo</label>
                <input
                  type="number"
                  value={form.monto_objetivo}
                  onChange={e => setForm(f => ({ ...f, monto_objetivo: e.target.value }))}
                  placeholder="0.00"
                  step="0.01" min="0" required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-white placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Ahorrado hasta ahora</label>
                <input
                  type="number"
                  value={form.monto_actual}
                  onChange={e => setForm(f => ({ ...f, monto_actual: e.target.value }))}
                  placeholder="0.00"
                  step="0.01" min="0"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-white placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Descripción (opcional)</label>
              <input
                type="text"
                value={form.descripcion}
                onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                placeholder="Para qué es esta meta..."
                className="w-full px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-white placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            {error && (
              <div className="text-xs text-red-400 bg-red-900/20 border border-red-800/50 rounded-lg px-3 py-2">{error}</div>
            )}
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

      {/* Goals list */}
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
          <p className="text-slate-600 text-sm mt-1">Define objetivos financieros y rastrea tu progreso</p>
        </div>
      ) : (
        <div className="space-y-4">
          {metas.map(meta => {
            const pct      = Math.min(100, (meta.monto_actual / meta.monto_objetivo) * 100)
            const restante = Math.max(0, meta.monto_objetivo - meta.monto_actual)
            const meses    = calcularMeses(meta.fecha_objetivo)
            const mensual  = restante / meses
            const cumplida = meta.monto_actual >= meta.monto_objetivo

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
                      {meta.descripcion && <p className="text-xs text-slate-500">{meta.descripcion}</p>}
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

                {/* Progress bar */}
                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-slate-400">{formatCurrency(meta.monto_actual)}</span>
                    <span className="text-slate-500">de {formatCurrency(meta.monto_objetivo)}</span>
                  </div>
                  <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${cumplida ? 'bg-emerald-500' : 'bg-indigo-500'}`}
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

                {/* Projection */}
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

                {/* Update current amount */}
                <div className="mt-4 pt-4 border-t border-slate-800/50 flex items-center gap-3">
                  <span className="text-xs text-slate-500">Actualizar progreso:</span>
                  <input
                    type="number"
                    defaultValue={meta.monto_actual}
                    step="0.01" min="0"
                    onBlur={e => {
                      const val = parseFloat(e.target.value)
                      if (!isNaN(val) && val !== meta.monto_actual) handleUpdateActual(meta, val)
                    }}
                    className="w-36 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

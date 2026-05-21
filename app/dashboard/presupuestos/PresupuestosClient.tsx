'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

interface Presupuesto { id: string; categoria_id: string; nombre: string; color: string; limite: number; gastado: number }
interface Categoria   { id: string; nombre: string; color: string }

interface Props {
  presupuestos:    Presupuesto[]
  categorias:      Categoria[]
  catIdsConPresup: Set<string>
  anio: number; mes: number; scope: 'personal' | 'negocio'
}

export default function PresupuestosClient({ presupuestos, categorias, catIdsConPresup, anio, mes, scope }: Props) {
  const router = useRouter()
  const [form,     setForm]     = useState({ categoria_id: '', limite: '' })
  const [saving,   setSaving]   = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error,    setError]    = useState('')

  function navegar(delta: number) {
    let m = mes + delta, a = anio
    if (m < 1)  { m = 12; a-- }
    if (m > 12) { m = 1;  a++ }
    router.push(`?anio=${a}&mes=${m}&scope=${scope}`)
  }

  const catsSinPresup = categorias.filter(c => !catIdsConPresup.has(c.id))

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault(); setError('')
    if (!form.categoria_id) { setError('Selecciona una categoría'); return }
    const limiteNum = parseFloat(form.limite)
    if (isNaN(limiteNum) || limiteNum <= 0) { setError('Límite inválido'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/presupuestos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoria_id: form.categoria_id, anio, mes, limite: limiteNum }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Error'); return }
      setForm({ categoria_id: '', limite: '' })
      router.refresh()
    } finally { setSaving(false) }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este presupuesto?')) return
    setDeleting(id)
    try {
      await fetch(`/api/presupuestos/${id}`, { method: 'DELETE' })
      router.refresh()
    } finally { setDeleting(null) }
  }

  return (
    <>
      {/* Scope + navegación */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-2">
          {(['personal', 'negocio'] as const).map(s => (
            <a key={s} href={`?anio=${anio}&mes=${mes}&scope=${s}`}
              className={`px-4 py-1.5 rounded-full text-sm font-medium capitalize transition-colors ${
                scope === s ? 'bg-indigo-600 text-white' : 'bg-slate-800 border border-slate-600 text-slate-300 hover:border-slate-500'
              }`}>
              {s === 'personal' ? 'Personal' : 'Negocio'}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navegar(-1)} className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors">
            <ChevronLeft className="w-4 h-4 text-slate-300" />
          </button>
          <span className="text-sm font-medium text-white min-w-36 text-center">{MESES[mes-1]} {anio}</span>
          <button onClick={() => navegar(1)} className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors">
            <ChevronRight className="w-4 h-4 text-slate-300" />
          </button>
        </div>
      </div>

      {/* Formulario */}
      {catsSinPresup.length > 0 && (
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-5">
          <h3 className="font-semibold text-white text-sm mb-4">Agregar presupuesto</h3>
          <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Categoría</label>
              <select value={form.categoria_id} onChange={e => setForm(f => ({ ...f, categoria_id: e.target.value }))}
                className="px-3 py-2 rounded-xl border border-slate-600 bg-slate-900 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">Seleccionar…</option>
                {catsSinPresup.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Límite mensual ($)</label>
              <input type="number" step="0.01" min="0.01" value={form.limite}
                onChange={e => setForm(f => ({ ...f, limite: e.target.value }))}
                placeholder="0.00"
                className="px-3 py-2 rounded-xl border border-slate-600 bg-slate-900 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-36" />
            </div>
            {error && <p className="text-red-400 text-xs w-full">{error}</p>}
            <button type="submit" disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50">
              <Plus className="w-4 h-4" />
              {saving ? 'Guardando...' : 'Agregar'}
            </button>
          </form>
        </div>
      )}

      {/* Lista */}
      {presupuestos.length === 0
        ? <div className="bg-slate-800 rounded-2xl border border-slate-700 p-10 text-center text-slate-500 text-sm">
            No hay presupuestos configurados para este mes.
          </div>
        : <div className="space-y-3">
            {presupuestos.map(p => {
              const pct      = Math.min((p.gastado / p.limite) * 100, 100)
              const excedido = p.gastado > p.limite
              const restante = p.limite - p.gastado
              return (
                <div key={p.id} className="bg-slate-800 rounded-2xl border border-slate-700 p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                      <span className="font-semibold text-white">{p.nombre}</span>
                      {excedido && <span className="px-2 py-0.5 rounded-full bg-red-900 text-red-300 text-xs font-medium">Excedido</span>}
                    </div>
                    <button onClick={() => handleDelete(p.id)} disabled={deleting === p.id}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-950 disabled:opacity-50 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="h-2.5 bg-slate-700 rounded-full overflow-hidden mb-3">
                    <div className={`h-full rounded-full transition-all ${excedido ? 'bg-red-500' : ''}`}
                      style={{ width: `${pct}%`, ...(excedido ? {} : { backgroundColor: p.color }) }} />
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">
                      Gastado: <span className={`font-semibold ${excedido ? 'text-red-400' : 'text-white'}`}>{formatCurrency(p.gastado)}</span>
                    </span>
                    <span className="text-slate-400">Límite: <span className="font-semibold text-white">{formatCurrency(p.limite)}</span></span>
                    <span className={`font-semibold ${excedido ? 'text-red-400' : 'text-emerald-400'}`}>
                      {excedido ? `−${formatCurrency(Math.abs(restante))} excedido` : `${formatCurrency(restante)} disponible`}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
      }
    </>
  )
}

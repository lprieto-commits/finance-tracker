'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, ChevronLeft, ChevronRight, Wallet, AlertTriangle, CheckCircle2, TrendingUp } from 'lucide-react'
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

function diasRestantesMes(anio: number, mes: number): number {
  const hoy        = new Date()
  const finDeMes   = new Date(anio, mes, 0)
  const hoyDelMes  = new Date(anio, mes - 1, hoy.getDate())
  const diff = finDeMes.getTime() - hoyDelMes.getTime()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

function diasTranscurridos(anio: number, mes: number): number {
  const hoy = new Date()
  const inicio = new Date(anio, mes - 1, 1)
  const fin    = new Date(anio, mes, 0)
  const actual = hoy < inicio ? inicio : hoy > fin ? fin : hoy
  return Math.max(1, Math.ceil((actual.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24)) + 1)
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

  // Totales generales
  const totalLimite  = presupuestos.reduce((s, p) => s + p.limite, 0)
  const totalGastado = presupuestos.reduce((s, p) => s + p.gastado, 0)
  const totalPct     = totalLimite > 0 ? Math.min(100, (totalGastado / totalLimite) * 100) : 0
  const totalRestante = Math.max(0, totalLimite - totalGastado)
  const excedidos    = presupuestos.filter(p => p.gastado > p.limite).length

  const diasRestantes   = diasRestantesMes(anio, mes)
  const diasPasados     = diasTranscurridos(anio, mes)
  const diasTotales     = new Date(anio, mes, 0).getDate()
  const pctMesPasado    = Math.round((diasPasados / diasTotales) * 100)
  const gasto_diario_hoy = diasPasados > 0 ? totalGastado / diasPasados : 0
  const disponibleDiario = diasRestantes > 0 ? totalRestante / diasRestantes : 0

  return (
    <>
      {/* Scope + navegación */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1 bg-slate-800 p-1 rounded-xl">
          {(['personal', 'negocio'] as const).map(s => (
            <a key={s} href={`?anio=${anio}&mes=${mes}&scope=${s}`}
              className={`px-5 py-1.5 rounded-lg text-sm font-semibold transition-all capitalize ${
                scope === s ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}>
              {s === 'personal' ? 'Personal' : 'Negocio'}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navegar(-1)} className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors">
            <ChevronLeft className="w-4 h-4 text-slate-300" />
          </button>
          <span className="text-sm font-semibold text-white min-w-36 text-center">{MESES[mes-1]} {anio}</span>
          <button onClick={() => navegar(1)} className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors">
            <ChevronRight className="w-4 h-4 text-slate-300" />
          </button>
        </div>
      </div>

      {/* Resumen del mes */}
      {presupuestos.length > 0 && (
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Total gastado</p>
              <p className="text-2xl font-bold text-white mt-0.5">{formatCurrency(totalGastado)}</p>
              <p className="text-sm text-slate-500">de {formatCurrency(totalLimite)} presupuestado</p>
            </div>
            <div className="text-right">
              {excedidos > 0 ? (
                <div className="flex items-center gap-1.5 text-red-400 mb-1">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-sm font-semibold">{excedidos} categoría{excedidos > 1 ? 's' : ''} excedida{excedidos > 1 ? 's' : ''}</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-emerald-400 mb-1">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="text-sm font-semibold">Dentro del presupuesto</span>
                </div>
              )}
              <p className="text-xs text-slate-500">{totalPct.toFixed(0)}% del presupuesto usado</p>
            </div>
          </div>

          {/* Barra global */}
          <div>
            <div className="h-3 bg-slate-800 rounded-full overflow-hidden relative">
              {/* Barra de progreso del gasto */}
              <div className={`h-full rounded-full transition-all duration-700 ${totalPct > 100 ? 'bg-red-500' : totalPct > 80 ? 'bg-amber-500' : 'bg-indigo-500'}`}
                style={{ width: `${totalPct}%` }} />
              {/* Indicador de % del mes transcurrido */}
              <div className="absolute top-0 bottom-0 w-0.5 bg-white/30"
                style={{ left: `${pctMesPasado}%` }} />
            </div>
            <div className="flex justify-between mt-1.5 text-xs text-slate-500">
              <span>Día {diasPasados} de {diasTotales}</span>
              <span>{diasRestantes} días restantes</span>
            </div>
          </div>

          {/* Stats rápidas */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="bg-slate-800/60 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingUp className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-xs text-slate-400">Gasto diario promedio</span>
              </div>
              <p className="font-bold text-white">{formatCurrency(gasto_diario_hoy)}/día</p>
            </div>
            <div className={`rounded-xl p-3 ${disponibleDiario > 0 ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
              <div className="flex items-center gap-1.5 mb-1">
                <Wallet className={`w-3.5 h-3.5 ${disponibleDiario > 0 ? 'text-emerald-400' : 'text-red-400'}`} />
                <span className="text-xs text-slate-400">Puedes gastar</span>
              </div>
              <p className={`font-bold ${disponibleDiario > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {disponibleDiario > 0 ? formatCurrency(disponibleDiario) + '/día' : 'Sin disponible'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Formulario */}
      {catsSinPresup.length > 0 && (
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5">
          <h3 className="font-semibold text-white text-sm mb-4">Agregar categoría al presupuesto</h3>
          <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Categoría</label>
              <select value={form.categoria_id} onChange={e => setForm(f => ({ ...f, categoria_id: e.target.value }))}
                className="px-3 py-2 rounded-xl border border-slate-700 bg-slate-800 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">Seleccionar…</option>
                {catsSinPresup.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Límite mensual ($)</label>
              <input type="number" step="0.01" min="0.01" value={form.limite}
                onChange={e => setForm(f => ({ ...f, limite: e.target.value }))}
                placeholder="0.00"
                className="px-3 py-2 rounded-xl border border-slate-700 bg-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-36" />
            </div>
            {error && <p className="text-red-400 text-xs w-full">{error}</p>}
            <button type="submit" disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50">
              <Plus className="w-4 h-4" />
              {saving ? 'Guardando...' : 'Agregar'}
            </button>
          </form>
        </div>
      )}

      {/* Lista de presupuestos */}
      {presupuestos.length === 0 ? (
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto mb-4">
            <Wallet className="w-8 h-8 text-slate-600" />
          </div>
          <p className="text-slate-400 font-semibold">No hay presupuestos para este mes</p>
          <p className="text-slate-600 text-sm mt-1">Agrega categorías para controlar tus gastos</p>
        </div>
      ) : (
        <div className="space-y-3">
          {presupuestos
            .sort((a, b) => (b.gastado / b.limite) - (a.gastado / a.limite))
            .map(p => {
              const pct      = Math.min((p.gastado / p.limite) * 100, 100)
              const excedido = p.gastado > p.limite
              const restante = p.limite - p.gastado
              const enRiesgo = !excedido && pct > 80

              return (
                <div key={p.id} className={`bg-slate-900 rounded-2xl border p-5 ${excedido ? 'border-red-800/60' : enRiesgo ? 'border-amber-800/40' : 'border-slate-800'}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                      <span className="font-semibold text-white">{p.nombre}</span>
                      {excedido && (
                        <span className="px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 text-xs font-semibold border border-red-800/30">
                          🔴 Excedido
                        </span>
                      )}
                      {enRiesgo && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 text-xs font-semibold border border-amber-800/30">
                          🟡 En riesgo
                        </span>
                      )}
                    </div>
                    <button onClick={() => handleDelete(p.id)} disabled={deleting === p.id}
                      className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-slate-800 disabled:opacity-50 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Barra de progreso */}
                  <div className="h-2.5 bg-slate-800 rounded-full overflow-hidden mb-3">
                    <div className={`h-full rounded-full transition-all duration-700 ${excedido ? 'bg-red-500' : enRiesgo ? 'bg-amber-500' : ''}`}
                      style={{ width: `${pct}%`, ...(!excedido && !enRiesgo ? { backgroundColor: p.color } : {}) }} />
                  </div>

                  {/* Números */}
                  <div className="flex items-center justify-between text-sm flex-wrap gap-2">
                    <div>
                      <span className="text-slate-500">Gastado: </span>
                      <span className={`font-bold ${excedido ? 'text-red-400' : 'text-white'}`}>{formatCurrency(p.gastado)}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Límite: </span>
                      <span className="font-bold text-white">{formatCurrency(p.limite)}</span>
                    </div>
                    <div>
                      <span className={`font-bold ${excedido ? 'text-red-400' : 'text-emerald-400'}`}>
                        {excedido
                          ? `−${formatCurrency(Math.abs(restante))} excedido`
                          : `${formatCurrency(restante)} disponible`}
                      </span>
                    </div>
                  </div>

                  {/* % y proyección */}
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs text-slate-500">{pct.toFixed(0)}% usado</span>
                    {!excedido && diasRestantes > 0 && (
                      <span className="text-xs text-slate-500">
                        Puedes gastar <span className="text-white font-semibold">{formatCurrency(Math.max(0, restante / diasRestantes))}/día</span> los próximos {diasRestantes} días
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
        </div>
      )}
    </>
  )
}

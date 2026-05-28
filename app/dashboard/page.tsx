export const dynamic = 'force-dynamic'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TrendingUp, TrendingDown, PiggyBank, AlertTriangle, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import FiltroMes from './FiltroMes'
import UltimosMovimientos from './UltimosMovimientos'
import NuevoMovimientoButton from './NuevoMovimientoButton'
import AIInsights from './AIInsights'

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ anio?: string; mes?: string; scope?: string }>
}) {
  const sp    = await searchParams
  const now   = new Date()
  const anio  = parseInt(sp.anio ?? String(now.getFullYear()))
  const mes   = parseInt(sp.mes  ?? String(now.getMonth() + 1))
  const scope = (sp.scope === 'negocio' ? 'negocio' : 'personal') as 'personal' | 'negocio'

  const desde = `${anio}-${String(mes).padStart(2,'0')}-01`
  const hasta = new Date(anio, mes, 0).toISOString().slice(0, 10)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const admin = await createAdminClient()

  const { data: movs } = await admin
    .from('movimientos')
    .select('*, categorias(id, nombre, color)')
    .eq('user_id', user.id)
    .eq('scope', scope)
    .neq('origen', 'transferencia')
    .gte('fecha', desde)
    .lte('fecha', hasta)
    .order('fecha', { ascending: false })

  const lista = (movs ?? []) as {
    id: string; tipo: 'ingreso' | 'egreso'; monto: number
    descripcion: string; fecha: string
    categorias: { id: string; nombre: string; color: string } | null
  }[]

  const totalIngresos = lista.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + m.monto, 0)
  const totalEgresos  = lista.filter(m => m.tipo === 'egreso').reduce((s, m) => s + m.monto, 0)
  const balance       = totalIngresos - totalEgresos

  const catMap: Record<string, { nombre: string; color: string; total: number }> = {}
  for (const m of lista.filter(x => x.tipo === 'egreso')) {
    const cat = m.categorias
    const key = cat?.id ?? 'sin'
    if (!catMap[key]) catMap[key] = { nombre: cat?.nombre ?? 'Sin categoría', color: cat?.color ?? '#94a3b8', total: 0 }
    catMap[key].total += m.monto
  }
  const porCategoria = Object.values(catMap).sort((a, b) => b.total - a.total)

  const { data: presupuestos } = await admin
    .from('presupuestos')
    .select('*, categorias(id, nombre, color, scope)')
    .eq('user_id', user.id)
    .eq('anio', anio)
    .eq('mes', mes)

  const presups = ((presupuestos ?? []) as {
    id: string; categoria_id: string; limite: number
    categorias: { id: string; nombre: string; color: string; scope: string } | null
  }[]).filter(p => p.categorias?.scope === scope)

  const alertas = presups.filter(p => (catMap[p.categoria_id]?.total ?? 0) > p.limite)
  const savingsRate = totalIngresos > 0 ? Math.round(((totalIngresos - totalEgresos) / totalIngresos) * 100) : 0

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">{MESES[mes - 1]} <span className="text-slate-400">{anio}</span></h1>
          <p className="text-slate-500 text-sm mt-0.5">Resumen financiero</p>
        </div>
        <div className="flex items-center gap-2">
          <FiltroMes anio={anio} mes={mes} scope={scope} />
          <NuevoMovimientoButton scope={scope} />
        </div>
      </div>

      {/* Scope tabs */}
      <div className="flex gap-2">
        {(['personal', 'negocio'] as const).map(s => (
          <a key={s} href={`?anio=${anio}&mes=${mes}&scope=${s}`}
            className={`px-5 py-1.5 rounded-full text-sm font-semibold transition-all ${
              scope === s
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50'
                : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
            }`}>
            {s === 'personal' ? 'Personal' : 'Negocio'}
          </a>
        ))}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Ingresos */}
        <div className="relative overflow-hidden bg-gradient-to-br from-emerald-900/80 to-emerald-950 rounded-2xl border border-emerald-800/50 p-5">
          <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/10 rounded-full -translate-y-6 translate-x-6" />
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              </div>
              <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wide">Ingresos</span>
            </div>
            <ArrowUpRight className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-white">{formatCurrency(totalIngresos)}</p>
          <p className="text-xs text-emerald-600 mt-1">{lista.filter(m => m.tipo === 'ingreso').length} transacciones</p>
        </div>

        {/* Egresos */}
        <div className="relative overflow-hidden bg-gradient-to-br from-red-900/80 to-red-950 rounded-2xl border border-red-800/50 p-5">
          <div className="absolute top-0 right-0 w-20 h-20 bg-red-500/10 rounded-full -translate-y-6 translate-x-6" />
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-red-500/20 flex items-center justify-center">
                <TrendingDown className="w-4 h-4 text-red-400" />
              </div>
              <span className="text-xs font-semibold text-red-400 uppercase tracking-wide">Egresos</span>
            </div>
            <ArrowDownRight className="w-4 h-4 text-red-500" />
          </div>
          <p className="text-2xl font-bold text-white">{formatCurrency(totalEgresos)}</p>
          <p className="text-xs text-red-600 mt-1">{lista.filter(m => m.tipo === 'egreso').length} transacciones</p>
        </div>

        {/* Balance */}
        <div className={`relative overflow-hidden rounded-2xl border p-5 ${
          balance >= 0
            ? 'bg-gradient-to-br from-indigo-900/80 to-indigo-950 border-indigo-800/50'
            : 'bg-gradient-to-br from-orange-900/80 to-orange-950 border-orange-800/50'
        }`}>
          <div className={`absolute top-0 right-0 w-20 h-20 rounded-full -translate-y-6 translate-x-6 ${balance >= 0 ? 'bg-indigo-500/10' : 'bg-orange-500/10'}`} />
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${balance >= 0 ? 'bg-indigo-500/20' : 'bg-orange-500/20'}`}>
                <PiggyBank className={`w-4 h-4 ${balance >= 0 ? 'text-indigo-400' : 'text-orange-400'}`} />
              </div>
              <span className={`text-xs font-semibold uppercase tracking-wide ${balance >= 0 ? 'text-indigo-400' : 'text-orange-400'}`}>Balance</span>
            </div>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              savingsRate >= 0
                ? 'bg-indigo-500/20 text-indigo-300'
                : 'bg-orange-500/20 text-orange-300'
            }`}>
              {savingsRate}%
            </span>
          </div>
          <p className={`text-2xl font-bold ${balance >= 0 ? 'text-white' : 'text-orange-200'}`}>
            {balance >= 0 ? '+' : ''}{formatCurrency(balance)}
          </p>
          <p className={`text-xs mt-1 ${balance >= 0 ? 'text-indigo-600' : 'text-orange-600'}`}>
            {balance >= 0 ? 'Tasa de ahorro' : 'Déficit del mes'}
          </p>
        </div>
      </div>

      {/* Alertas */}
      {alertas.length > 0 && (
        <div className="flex items-start gap-3 bg-amber-950/50 border border-amber-800/50 rounded-2xl p-4">
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0 mt-0.5">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex-1">
            <p className="text-amber-300 font-semibold text-sm mb-1">
              {alertas.length} presupuesto{alertas.length > 1 ? 's' : ''} excedido{alertas.length > 1 ? 's' : ''}
            </p>
            {alertas.map(a => (
              <div key={a.id} className="flex justify-between text-xs text-amber-500">
                <span>{a.categorias?.nombre}</span>
                <span className="font-semibold text-amber-400">
                  {formatCurrency(catMap[a.categoria_id]?.total ?? 0)} / {formatCurrency(a.limite)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Por categoría */}
      {porCategoria.length > 0 && (
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6">
          <h2 className="font-bold text-white mb-5">Egresos por categoría</h2>
          <div className="space-y-4">
            {porCategoria.map((cat, i) => {
              const pct = totalEgresos > 0 ? (cat.total / totalEgresos) * 100 : 0
              return (
                <div key={cat.nombre}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                      <span className="text-slate-300 font-medium">{cat.nombre}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-slate-500 text-xs">{pct.toFixed(0)}%</span>
                      <span className="font-bold text-white">{formatCurrency(cat.total)}</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: cat.color, opacity: 1 - i * 0.08 }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <UltimosMovimientos movimientos={lista.slice(0, 6)} anio={anio} mes={mes} scope={scope} />

      <AIInsights anio={anio} mes={mes} />
    </div>
  )
}

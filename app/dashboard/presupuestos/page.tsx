export const dynamic = 'force-dynamic'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PresupuestosClient from './PresupuestosClient'

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

export default async function PresupuestosPage({
  searchParams,
}: {
  searchParams: Promise<{ anio?: string; mes?: string; scope?: string }>
}) {
  const sp   = await searchParams
  const now  = new Date()
  const anio = parseInt(sp.anio ?? String(now.getFullYear()))
  const mes  = parseInt(sp.mes  ?? String(now.getMonth() + 1))
  const scope = (sp.scope === 'negocio' ? 'negocio' : 'personal') as 'personal' | 'negocio'

  const desde = `${anio}-${String(mes).padStart(2,'0')}-01`
  const hasta = new Date(anio, mes, 0).toISOString().slice(0, 10)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const admin = await createAdminClient()

  const { data: cats } = await admin
    .from('categorias')
    .select('id, nombre, color')
    .eq('user_id', user.id)
    .eq('scope', scope)
    .eq('tipo', 'egreso')
    .order('nombre')

  const { data: presupuestos } = await admin
    .from('presupuestos')
    .select('*, categorias(id, nombre, color, scope)')
    .eq('user_id', user.id)
    .eq('anio', anio)
    .eq('mes', mes)

  const { data: movs } = await admin
    .from('movimientos')
    .select('categoria_id, monto')
    .eq('user_id', user.id)
    .eq('scope', scope)
    .eq('tipo', 'egreso')
    .gte('fecha', desde)
    .lte('fecha', hasta)

  const gastado: Record<string, number> = {}
  for (const m of (movs ?? [])) {
    if (m.categoria_id) gastado[m.categoria_id] = (gastado[m.categoria_id] ?? 0) + m.monto
  }

  const presups = ((presupuestos ?? []) as any[])
    .filter(p => p.categorias?.scope === scope)
    .map(p => ({
      id:           p.id,
      categoria_id: p.categoria_id,
      nombre:       p.categorias?.nombre ?? '—',
      color:        p.categorias?.color ?? '#94a3b8',
      limite:       p.limite,
      gastado:      gastado[p.categoria_id] ?? 0,
    }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Presupuestos</h1>
        <p className="text-slate-500 text-sm mt-0.5">{MESES[mes - 1]} {anio} · Control de gastos por categoría</p>
      </div>
      <PresupuestosClient
        presupuestos={presups}
        categorias={(cats ?? []) as any[]}
        catIdsConPresup={new Set(presups.map(p => p.categoria_id))}
        anio={anio}
        mes={mes}
        scope={scope}
      />
    </div>
  )
}

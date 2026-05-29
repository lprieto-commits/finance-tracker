export const dynamic = 'force-dynamic'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MovimientosClient from './MovimientosClient'

function defaultDates() {
  const now = new Date()
  return {
    desde: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10),
    hasta: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10),
  }
}

export default async function MovimientosPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string; scope?: string; tipo?: string }>
}) {
  const sp    = await searchParams
  const def   = defaultDates()
  const desde = sp.desde ?? def.desde
  const hasta = sp.hasta ?? def.hasta
  const scope = (sp.scope === 'negocio' ? 'negocio' : 'personal') as 'personal' | 'negocio'
  const tipo  = sp.tipo ?? ''

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const admin = await createAdminClient()

  let q = admin
    .from('movimientos')
    .select('*, categorias(id, nombre, color), cuentas(id, nombre, tipo)')
    .eq('user_id', user.id)
    .eq('scope', scope)
    .gte('fecha', desde)
    .lte('fecha', hasta)
    .order('fecha', { ascending: false })
    .order('created_at', { ascending: false })

  if (tipo && ['ingreso', 'egreso'].includes(tipo)) q = q.eq('tipo', tipo)

  const { data: movs } = await q
  const { data: cats } = await admin
    .from('categorias')
    .select('id, nombre, tipo, scope, color')
    .eq('user_id', user.id)
    .eq('scope', scope)
    .order('tipo').order('nombre')

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Movimientos</h1>
      <MovimientosClient
        movimientos={(movs ?? []) as any[]}
        categorias={(cats ?? []) as any[]}
        desde={desde}
        hasta={hasta}
        scope={scope}
        tipoFiltro={tipo}
      />
    </div>
  )
}

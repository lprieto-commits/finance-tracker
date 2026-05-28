import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

async function getUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function GET(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const sp    = new URL(req.url).searchParams
  const admin = await createAdminClient()

  let q = admin
    .from('movimientos')
    .select('*, categorias(id, nombre, color, tipo)')
    .eq('user_id', user.id)
    .order('fecha', { ascending: false })

  if (sp.get('desde'))  q = q.gte('fecha',   sp.get('desde')!)
  if (sp.get('hasta'))  q = q.lte('fecha',   sp.get('hasta')!)
  if (sp.get('scope'))  q = q.eq('scope',    sp.get('scope')!)
  if (sp.get('tipo'))   q = q.eq('tipo',     sp.get('tipo')!)
  // Incluir transferencias solo si se pide explícitamente
  if (sp.get('all') !== 'true') q = q.neq('origen', 'transferencia')

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ movimientos: data })
}

export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json()
  const { tipo, scope, monto, descripcion, fecha, categoria_id, notas, cuenta_id } = body

  if (!['ingreso', 'egreso'].includes(tipo))
    return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })
  if (!['personal', 'negocio'].includes(scope))
    return NextResponse.json({ error: 'Scope inválido' }, { status: 400 })
  const montoNum = parseFloat(monto)
  if (isNaN(montoNum) || montoNum <= 0)
    return NextResponse.json({ error: 'Monto inválido' }, { status: 400 })
  if (!descripcion?.trim())
    return NextResponse.json({ error: 'Descripción requerida' }, { status: 400 })
  if (!fecha)
    return NextResponse.json({ error: 'Fecha requerida' }, { status: 400 })

  const admin = await createAdminClient()
  const { data, error } = await admin
    .from('movimientos')
    .insert({
      user_id:      user.id,
      tipo, scope,
      monto:        montoNum,
      descripcion:  descripcion.trim(),
      fecha,
      categoria_id: categoria_id || null,
      cuenta_id:    cuenta_id    || null,
      notas:        notas?.trim() || null,
      origen:       'manual',
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, movimiento: data }, { status: 201 })
}

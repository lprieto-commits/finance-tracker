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

  const sp   = new URL(req.url).searchParams
  const anio = parseInt(sp.get('anio') ?? String(new Date().getFullYear()))
  const mes  = parseInt(sp.get('mes')  ?? String(new Date().getMonth() + 1))

  const admin = await createAdminClient()
  const { data, error } = await admin
    .from('presupuestos')
    .select('*, categorias(id, nombre, color, tipo, scope)')
    .eq('user_id', user.id)
    .eq('anio', anio)
    .eq('mes', mes)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ presupuestos: data })
}

export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json()
  const { categoria_id, anio, mes, limite } = body

  const limiteNum = parseFloat(limite)
  if (!categoria_id) return NextResponse.json({ error: 'Categoría requerida' }, { status: 400 })
  if (isNaN(limiteNum) || limiteNum <= 0) return NextResponse.json({ error: 'Límite inválido' }, { status: 400 })

  const admin = await createAdminClient()
  const { data, error } = await admin
    .from('presupuestos')
    .upsert(
      { user_id: user.id, categoria_id, anio, mes, limite: limiteNum },
      { onConflict: 'user_id,categoria_id,anio,mes' }
    )
    .select('*').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, presupuesto: data }, { status: 201 })
}

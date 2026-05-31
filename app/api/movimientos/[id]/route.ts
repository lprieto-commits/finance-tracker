import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params
  const admin = await createAdminClient()
  const { error } = await admin
    .from('movimientos')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const { tipo, monto, descripcion, fecha, categoria_id, cuenta_id, notas } = body

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
    .update({
      tipo,
      monto:        montoNum,
      descripcion:  descripcion.trim(),
      fecha,
      categoria_id: categoria_id || null,
      cuenta_id:    cuenta_id    || null,
      notas:        notas?.trim() || null,
    })
    .eq('id', id)
    .eq('user_id', user.id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, movimiento: data })
}

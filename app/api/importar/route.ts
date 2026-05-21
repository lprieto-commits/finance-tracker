import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

interface FilaImport {
  fecha: string; descripcion: string; monto: number; tipo: 'ingreso' | 'egreso'
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json()
  const { movimientos, scope } = body as { movimientos: FilaImport[]; scope: 'personal' | 'negocio' }

  if (!Array.isArray(movimientos) || movimientos.length === 0)
    return NextResponse.json({ error: 'Sin movimientos' }, { status: 400 })
  if (!['personal', 'negocio'].includes(scope))
    return NextResponse.json({ error: 'Scope inválido' }, { status: 400 })

  const rows = movimientos.map(m => ({
    user_id:     user.id,
    tipo:        m.tipo,
    scope,
    monto:       Math.abs(m.monto),
    descripcion: m.descripcion?.trim() || 'Sin descripción',
    fecha:       m.fecha,
    origen:      'importacion' as const,
  }))

  const admin = await createAdminClient()
  const { data, error } = await admin.from('movimientos').insert(rows).select('id')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, insertados: data?.length ?? 0 }, { status: 201 })
}

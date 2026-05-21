import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

async function getUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

const DEFAULTS = [
  { nombre: 'Salario',         tipo: 'ingreso', scope: 'personal', color: '#10b981' },
  { nombre: 'Freelance',       tipo: 'ingreso', scope: 'personal', color: '#06b6d4' },
  { nombre: 'Inversiones',     tipo: 'ingreso', scope: 'personal', color: '#8b5cf6' },
  { nombre: 'Otros ingresos',  tipo: 'ingreso', scope: 'personal', color: '#6366f1' },
  { nombre: 'Vivienda',        tipo: 'egreso',  scope: 'personal', color: '#f59e0b' },
  { nombre: 'Alimentación',    tipo: 'egreso',  scope: 'personal', color: '#ef4444' },
  { nombre: 'Transporte',      tipo: 'egreso',  scope: 'personal', color: '#f97316' },
  { nombre: 'Salud',           tipo: 'egreso',  scope: 'personal', color: '#ec4899' },
  { nombre: 'Educación',       tipo: 'egreso',  scope: 'personal', color: '#3b82f6' },
  { nombre: 'Entretenimiento', tipo: 'egreso',  scope: 'personal', color: '#a855f7' },
  { nombre: 'Servicios',       tipo: 'egreso',  scope: 'personal', color: '#64748b' },
  { nombre: 'Otros gastos',    tipo: 'egreso',  scope: 'personal', color: '#94a3b8' },
  { nombre: 'Ventas',          tipo: 'ingreso', scope: 'negocio',  color: '#10b981' },
  { nombre: 'Servicios',       tipo: 'ingreso', scope: 'negocio',  color: '#06b6d4' },
  { nombre: 'Otros ingresos',  tipo: 'ingreso', scope: 'negocio',  color: '#6366f1' },
  { nombre: 'Planilla',        tipo: 'egreso',  scope: 'negocio',  color: '#f59e0b' },
  { nombre: 'Proveedores',     tipo: 'egreso',  scope: 'negocio',  color: '#ef4444' },
  { nombre: 'Renta',           tipo: 'egreso',  scope: 'negocio',  color: '#f97316' },
  { nombre: 'Publicidad',      tipo: 'egreso',  scope: 'negocio',  color: '#ec4899' },
  { nombre: 'Impuestos',       tipo: 'egreso',  scope: 'negocio',  color: '#dc2626' },
  { nombre: 'Otros gastos',    tipo: 'egreso',  scope: 'negocio',  color: '#94a3b8' },
]

export async function GET(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = await createAdminClient()

  // Crear categorías predeterminadas si no existen
  const { count } = await admin
    .from('categorias')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)

  if (count === 0) {
    await admin.from('categorias').insert(DEFAULTS.map(c => ({ ...c, user_id: user.id })))
  }

  const sp = new URL(req.url).searchParams
  let q = admin
    .from('categorias')
    .select('*')
    .eq('user_id', user.id)
    .order('scope').order('tipo').order('nombre')

  if (sp.get('scope')) q = q.eq('scope', sp.get('scope')!)
  if (sp.get('tipo'))  q = q.eq('tipo',  sp.get('tipo')!)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ categorias: data })
}

export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json()
  const { nombre, tipo, scope, color } = body

  if (!nombre?.trim()) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 })
  if (!['ingreso', 'egreso'].includes(tipo)) return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })
  if (!['personal', 'negocio'].includes(scope)) return NextResponse.json({ error: 'Scope inválido' }, { status: 400 })

  const admin = await createAdminClient()
  const { data, error } = await admin
    .from('categorias')
    .insert({ user_id: user.id, nombre: nombre.trim(), tipo, scope, color: color || '#6366f1' })
    .select('*').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, categoria: data }, { status: 201 })
}

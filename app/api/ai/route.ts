import { createAdminClient, createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { tipo, anio, mes, descripcion } = body
  const admin = await createAdminClient()

  const desde = `${anio}-${String(mes).padStart(2, '0')}-01`
  const hasta = new Date(anio, mes, 0).toISOString().slice(0, 10)

  const { data: movs } = await admin
    .from('movimientos')
    .select('*, categorias(nombre)')
    .eq('user_id', user.id)
    .gte('fecha', desde)
    .lte('fecha', hasta)
    .order('fecha', { ascending: false })

  const { data: cuentas } = await admin
    .from('cuentas')
    .select('*')
    .eq('user_id', user.id)

  const resumen = {
    periodo: `${mes}/${anio}`,
    movimientos: (movs ?? []).map(m => ({
      tipo: m.tipo,
      monto: m.monto,
      descripcion: m.descripcion,
      categoria: (m.categorias as { nombre: string } | null)?.nombre ?? 'Sin categoría',
      fecha: m.fecha,
      scope: m.scope,
    })),
    cuentas: (cuentas ?? []).map((c: { nombre: string; tipo: string; es_deuda: boolean; saldo_inicial: number }) => ({
      nombre: c.nombre,
      tipo: c.tipo,
      es_deuda: c.es_deuda,
      saldo: c.saldo_inicial,
    })),
  }

  let prompt = ''
  if (tipo === 'insights') {
    prompt = `Eres un asesor financiero personal. Analiza estos datos financieros del usuario para ${resumen.periodo} y proporciona insights accionables en español.

Datos:
${JSON.stringify(resumen, null, 2)}

Proporciona:
1. **Resumen ejecutivo** (2-3 oraciones sobre el estado financiero general)
2. **Gastos hormiga detectados** (gastos pequeños frecuentes que suman mucho — lista con monto estimado mensual)
3. **Categorías con mayor gasto** (top 3 con análisis)
4. **Alertas** (patrones preocupantes, si los hay)
5. **Recomendaciones concretas** (3-5 acciones específicas para mejorar)

Sé directo, específico y usa los números reales del usuario. Responde en español.`
  } else if (tipo === 'categorizar') {
    prompt = `Categoriza esta transacción bancaria en una de estas categorías y responde SOLO con el nombre de la categoría (sin explicación):

Categorías disponibles: Salario, Freelance, Inversiones, Vivienda, Alimentación, Transporte, Salud, Educación, Entretenimiento, Servicios, Ventas, Planilla, Proveedores, Renta, Publicidad, Impuestos, Otros

Transacción: "${descripcion}"

Responde únicamente con el nombre de la categoría.`
  }

  const message = await anthropic.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })

  const texto = message.content[0].type === 'text' ? message.content[0].text : ''

  if (tipo === 'insights') {
    await admin.from('ai_insights').upsert({
      user_id: user.id,
      anio,
      mes,
      tipo: 'insights',
      contenido: texto,
      generado_en: new Date().toISOString(),
    }, { onConflict: 'user_id,anio,mes,tipo' })
  }

  return NextResponse.json({ texto })
}

import Link from 'next/link'
import { formatCurrency, formatDate } from '@/lib/utils'
import { ArrowUpRight, ArrowDownRight } from 'lucide-react'

interface Movimiento {
  id: string; tipo: 'ingreso' | 'egreso'; monto: number
  descripcion: string; fecha: string
  categorias: { nombre: string; color: string } | null
}

export default function UltimosMovimientos({
  movimientos, anio, mes, scope,
}: {
  movimientos: Movimiento[]
  anio: number; mes: number; scope: string
}) {
  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
        <h2 className="font-bold text-white">Últimos movimientos</h2>
        <Link href={`/dashboard/movimientos?scope=${scope}&anio=${anio}&mes=${mes}`}
          className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
          Ver todos →
        </Link>
      </div>
      {movimientos.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto mb-3">
            <ArrowUpRight className="w-5 h-5 text-slate-600" />
          </div>
          <p className="text-slate-500 text-sm">No hay movimientos este mes</p>
          <p className="text-slate-600 text-xs mt-1">Agrega tu primer movimiento</p>
        </div>
      ) : (
        <ul>
          {movimientos.map((m, i) => (
            <li key={m.id} className={`flex items-center justify-between px-6 py-3.5 hover:bg-slate-800/50 transition-colors ${i < movimientos.length - 1 ? 'border-b border-slate-800/50' : ''}`}>
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                  m.tipo === 'ingreso' ? 'bg-emerald-500/15' : 'bg-red-500/15'
                }`}>
                  {m.tipo === 'ingreso'
                    ? <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                    : <ArrowDownRight className="w-4 h-4 text-red-400" />
                  }
                </div>
                <div>
                  <p className="text-sm font-semibold text-white leading-tight">{m.descripcion}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {m.categorias && (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: m.categorias.color }} />
                        <span className="text-xs text-slate-500">{m.categorias.nombre}</span>
                        <span className="text-slate-700">·</span>
                      </>
                    )}
                    <span className="text-xs text-slate-500">{formatDate(m.fecha)}</span>
                  </div>
                </div>
              </div>
              <span className={`text-sm font-bold tabular-nums ${m.tipo === 'ingreso' ? 'text-emerald-400' : 'text-red-400'}`}>
                {m.tipo === 'ingreso' ? '+' : '-'}{formatCurrency(m.monto)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

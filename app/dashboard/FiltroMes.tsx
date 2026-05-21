'use client'

import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export default function FiltroMes({ anio, mes, scope }: { anio: number; mes: number; scope: string }) {
  const router = useRouter()

  function nav(delta: number) {
    let m = mes + delta, a = anio
    if (m < 1)  { m = 12; a-- }
    if (m > 12) { m = 1;  a++ }
    router.push(`?anio=${a}&mes=${m}&scope=${scope}`)
  }

  return (
    <div className="flex gap-1">
      <button onClick={() => nav(-1)} className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors">
        <ChevronLeft className="w-4 h-4 text-slate-300" />
      </button>
      <button onClick={() => nav(1)} className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors">
        <ChevronRight className="w-4 h-4 text-slate-300" />
      </button>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import NuevoMovimientoModal from './NuevoMovimientoModal'

export default function NuevoMovimientoButton({ scope }: { scope: 'personal' | 'negocio' }) {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors"
      >
        <Plus className="w-4 h-4" />
        Nuevo
      </button>
      {open && (
        <NuevoMovimientoModal
          scope={scope}
          onClose={() => setOpen(false)}
          onSaved={() => { setOpen(false); router.refresh() }}
        />
      )}
    </>
  )
}

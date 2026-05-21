'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { TrendingUp, ArrowLeftRight, PiggyBank, LogOut, Wallet, Target } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

const links = [
  { href: '/dashboard',              label: 'Resumen',      icon: TrendingUp,     exact: true },
  { href: '/dashboard/movimientos',  label: 'Movimientos',  icon: ArrowLeftRight },
  { href: '/dashboard/presupuestos', label: 'Presupuestos', icon: PiggyBank },
  { href: '/dashboard/cuentas',      label: 'Cuentas',      icon: Wallet },
  { href: '/dashboard/metas',        label: 'Metas',        icon: Target },
]

export default function Navbar({ email }: { email: string }) {
  const pathname = usePathname()
  const router   = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  return (
    <header className="bg-slate-950 border-b border-slate-800 sticky top-0 z-10">
      {/* Top bar */}
      <div className="max-w-6xl mx-auto px-4 flex items-center justify-between h-14">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center shadow-lg shadow-indigo-900/50">
            <TrendingUp className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-white tracking-tight">
            fin<span className="text-indigo-400">ance</span>
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-600 hidden sm:block">{email}</span>
          <button onClick={handleLogout}
            className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-slate-800 transition-colors">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Nav links — horizontal scroll on mobile */}
      <div className="border-t border-slate-800/60 overflow-x-auto scrollbar-none">
        <nav className="flex items-center gap-1 px-4 max-w-6xl mx-auto">
          {links.map(l => {
            const active = l.exact ? pathname === l.href : pathname.startsWith(l.href)
            return (
              <Link key={l.href} href={l.href}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap shrink-0',
                  active
                    ? 'text-white border-b-2 border-indigo-500'
                    : 'text-slate-400 hover:text-white'
                )}
              >
                <l.icon className="w-3.5 h-3.5" />
                {l.label}
              </Link>
            )
          })}
        </nav>
      </div>
    </header>
  )
}

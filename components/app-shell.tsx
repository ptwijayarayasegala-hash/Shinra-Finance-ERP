'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Building2,
  FileText,
  LayoutDashboard,
  LogOut,
  Paperclip,
  ShoppingCart,
  TrendingUp,
} from 'lucide-react'
import { useMembership } from '@/contexts/membership-context'
import { createClient } from '@/lib/supabase/browser'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

const navigation = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/invoices', label: 'Invoice', icon: FileText },
  { href: '/purchase-orders', label: 'Purchase Order', icon: ShoppingCart },
  { href: '/cashflow', label: 'Cashflow', icon: TrendingUp },
  { href: '/documents', label: 'Dokumen', icon: Paperclip },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, memberships, activeCompany, setActiveCompanyId } = useMembership()
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="flex flex-col min-h-screen bg-stone-50 lg:flex-row">
      {/* Mobile Header */}
      <header className="sticky top-0 z-40 flex w-full items-center justify-between border-b border-stone-200 bg-white/80 px-4 py-3 backdrop-blur lg:hidden">
        <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
          {activeCompany ? (
            <span
              className="size-3 shrink-0 rounded-full"
              style={{ backgroundColor: activeCompany.color }}
            />
          ) : (
            <Building2 className="size-4 shrink-0 text-stone-500" />
          )}
          <span className="text-sm font-semibold tracking-tight text-stone-900 truncate">
            {activeCompany?.name || 'Pilih Company'}
          </span>
        </div>
      </header>

      {/* Mobile Company Switcher */}
      {memberships.length > 0 && (
        <div className="flex w-full gap-2 overflow-x-auto border-b border-stone-200 bg-white px-4 py-2 lg:hidden hide-scrollbar touch-pan-x overscroll-x-contain">
          {memberships.map((membership) => {
            const isActive = activeCompany?.id === membership.company_id
            return (
              <button
                key={membership.id}
                type="button"
                onClick={() => setActiveCompanyId(membership.company_id)}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                  isActive
                    ? 'border-stone-950 bg-stone-950 text-white'
                    : 'border-stone-200 bg-stone-50 text-stone-600 hover:border-stone-300'
                )}
              >
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: membership.company.color }}
                />
                {membership.company.name}
              </button>
            )
          })}
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-50 lg:flex lg:w-72 lg:flex-col lg:border-r lg:border-stone-200 lg:bg-white lg:p-6 lg:shadow-sm">
        <div className="flex flex-col gap-6 h-full">
          {/* Brand */}
          <div className="inline-flex items-center gap-2 rounded-lg border border-black/10 bg-stone-100 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-stone-700">
            Shinra Finance
          </div>

          {/* User Profile */}
          <div className="rounded-[1.25rem] border border-stone-200 bg-stone-50/50 p-4">
            <p className="text-sm font-semibold text-stone-900 mb-0.5">{user?.name}</p>
            <p className="text-xs text-stone-500 mb-4 truncate">{user?.email}</p>

            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-stone-400 mb-2">
              Company Aktif
            </p>
            <div className="flex flex-col gap-1.5">
              {memberships.map((membership) => {
                const isActive = activeCompany?.id === membership.company_id
                return (
                  <button
                    key={membership.id}
                    type="button"
                    onClick={() => setActiveCompanyId(membership.company_id)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium transition-colors',
                      isActive
                        ? 'bg-stone-950 text-white'
                        : 'text-stone-600 hover:bg-stone-200/50'
                    )}
                  >
                    <span
                      className="size-2 rounded-full"
                      style={{ backgroundColor: membership.company.color }}
                    />
                    <span className="truncate">{membership.company.name}</span>
                    {membership.company.prefix && (
                      <span className={cn('ml-auto text-[10px] font-bold tracking-wide', isActive ? 'text-stone-400' : 'text-stone-400')}>
                        {membership.company.prefix}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 mt-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-stone-400 mb-3 ml-1">
              Menu Utama
            </p>
            {navigation.map((item) => {
              const isActive = pathname.startsWith(item.href)
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-stone-100 text-stone-900 shadow-sm'
                      : 'text-stone-600 hover:bg-stone-100/50 hover:text-stone-950'
                  )}
                >
                  <Icon className={cn('size-4', isActive ? 'text-stone-900' : 'text-stone-400')} />
                  {item.label}
                </Link>
              )
            })}
          </nav>

          {/* Logout */}
          <div className="mt-auto pt-4 border-t border-stone-100">
            <Button
              type="button"
              variant="ghost"
              className="w-full justify-start text-stone-600 hover:text-red-700 hover:bg-red-50 gap-3"
              onClick={handleLogout}
            >
              <LogOut className="size-4" />
              Keluar Sesi
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-screen w-full lg:pl-72 pt-safe pb-28 lg:pb-0">
        <div className="p-4 sm:p-6 lg:p-8">{children}</div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-stone-200 bg-white/95 pb-safe pt-2 backdrop-blur-md lg:hidden shadow-[0_-4px_24px_rgba(0,0,0,0.04)]">
        {navigation.map((item) => {
          const isActive = pathname.startsWith(item.href)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-1 flex-col items-center gap-0.5 px-1 py-2 text-[10px] font-medium transition-all',
                isActive ? 'text-stone-950 font-semibold' : 'text-stone-500 hover:text-stone-900'
              )}
            >
              <div
                className={cn(
                  'flex items-center justify-center rounded-full p-1.5 transition-colors',
                  isActive ? 'bg-stone-100' : 'bg-transparent'
                )}
              >
                <Icon className={cn('size-5', isActive ? 'text-stone-950' : 'text-stone-400')} />
              </div>
              <span>{item.label}</span>
            </Link>
          )
        })}
        <button
          type="button"
          onClick={handleLogout}
          className="flex flex-1 flex-col items-center gap-0.5 px-1 py-1 text-[10px] font-medium text-stone-500 hover:text-red-600 transition-all group"
        >
          <div className="flex items-center justify-center rounded-full p-1.5 bg-transparent transition-colors group-hover:bg-red-50">
            <LogOut className="size-5 text-stone-400 group-hover:text-red-600" />
          </div>
          <span>Keluar</span>
        </button>
      </nav>
    </div>
  )
}

import type { Metadata, Viewport } from 'next'
import { Inter, Manrope } from 'next/font/google'
import './globals.css'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/server'
import { MembershipProvider } from '@/contexts/membership-context'
import type { UserProfile, Membership } from '@/lib/types'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })
const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope' })

export const metadata: Metadata = {
  title: 'Shinra Finance',
  description: 'Finance Management — Invoice, PO, Cashflow',
}

export const viewport: Viewport = {
  themeColor: '#171717',
  width: 'device-width',
  initialScale: 1,
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let userProfile: UserProfile | null = null
  let memberships: Membership[] = []

  if (user) {
    const [profileResult, membershipsResult] = await Promise.all([
      supabase
        .schema('core')
        .from('users')
        .select('id, name, email, is_super_admin')
        .eq('id', user.id)
        .single(),
      supabase
        .schema('core')
        .from('user_memberships')
        .select(
          `
          id,
          company_id,
          jabatan,
          is_active,
          company:companies (
            id,
            name,
            color,
            type,
            logo_url,
            prefix
          )
        `
        )
        .eq('user_id', user.id)
        .eq('is_active', true),
    ])

    if (profileResult.data) {
      userProfile = profileResult.data as UserProfile

      if (userProfile.is_super_admin) {
        const { data: allCompanies } = await supabase
          .schema('core')
          .from('companies')
          .select('id, name, color, type, logo_url, prefix')
          .eq('is_active', true)

        if (allCompanies) {
          memberships = allCompanies.map((c) => ({
            id: `virtual-admin-${c.id}`,
            company_id: c.id,
            jabatan: 'Super Admin',
            is_active: true,
            company: c,
          })) as unknown as Membership[]
        }
      } else if (membershipsResult.data) {
        memberships = membershipsResult.data as unknown as Membership[]
      }
    }
  }

  return (
    <html lang="id" className={cn('h-full antialiased', inter.variable, manrope.variable)}>
      <body className="min-h-full flex flex-col font-sans">
        <MembershipProvider user={userProfile} memberships={memberships}>
          {children}
        </MembershipProvider>
      </body>
    </html>
  )
}

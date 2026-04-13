import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

interface AccessContext {
  userId: string
  isSuperAdmin: boolean
  membershipCompanyIds: string[]
}

type MembershipRow = {
  company_id: string
}

export async function getAccessContext(): Promise<AccessContext> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const [profileResult, membershipsResult] = await Promise.all([
    supabase.schema('core').from('users').select('id, is_super_admin').eq('id', user.id).single(),
    supabase
      .schema('core')
      .from('user_memberships')
      .select('company_id')
      .eq('user_id', user.id)
      .eq('is_active', true),
  ])

  return {
    userId: user.id,
    isSuperAdmin: profileResult.data?.is_super_admin ?? false,
    membershipCompanyIds: ((membershipsResult.data ?? []) as MembershipRow[]).map(
      (m) => m.company_id
    ),
  }
}

export async function getAllowedCompanyOptions(access: AccessContext) {
  const supabase = await createClient()
  let query = supabase
    .schema('core')
    .from('companies')
    .select('id, name, color, type, logo_url, prefix')
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (!access.isSuperAdmin) {
    query = query.in('id', access.membershipCompanyIds)
  }

  const { data } = await query
  return data ?? []
}

export function validateCompanyAccess(access: AccessContext, companyId: string) {
  if (access.isSuperAdmin) return { ok: true as const }

  if (!access.membershipCompanyIds.includes(companyId)) {
    return {
      ok: false as const,
      message: 'Kamu tidak punya akses ke company ini.',
    }
  }

  return { ok: true as const }
}

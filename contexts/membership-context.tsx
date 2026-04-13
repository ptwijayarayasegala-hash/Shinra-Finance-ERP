'use client'

import { createContext, useContext, useState } from 'react'
import type { UserProfile, Membership, Company } from '@/lib/types'

interface MembershipContextValue {
  user: UserProfile | null
  memberships: Membership[]
  activeCompany: Company | null
  setActiveCompanyId: (id: string) => void
}

const MembershipContext = createContext<MembershipContextValue>({
  user: null,
  memberships: [],
  activeCompany: null,
  setActiveCompanyId: () => {},
})

export function useMembership() {
  return useContext(MembershipContext)
}

interface Props {
  user: UserProfile | null
  memberships: Membership[]
  children: React.ReactNode
}

export function MembershipProvider({ user, memberships, children }: Props) {
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(
    memberships[0]?.company_id ?? null
  )

  const activeCompany =
    memberships.find((m) => m.company_id === activeCompanyId)?.company ?? null

  return (
    <MembershipContext.Provider
      value={{ user, memberships, activeCompany, setActiveCompanyId }}
    >
      {children}
    </MembershipContext.Provider>
  )
}

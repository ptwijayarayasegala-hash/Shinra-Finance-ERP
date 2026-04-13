export interface UserProfile {
  id: string
  name: string
  email: string
  is_super_admin: boolean
}

export interface Company {
  id: string
  name: string
  color: string
  type: string | null
  logo_url: string | null
  prefix: string | null
}

export interface Membership {
  id: string
  company_id: string
  jabatan: string | null
  is_active: boolean
  company: Company
}

export * from './finance'

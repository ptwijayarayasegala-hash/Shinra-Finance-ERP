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
  // Extended profile fields (fase-6)
  address: string | null
  npwp: string | null
  phone: string | null
  email: string | null
  website: string | null
  bank_name: string | null
  bank_account_number: string | null
  bank_account_name: string | null
  color_secondary: string | null
  color_accent: string | null
  signed_by_name: string | null
  signed_by_title: string | null
}

export interface Membership {
  id: string
  company_id: string
  jabatan: string | null
  is_active: boolean
  company: Company
}

export * from './finance'

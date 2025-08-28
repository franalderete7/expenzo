// Contract entity types
export interface Contract {
  id: number
  unit_id: number
  tenant_id: number
  start_date: string // Date in YYYY-MM-DD format
  end_date: string // Date in YYYY-MM-DD format
  initial_rent_amount: number
  rent_increase_frequency: 'monthly' | 'quarterly' | 'semi-annually' | 'annually'
  status: 'active' | 'expired' | 'renewed'
  created_at: string
  updated_at: string
  currency?: string
  rent_increase_index?: string
  // Joined data
  unit?: {
    id: number
    unit_number: string
    property?: {
      id: number
      name: string
    }
  }
  tenant?: {
    id: number
    name: string
    email?: string
  }
}

export interface ContractFormData {
  unit_id: number
  tenant_id: number
  start_date: string
  end_date: string
  initial_rent_amount: number
  rent_increase_frequency: 'monthly' | 'quarterly' | 'semi-annually' | 'annually'
  status?: 'active' | 'expired' | 'renewed'
  currency?: string
  rent_increase_index?: string
}

export interface CreateContractData {
  unit_id: number
  tenant_id: number
  start_date: string
  end_date: string
  initial_rent_amount: number
  rent_increase_frequency?: 'monthly' | 'quarterly' | 'semi-annually' | 'annually'
  status?: 'active' | 'expired' | 'renewed'
  currency?: string
  rent_increase_index?: string
}

export interface UpdateContractData {
  unit_id?: number
  tenant_id?: number
  start_date?: string
  end_date?: string
  initial_rent_amount?: number
  rent_increase_frequency?: 'monthly' | 'quarterly' | 'semi-annually' | 'annually'
  status?: 'active' | 'expired' | 'renewed'
  currency?: string
  rent_increase_index?: string
}

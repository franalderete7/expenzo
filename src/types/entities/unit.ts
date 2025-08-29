// Unit entity types
export interface Unit {
  id: number
  property_id: number
  unit_number: string
  status: 'occupied' | 'vacant'
  expense_percentage: number
  nis_number?: string
  catastro?: string
  water_account?: string
  gas_account?: string
  electricity_account?: string
  created_at: string
  updated_at: string
  // Joined data
  properties?: {
    id: number
    name: string
    street_address: string
    city: string
  }
  residents?: {
    id: number
    name: string
    email: string
    phone: string
    role: 'owner' | 'tenant'
  }[]
}

export interface UnitFormData {
  property_id: number
  unit_number: string
  status: 'occupied' | 'vacant'
  expense_percentage: number
  nis_number?: string
  catastro?: string
  water_account?: string
  gas_account?: string
  electricity_account?: string
}

export interface CreateUnitData {
  property_id: number
  unit_number: string
  status: 'occupied' | 'vacant'
  expense_percentage: number
  nis_number?: string
  catastro?: string
  water_account?: string
  gas_account?: string
  electricity_account?: string
}

export interface UpdateUnitData {
  unit_number?: string
  status?: 'occupied' | 'vacant'
  expense_percentage?: number
  nis_number?: string
  catastro?: string
  water_account?: string
  gas_account?: string
  electricity_account?: string
}

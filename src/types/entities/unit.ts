// Unit entity types
export interface Unit {
  id: number
  property_id: number
  unit_number: string
  status: 'occupied' | 'vacant'
  expense_percentage: number
  created_at: string
  updated_at: string
  // Joined data
  properties?: {
    id: number
    name: string
    street_address: string
    city: string
  }
}

export interface UnitFormData {
  property_id: number
  unit_number: string
  status: 'occupied' | 'vacant'
  expense_percentage: number
}

export interface CreateUnitData {
  property_id: number
  unit_number: string
  status: 'occupied' | 'vacant'
  expense_percentage: number
}

export interface UpdateUnitData {
  unit_number?: string
  status?: 'occupied' | 'vacant'
  expense_percentage?: number
}

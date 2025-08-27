// Resident entity types
export interface Resident {
  id: number
  name: string
  email?: string
  phone?: string
  role: 'owner' | 'tenant'
  admin_id: number
  property_id?: number  // Direct property relationship!
  unit_id?: number
  created_at: string
  updated_at: string
  // Joined data
  units?: {
    id: number
    unit_number: string
    property_id: number
  }
  properties?: {
    id: number
    name: string
    street_address: string
    city: string
  }
}

export interface ResidentFormData {
  name: string
  email?: string
  phone?: string
  role: 'owner' | 'tenant'
  property_id?: number
  unit_id?: number
}

export interface CreateResidentData {
  name: string
  email?: string
  phone?: string
  role: 'owner' | 'tenant'
  property_id?: number
  unit_id?: number
  admin_id: number
}

export interface UpdateResidentData {
  name?: string
  email?: string
  phone?: string
  role?: 'owner' | 'tenant'
  unit_id?: number
}

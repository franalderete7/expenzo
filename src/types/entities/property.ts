// Property entity types
export interface Property {
  id: number
  name: string
  street_address: string
  city: string
  description?: string
  admin_id: string  // UUID that points to admins.user_id (per current DB)
  created_at: string
  updated_at: string
}

export interface PropertyFormData {
  name: string
  street_address: string
  city: string
  description?: string
}

export interface CreatePropertyData {
  name: string
  street_address: string
  city: string
  description?: string
  admin_id: string
}

export interface UpdatePropertyData {
  name?: string
  street_address?: string
  city?: string
  description?: string
}

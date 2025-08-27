// Admin entity types
export interface Admin {
  id: number
  user_id: string  // UUID that points to auth.users.id
  email: string
  full_name?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface AdminFormData {
  user_id: string
  email: string
  full_name?: string
  is_active?: boolean
}

export interface CreateAdminData {
  user_id: string
  email: string
  full_name?: string
  is_active?: boolean
}

export interface UpdateAdminData {
  email?: string
  full_name?: string
  is_active?: boolean
}

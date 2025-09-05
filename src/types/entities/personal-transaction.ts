export interface PersonalTransaction {
  id: number
  transaction_date: string
  amount: number
  description?: string
  category: string
  admin_id: number
  created_at: string
  property_id?: number
  property?: {
    id: number
    name: string
  }  // For joins
}

export interface PersonalTransactionFormData {
  transaction_date: string
  amount: string  // Keep as string for NumberInput
  description?: string
  category: string
  property_id?: number
}

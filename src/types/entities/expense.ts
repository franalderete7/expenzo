// Expense entity types
export interface Expense {
  id: number
  property_id: number
  expense_type: string
  amount: number
  date: string
  description?: string
  created_at: string
  updated_at?: string
  property?: {
    id: number
    name: string
    street_address: string
    city: string
  }
}

export interface ExpenseFormData {
  property_id: number
  expense_type: string
  amount: number
  date: string
  description?: string
}

export interface ExpenseFilters {
  month?: number
  year?: number
  expense_type?: string
  dateFrom?: string
  dateTo?: string
}

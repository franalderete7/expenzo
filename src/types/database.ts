// Database Types for Expenzo Application
// Import entity types
import type { Unit, Resident, Property, Admin, Expense } from './entities'

// Re-export all entity types
export * from './entities'

// Re-export individual types for backward compatibility
export type { Unit, Resident, Property, Admin, Expense }

export interface ICLValue {
  id: number
  period_date: string
  icl_percentage: number
  source?: string
  created_at: string
}

export interface Contract {
  id: number
  unit_id: number
  tenant_id: number
  start_date: string
  end_date: string
  initial_rent_amount: number
  rent_increase_frequency: 'monthly' | 'quarterly' | 'semi-annually' | 'annually'
  status: 'active' | 'expired' | 'renewed'
  created_at: string
  updated_at: string
}



export interface MonthlyExpenseSummary {
  id: number
  property_id: number
  period_year: number
  period_month: number
  total_expenses: number
  created_at: string
  allocations?: ExpenseAllocation[]
}

export interface ExpenseAllocation {
  id: number
  monthly_expense_summary_id: number
  unit_id: number
  allocated_amount: number
  allocation_percentage: number
  created_at: string
  monthly_summary?: MonthlyExpenseSummary
  unit?: Unit
}

export interface Rent {
  id: number
  contract_id: number
  amount: number
  due_date: string
  status: 'paid' | 'overdue'
  created_at: string
}

export interface Payment {
  id: number
  resident_id: number
  unit_id: number
  rent_id?: number
  expense_allocation_id?: number
  amount: number
  payment_date: string
  payment_method: string
  status: 'paid' | 'partial' | 'overdue'
  created_at: string
}

export interface PersonalTransaction {
  id: number
  admin_id: number  // Points to admins.id
  transaction_date: string
  amount: number
  description?: string
  category: string
  vendor?: string
  created_at: string
}

// Form Types
export interface PropertyFormData {
  name: string
  street_address: string
  city: string
  description: string
}

export interface UnitFormData {
  property_id: number
  unit_number: string
  expense_percentage: number
}

export interface ExpenseFormData {
  property_id: number
  expense_type: string
  amount: number
  date: string
  description?: string
}



export interface ContractFormData {
  unit_id: number
  tenant_id: number
  start_date: string
  end_date: string
  initial_rent_amount: number
  rent_increase_frequency: 'monthly' | 'quarterly' | 'semi-annually' | 'annually'
}

// API Response Types
export interface ApiResponse<T> {
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// Filter and Search Types
export interface PropertyFilters {
  city?: string
  status?: 'occupied' | 'vacant'
  dateFrom?: string
  dateTo?: string
}

export interface PaginationOptions {
  page?: number
  limit?: number
}

// Error Types
export interface ApiError {
  error: string
  status: number
}

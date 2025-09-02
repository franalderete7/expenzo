// Expense Category entity types
export interface ExpenseCategory {
  id: number
  admin_id: number
  name: string
  created_at: string
  updated_at: string
}

export interface CreateExpenseCategoryData {
  name: string
}

export interface UpdateExpenseCategoryData {
  name: string
}

export interface ExpenseCategoryFilters {
  admin_id?: number
}

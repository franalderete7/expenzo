export interface Rent {
  id: number
  contract_id: number
  amount: number
  created_at: string
  period_month: number
  period_year: number
  amount_paid: number
  balance: number
  base_amount?: number
  icl_adjustment_factor?: number
  base_icl_value?: number
  adjustment_icl_value?: number
  is_adjusted?: boolean
  adjustment_period_month?: number
  adjustment_period_year?: number
}

export interface ICLValue {
  id: number
  period_month: number
  period_year: number
  icl_value: number
  created_at: string
  updated_at: string
}


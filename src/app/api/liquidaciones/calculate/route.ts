import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Create admin client for bypassing RLS
function getAdminClient() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { property_id, year, month } = body

    if (!property_id || !year || !month) {
      return NextResponse.json(
        { error: 'property_id, year, and month are required' },
        { status: 400 }
      )
    }

    const adminClient = getAdminClient()

    // First, find the monthly expense summary for this period
    const { data: monthlySummary, error: summaryError } = await adminClient
      .from('monthly_expense_summaries')
      .select('id, total_expenses, property_id, admin_id')
      .eq('property_id', property_id)
      .eq('period_year', year)
      .eq('period_month', month)
      .single()

    if (summaryError && summaryError.code !== 'PGRST116') {
      console.error('Error finding monthly summary:', summaryError)
      return NextResponse.json(
        { error: 'Error finding monthly expense summary' },
        { status: 500 }
      )
    }

    if (!monthlySummary) {
      return NextResponse.json(
        { error: 'No monthly expense summary found for this period. Please create expenses first.' },
        { status: 404 }
      )
    }

    // Check if allocations already exist for this period
    const { data: existingAllocations, error: checkError } = await adminClient
      .from('expense_allocations')
      .select('id, unit_id')
      .eq('monthly_expense_summary_id', monthlySummary.id)

    if (checkError) {
      console.error('Error checking existing allocations:', checkError)
      return NextResponse.json(
        { error: 'Error checking existing allocations' },
        { status: 500 }
      )
    }

    if (existingAllocations && existingAllocations.length > 0) {
      return NextResponse.json(
        { error: 'Expense allocations already exist for this period. Delete existing allocations first if you want to recalculate.' },
        { status: 409 }
      )
    }

    // Get all units for the property
    const { data: units, error: unitsError } = await adminClient
      .from('units')
      .select('id, unit_number, expense_percentage, property_id')
      .eq('property_id', property_id)

    if (unitsError) {
      console.error('Error fetching units:', unitsError)
      return NextResponse.json(
        { error: 'Error fetching units' },
        { status: 500 }
      )
    }

    if (!units || units.length === 0) {
      return NextResponse.json(
        { error: 'No units found for this property' },
        { status: 404 }
      )
    }

    // Calculate allocations for each unit
    const allocations = units.map(unit => {
      const expensePercentage = unit.expense_percentage || 0
      const allocatedAmount = (monthlySummary.total_expenses * expensePercentage) / 100

      return {
        monthly_expense_summary_id: monthlySummary.id,
        unit_id: unit.id,
        allocated_amount: allocatedAmount,
        allocation_percentage: expensePercentage,
        amount_paid: 0,
        status: 'pending'
      }
    })

    // Insert allocations
    const { data: insertedAllocations, error: insertError } = await adminClient
      .from('expense_allocations')
      .insert(allocations)
      .select()

    if (insertError) {
      console.error('Error inserting allocations:', insertError)
      return NextResponse.json(
        { error: 'Error creating expense allocations' },
        { status: 500 }
      )
    }

    // Calculate summary
    const totalAllocated = allocations.reduce((sum, allocation) => sum + allocation.allocated_amount, 0)

    return NextResponse.json({
      success: true,
      message: `Expense allocations calculated successfully for ${units.length} units`,
      data: {
        monthly_summary_id: monthlySummary.id,
        total_expenses: monthlySummary.total_expenses,
        total_allocated: totalAllocated,
        units_count: units.length,
        allocations_created: insertedAllocations?.length || 0
      }
    })

  } catch (error) {
    console.error('Calculate liquidaciones API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

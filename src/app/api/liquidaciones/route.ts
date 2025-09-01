import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

interface RentData {
  id: number
  amount: number
  period_year: number
  period_month: number
  contracts: { unit_id: number; tenant_id: number }[] | { unit_id: number; tenant_id: number }
}

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

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const propertyId = searchParams.get('property_id')
    const year = searchParams.get('year')
    const month = searchParams.get('month')

    if (!propertyId || !year || !month) {
      return NextResponse.json(
        { error: 'property_id, year, and month are required' },
        { status: 400 }
      )
    }

    const adminClient = getAdminClient()

    // Get all units for the property with resident and expense percentage info
    const { data: units, error: unitsError } = await adminClient
      .from('units')
      .select(`
        id,
        unit_number,
        expense_percentage,
        property_id,
        residents (
          id,
          name,
          email,
          role
        ),
        contracts (
          id,
          tenant_id
        )
      `)
      .eq('property_id', propertyId)

    if (unitsError) {
      console.error('Error fetching units:', unitsError)
      return NextResponse.json(
        { error: 'Error fetching units' },
        { status: 500 }
      )
    }

    // Get expense allocations for the period
    const { data: allocations, error: allocationsError } = await adminClient
      .from('expense_allocations')
      .select(`
        id,
        allocated_amount,
        allocation_percentage,
        unit_id,
        monthly_expense_summary_id,
        monthly_expense_summaries!inner (
          period_year,
          period_month,
          total_expenses,
          property_id
        )
      `)
      .eq('monthly_expense_summaries.period_year', year)
      .eq('monthly_expense_summaries.period_month', month)
      .eq('monthly_expense_summaries.property_id', propertyId)

    if (allocationsError) {
      console.error('Error fetching allocations:', allocationsError)
      return NextResponse.json(
        { error: 'Error fetching allocations' },
        { status: 500 }
      )
    }

    // Get rents for the period (only for tenants)
    const { data: rents, error: rentsError } = await adminClient
      .from('rents')
      .select(`
        id,
        amount,
        period_year,
        period_month,
        contracts!inner (
          unit_id,
          tenant_id,
          property_id
        )
      `)
      .eq('period_year', year)
      .eq('period_month', month)
      .eq('contracts.property_id', propertyId)

    if (rentsError) {
      console.error('Error fetching rents:', rentsError)
      return NextResponse.json(
        { error: 'Error fetching rents' },
        { status: 500 }
      )
    }

    // Create allocations map for quick lookup
    const allocationsMap = new Map()
    allocations?.forEach(allocation => {
      allocationsMap.set(allocation.unit_id, allocation)
    })

    // Create rents map for quick lookup
    const rentsMap = new Map()
    ;(rents as RentData[])?.forEach((rent: RentData) => {
      // contracts might be an array, get the first one
      const contract = Array.isArray(rent.contracts) ? rent.contracts[0] : rent.contracts
      rentsMap.set(contract?.unit_id, rent)
    })

    // Combine all data
    const liquidaciones = units?.map(unit => {
      const resident = unit.residents?.[0] // Assuming one resident per unit
      const allocation = allocationsMap.get(unit.id)
      const rent = resident?.role === 'tenant' ? rentsMap.get(unit.id) : null

      return {
        unit_id: unit.id,
        unit_number: unit.unit_number,
        expense_percentage: unit.expense_percentage,
        resident_name: resident?.name,
        resident_email: resident?.email,
        role: resident?.role,
        expense_due: allocation?.allocated_amount,
        rent_due: rent?.amount,
        allocation_id: allocation?.id
      }
    }) || []

    return NextResponse.json({
      data: liquidaciones,
      meta: {
        total_units: liquidaciones.length,
        period: { year: parseInt(year), month: parseInt(month) }
      }
    })

  } catch (error) {
    console.error('Liquidaciones API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

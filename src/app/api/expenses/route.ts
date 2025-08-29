import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Helper function to get admin client for bypassing RLS
function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const supabaseWithToken = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: { Authorization: `Bearer ${token}` },
        },
      }
    )

    const { data: { user }, error: userError } = await supabaseWithToken.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const propertyId = searchParams.get('property_id')
    const month = searchParams.get('month')
    const year = searchParams.get('year')
    const expenseType = searchParams.get('expense_type')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const offset = (page - 1) * limit

    if (!propertyId) {
      return NextResponse.json({ error: 'Property ID is required' }, { status: 400 })
    }

    // Get user's admin record (now we need user_id which is the UUID)
    const { data: adminRecord, error: adminError } = await supabaseWithToken
      .from('admins')
      .select('id, user_id')
      .eq('user_id', user.id)
      .single()

    if (adminError || !adminRecord) {
      console.error('Admin lookup error:', adminError)
      return NextResponse.json({
        error: 'Admin record not found',
        details: `User ID: ${user.id}, Error: ${adminError?.message}`
      }, { status: 404 })
    }

    // Verify user owns the property (now using UUID user_id instead of integer id)
    const { data: property, error: propertyError } = await supabaseWithToken
      .from('properties')
      .select('id')
      .eq('id', propertyId)
      .eq('admin_id', adminRecord.user_id)  // Use UUID user_id instead of integer id
      .single()

    if (propertyError || !property) {
      console.error('Property ownership check failed:', {
        propertyId,
        adminId: adminRecord.user_id,  // Updated to use UUID user_id
        propertyError,
        property
      })
      return NextResponse.json({
        error: 'Property not found or access denied',
        details: `Property ID: ${propertyId}, Admin ID: ${adminRecord.user_id}, Error: ${propertyError?.message}`
      }, { status: 404 })
    }

    // Check if expenses table exists
    try {
      await supabaseWithToken.from('expenses').select('id').limit(1)
    } catch (tableError) {
      console.error('Expenses table check failed:', tableError)
      return NextResponse.json({
        error: 'Expenses table not found',
        details: 'Please create the expenses table first by running the SQL script in Supabase dashboard',
        sql: 'Run the SQL from scripts/create_expenses_table.sql in your Supabase SQL Editor'
      }, { status: 500 })
    }

    // Build query with filters
    let query = supabaseWithToken
      .from('expenses')
      .select(`
        *,
        properties (
          id,
          name,
          street_address,
          city
        )
      `, { count: 'exact' })
      .eq('property_id', propertyId)

    if (month && year) {
      const startDate = new Date(parseInt(year), parseInt(month) - 1, 1)
      const endDate = new Date(parseInt(year), parseInt(month), 0)
      query = query.gte('date', startDate.toISOString().split('T')[0])
      query = query.lte('date', endDate.toISOString().split('T')[0])
    } else if (year) {
      const startDate = new Date(parseInt(year), 0, 1)
      const endDate = new Date(parseInt(year), 11, 31)
      query = query.gte('date', startDate.toISOString().split('T')[0])
      query = query.lte('date', endDate.toISOString().split('T')[0])
    }

    if (expenseType) {
      query = query.eq('expense_type', expenseType)
    }

    const { data: expenses, error, count } = await query
      .range(offset, offset + limit - 1)
      .order('date', { ascending: false })

    if (error) throw error

    // Get monthly total if filtering by month and year
    let monthlyTotal = 0
    if (month && year) {
      const { data: monthlySummary } = await supabaseWithToken
        .from('monthly_expense_summaries')
        .select('total_expenses')
        .eq('property_id', propertyId)
        .eq('period_year', parseInt(year))
        .eq('period_month', parseInt(month))
        .eq('admin_id', adminRecord.user_id)
        .single()

      const fromSummary = monthlySummary?.total_expenses
      const parsedSummary =
        typeof fromSummary === 'string' ? parseFloat(fromSummary) : (fromSummary || 0)

      if (!isNaN(parsedSummary) && parsedSummary > 0) {
        monthlyTotal = parsedSummary
      } else {
        // Fallback: derive from fetched expenses in this response
        const sum = (expenses || []).reduce((acc: number, e: { amount: number | string }) => acc + (Number(e.amount) || 0), 0)
        monthlyTotal = sum
      }
    }

    return NextResponse.json({
      expenses: expenses || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      },
      monthlyTotal
    })
  } catch (error) {
    console.error('Get expenses error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const supabaseWithToken = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: { Authorization: `Bearer ${token}` },
        },
      }
    )

    const { data: { user }, error: userError } = await supabaseWithToken.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { property_id, expense_type, amount, date, description } = body

    if (!property_id || !expense_type || !amount || !date) {
      return NextResponse.json(
        { error: 'Missing required fields: property_id, expense_type, amount, date' },
        { status: 400 }
      )
    }

    // Get user's admin record (now we need user_id which is the UUID)
    const { data: adminRecord, error: adminError } = await supabaseWithToken
      .from('admins')
      .select('id, user_id')
      .eq('user_id', user.id)
      .single()

    if (adminError || !adminRecord) {
      return NextResponse.json({ error: 'Admin record not found' }, { status: 404 })
    }

    // Verify user owns the property (now using UUID user_id instead of integer id)
    const { data: property, error: propertyError } = await supabaseWithToken
      .from('properties')
      .select('id')
      .eq('id', property_id)
      .eq('admin_id', adminRecord.user_id)  // Use UUID user_id instead of integer id
      .single()

    if (propertyError || !property) {
      return NextResponse.json({ error: 'Property not found or access denied' }, { status: 404 })
    }

    // Ensure monthly summary exists (and get id)
    const expenseDate = new Date(date)
    const periodYear = expenseDate.getFullYear()
    const periodMonth = expenseDate.getMonth() + 1

    let monthlySummaryId: number | null = null
    {
      // Use admin client for both querying and updating summaries to avoid RLS issues
      const adminClient = getAdminClient()
      const { data: existingSummary, error: summaryError } = await adminClient
        .from('monthly_expense_summaries')
        .select('id, total_expenses')
        .eq('property_id', property_id)
        .eq('period_year', periodYear)
        .eq('period_month', periodMonth)
        .eq('admin_id', adminRecord.user_id)
        .maybeSingle()

      if (summaryError) {
        console.error('Error querying existing summary:', summaryError, {
          property_id,
          periodYear,
          periodMonth,
          admin_id: adminRecord.user_id
        })
      }

      if (existingSummary?.id) {
        monthlySummaryId = existingSummary.id
        console.log(`✅ Found existing summary ${existingSummary.id} with total ${existingSummary.total_expenses}, monthlySummaryId set to ${monthlySummaryId}, adding ${parseFloat(amount)}`)

        // Update existing summary total by adding this expense's amount
        const newTotal = existingSummary.total_expenses + parseFloat(amount)

        const { error: updateError } = await adminClient
          .from('monthly_expense_summaries')
          .update({
            total_expenses: newTotal
          })
          .eq('id', existingSummary.id)

        if (updateError) {
          console.error('Error updating existing monthly summary total:', updateError, {
            summaryId: existingSummary.id,
            oldTotal: existingSummary.total_expenses,
            amount: parseFloat(amount),
            newTotal
          })
        } else {
          console.log(`Successfully updated summary ${existingSummary.id} total to ${newTotal}`)
        }
      } else {
        console.log(`❌ No existing summary found for property ${property_id}, year ${periodYear}, month ${periodMonth}, admin ${adminRecord.user_id}, monthlySummaryId will be set from new summary`)
        const { data: insertedSummary, error: insertSummaryError } = await adminClient
          .from('monthly_expense_summaries')
          .insert({
            property_id,
            period_year: periodYear,
            period_month: periodMonth,
            total_expenses: parseFloat(amount), // Start with this expense's amount
            admin_id: adminRecord.user_id
          })
          .select('id')
          .single()

        if (!insertSummaryError && insertedSummary?.id) {
          monthlySummaryId = insertedSummary.id
          console.log(`✅ Created new summary ${insertedSummary.id}, monthlySummaryId set to ${monthlySummaryId}`)
        } else {
          console.error('❌ Failed to create new summary:', insertSummaryError, insertedSummary)
        }
      }
    }

    console.log(`📝 Inserting expense with monthly_expense_summary_id: ${monthlySummaryId}`)

    const { data: expense, error } = await supabaseWithToken
      .from('expenses')
      .insert({
        admin_id: adminRecord.id, // INTEGER admins.id
        property_id,
        expense_type,
        amount: parseFloat(amount),
        date,
        description: description || null,
        monthly_expense_summary_id: monthlySummaryId
      })
      .select(`
        *,
        properties (
          id,
          name,
          street_address,
          city
        )
      `)
      .single()

    if (error) throw error

    // Always recompute the monthly summary total from linked expenses
    if (monthlySummaryId) {
      console.log(`🔄 Recomputing total for summary ${monthlySummaryId} after expense creation`)

      const adminClient = getAdminClient()
      const { data: sumRows, error: sumError } = await adminClient
        .from('expenses')
        .select('amount')
        .eq('monthly_expense_summary_id', monthlySummaryId)

      if (sumError) {
        console.error('❌ Error querying expenses for summary recalc on create:', sumError)
      } else {
        console.log(`📊 Found ${sumRows?.length || 0} expenses linked to summary ${monthlySummaryId}`)
        const newTotal = (sumRows || []).reduce((acc: number, r: { amount: number | string }) => acc + Number(r.amount || 0), 0)
        console.log(`💰 Calculated new total: ${newTotal}`)

        const { error: totalUpdateError } = await adminClient
          .from('monthly_expense_summaries')
          .update({ total_expenses: newTotal })
          .eq('id', monthlySummaryId)

        if (totalUpdateError) {
          console.error('❌ Failed to recompute monthly summary total after insert:', totalUpdateError)
        } else {
          console.log(`✅ Successfully updated summary ${monthlySummaryId} total to ${newTotal}`)
        }
      }
    }

    return NextResponse.json({
      expense,
      message: 'Expense created successfully'
    })
  } catch (error) {
    console.error('Create expense error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

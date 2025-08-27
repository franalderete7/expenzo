import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

    return NextResponse.json({
      expenses: expenses || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
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

    const { data: expense, error } = await supabaseWithToken
      .from('expenses')
      .insert({
        property_id,
        expense_type,
        amount: parseFloat(amount),
        date,
        description: description || null
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

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id: expenseId } = await params

    // Get user's admin record
    const { data: adminRecord, error: adminError } = await supabaseWithToken
      .from('admins')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (adminError || !adminRecord) {
      return NextResponse.json({ error: 'Admin record not found' }, { status: 404 })
    }

    const { data: expense, error } = await supabaseWithToken
      .from('expenses')
      .select(`
        *,
        properties (
          id,
          name,
          street_address,
          city
        )
      `)
      .eq('id', expenseId)
      .eq('properties.admin_id', adminRecord.id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
      }
      throw error
    }

    return NextResponse.json({ expense })
  } catch (error) {
    console.error('Get expense error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id: expenseId } = await params
    const body = await request.json()
    const { expense_type, amount, date, description } = body

    if (!expense_type || !amount || !date) {
      return NextResponse.json(
        { error: 'Missing required fields: expense_type, amount, date' },
        { status: 400 }
      )
    }

    // Get user's admin record
    const { data: adminRecord, error: adminError } = await supabaseWithToken
      .from('admins')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (adminError || !adminRecord) {
      return NextResponse.json({ error: 'Admin record not found' }, { status: 404 })
    }

    // First verify the expense exists and belongs to user's property
    const { data: existingExpense, error: fetchError } = await supabaseWithToken
      .from('expenses')
      .select(`
        id,
        property_id,
        properties!inner (
          id,
          admin_id
        )
      `)
      .eq('id', expenseId)
      .single()

    if (fetchError || !existingExpense) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
    }

    // Verify user owns the property
    const { data: property, error: propertyError } = await supabaseWithToken
      .from('properties')
      .select('id')
      .eq('id', existingExpense.property_id)
      .eq('admin_id', adminRecord.id)
      .single()

    if (propertyError || !property) {
      return NextResponse.json({ error: 'Property not found or access denied' }, { status: 404 })
    }

    const { data: updatedExpense, error } = await supabaseWithToken
      .from('expenses')
      .update({
        expense_type,
        amount: parseFloat(amount),
        date,
        description: description || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', expenseId)
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
      expense: updatedExpense,
      message: 'Expense updated successfully'
    })
  } catch (error) {
    console.error('Update expense error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id: expenseId } = await params

    // Get user's admin record
    const { data: adminRecord, error: adminError } = await supabaseWithToken
      .from('admins')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (adminError || !adminRecord) {
      return NextResponse.json({ error: 'Admin record not found' }, { status: 404 })
    }

    // First verify the expense exists and belongs to user's property
    const { data: existingExpense, error: fetchError } = await supabaseWithToken
      .from('expenses')
      .select(`
        id,
        property_id,
        properties!inner (
          id,
          admin_id
        )
      `)
      .eq('id', expenseId)
      .single()

    if (fetchError || !existingExpense) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
    }

    // Verify user owns the property
    const { data: property, error: propertyError } = await supabaseWithToken
      .from('properties')
      .select('id')
      .eq('id', existingExpense.property_id)
      .eq('admin_id', adminRecord.id)
      .single()

    if (propertyError || !property) {
      return NextResponse.json({ error: 'Property not found or access denied' }, { status: 404 })
    }

    const { error } = await supabaseWithToken
      .from('expenses')
      .delete()
      .eq('id', expenseId)

    if (error) throw error

    return NextResponse.json({ message: 'Expense deleted successfully' })
  } catch (error) {
    console.error('Delete expense error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

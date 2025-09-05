import { NextRequest, NextResponse } from 'next/server'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Extract authorization header
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized - No valid authorization header' }, { status: 401 })
    }

    const token = authHeader.substring(7) // Remove 'Bearer ' prefix

    // Create Supabase client with the user's token
    const { createClient } = await import('@supabase/supabase-js')
    const supabaseWithToken = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    )

    // Verify the token by getting the user
    const { data: { user }, error: userError } = await supabaseWithToken.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized - Invalid token' }, { status: 401 })
    }

    // Get admin record
    const { data: adminData, error: adminError } = await supabaseWithToken
      .from('admins')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (adminError || !adminData) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 })
    }

    const { id: transactionId } = await params
    const body = await request.json()
    const { transaction_date, amount, description, category, property_id } = body

    // Validate required fields
    if (!transaction_date || !amount || !category) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Validate category
    const validCategories = ['Edificio', 'Luiggi', 'Nosotros']
    if (!validCategories.includes(category)) {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
    }

    // If category is 'Edificio', property_id is required
    if (category === 'Edificio' && !property_id) {
      return NextResponse.json({ error: 'Property is required for Edificio category' }, { status: 400 })
    }

    // If category is not 'Edificio', property_id should be null
    const finalPropertyId = category === 'Edificio' ? property_id : null

    // If property_id is provided, verify it belongs to the admin
    if (finalPropertyId) {
      const { data: propertyData, error: propertyError } = await supabaseWithToken
        .from('properties')
        .select('id')
        .eq('id', finalPropertyId)
        .eq('admin_id', adminData.id)
        .single()

      if (propertyError || !propertyData) {
        return NextResponse.json({ error: 'Property not found or not owned by admin' }, { status: 404 })
      }
    }

    // Verify transaction belongs to admin
    const { data: existingTransaction, error: fetchError } = await supabaseWithToken
      .from('personal_transactions')
      .select('id')
      .eq('id', transactionId)
      .eq('admin_id', adminData.id)
      .single()

    if (fetchError || !existingTransaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    const { data: transaction, error } = await supabaseWithToken
      .from('personal_transactions')
      .update({
        transaction_date,
        amount: parseFloat(amount),
        description,
        category,
        property_id: finalPropertyId
      })
      .eq('id', transactionId)
      .eq('admin_id', adminData.id)
      .select(`
        *,
        property:properties (
          id,
          name
        )
      `)
      .single()

    if (error) {
      console.error('Error updating personal transaction:', error)
      return NextResponse.json({ error: 'Failed to update transaction' }, { status: 500 })
    }

    return NextResponse.json({ transaction })
  } catch (error) {
    console.error('Error in personal transactions PUT:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Extract authorization header
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized - No valid authorization header' }, { status: 401 })
    }

    const token = authHeader.substring(7) // Remove 'Bearer ' prefix

    // Create Supabase client with the user's token
    const { createClient } = await import('@supabase/supabase-js')
    const supabaseWithToken = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    )

    // Verify the token by getting the user
    const { data: { user }, error: userError } = await supabaseWithToken.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized - Invalid token' }, { status: 401 })
    }

    // Get admin record
    const { data: adminData, error: adminError } = await supabaseWithToken
      .from('admins')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (adminError || !adminData) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 })
    }

    const { id: transactionId } = await params

    // Verify transaction belongs to admin before deleting
    const { data: existingTransaction, error: fetchError } = await supabaseWithToken
      .from('personal_transactions')
      .select('id')
      .eq('id', transactionId)
      .eq('admin_id', adminData.id)
      .single()

    if (fetchError || !existingTransaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    const { error } = await supabaseWithToken
      .from('personal_transactions')
      .delete()
      .eq('id', transactionId)
      .eq('admin_id', adminData.id)

    if (error) {
      console.error('Error deleting personal transaction:', error)
      return NextResponse.json({ error: 'Failed to delete transaction' }, { status: 500 })
    }

    return NextResponse.json({ message: 'Transaction deleted successfully' })
  } catch (error) {
    console.error('Error in personal transactions DELETE:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const month = searchParams.get('month')
    const year = searchParams.get('year')
    const category = searchParams.get('category')

    let query = supabaseWithToken
      .from('personal_transactions')
      .select(`
        *,
        property:properties (
          id,
          name
        )
      `)
      .eq('admin_id', adminData.id)
      .order('transaction_date', { ascending: false })

    // Apply filters
    if (month && year) {
      const startDate = `${year}-${month.padStart(2, '0')}-01`
      const nextMonth = parseInt(month) === 12 ? 1 : parseInt(month) + 1
      const nextYear = parseInt(month) === 12 ? parseInt(year) + 1 : parseInt(year)
      const endDate = `${nextYear}-${nextMonth.toString().padStart(2, '0')}-01`

      query = query
        .gte('transaction_date', startDate)
        .lt('transaction_date', endDate)
    }

    if (category) {
      query = query.eq('category', category)
    }

    const { data: transactions, error } = await query

    if (error) {
      console.error('Error fetching personal transactions:', error)
      return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 })
    }

    // Calculate total
    const total = transactions?.reduce((sum, transaction) => sum + Number(transaction.amount), 0) || 0

    return NextResponse.json({
      transactions: transactions || [],
      total
    })
  } catch (error) {
    console.error('Error in personal transactions GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
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
        .eq('admin_id', user.id)
        .single()

      if (propertyError || !propertyData) {
        return NextResponse.json({ error: 'Property not found or not owned by admin' }, { status: 404 })
      }
    }

    const { data: transaction, error } = await supabaseWithToken
      .from('personal_transactions')
      .insert({
        transaction_date,
        amount: parseFloat(amount),
        description,
        category,
        admin_id: adminData.id,
        property_id: finalPropertyId
      })
      .select(`
        *,
        property:properties (
          id,
          name
        )
      `)
      .single()

    if (error) {
      console.error('Error creating personal transaction:', error)
      return NextResponse.json({ error: 'Failed to create transaction' }, { status: 500 })
    }

    return NextResponse.json({ transaction })
  } catch (error) {
    console.error('Error in personal transactions POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

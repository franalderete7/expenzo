import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    // Extract authorization header
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('Units API: No authorization header or invalid format')
      return NextResponse.json(
        { error: 'Unauthorized - No valid authorization header' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7) // Remove 'Bearer ' prefix
    console.log('Units API: Token extracted, length:', token.length)

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

    // Get current user
    console.log('Units API: Attempting to get user...')
    const { data: { user }, error: userError } = await supabaseWithToken.auth.getUser()

    if (userError) {
      console.log('Units API: User error:', userError)
      return NextResponse.json(
        { error: 'Unauthorized - User authentication failed', details: userError.message },
        { status: 401 }
      )
    }

    if (!user) {
      console.log('Units API: No user found')
      return NextResponse.json(
        { error: 'Unauthorized - No user data' },
        { status: 401 }
      )
    }

    console.log('Units API: User authenticated successfully:', user.id)

    const { searchParams } = new URL(request.url)
    const propertyId = searchParams.get('property_id')
    const status = searchParams.get('status')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = (page - 1) * limit

    // Build query - only show units from user's properties
    let query = supabaseWithToken
      .from('units')
      .select(`
        *,
        properties (
          id,
          name,
          street_address,
          city
        ),
        residents (
          id,
          name,
          email,
          phone,
          role
        )
      `, { count: 'exact' })

    // Filter by user's properties
    console.log('Units API: Fetching user properties for user UUID:', user.id)
    const { data: userProperties } = await supabaseWithToken
      .from('properties')
      .select('id')
      .eq('admin_id', user.id)

    const propertyIds = userProperties?.map(p => p.id) || []
    console.log('Units API: Found', propertyIds.length, 'user properties')
    query = query.in('property_id', propertyIds)

    // Apply optional filters
    if (propertyId) {
      query = query.eq('property_id', propertyId)
    }

    if (status) {
      query = query.eq('status', status)
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1).order('unit_number')

    const { data: units, error, count } = await query

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      units,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    })
  } catch (error) {
    console.error('Get units error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // Extract authorization header
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('Units POST: No authorization header or invalid format')
      return NextResponse.json(
        { error: 'Unauthorized - No valid authorization header' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7) // Remove 'Bearer ' prefix
    console.log('Units POST: Token extracted, length:', token.length)

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

    // Get current user
    console.log('Units POST: Attempting to get user...')
    const { data: { user }, error: userError } = await supabaseWithToken.auth.getUser()

    if (userError) {
      console.log('Units POST: User error:', userError)
      return NextResponse.json(
        { error: 'Unauthorized - User authentication failed', details: userError.message },
        { status: 401 }
      )
    }

    if (!user) {
      console.log('Units POST: No user found')
      return NextResponse.json(
        { error: 'Unauthorized - No user data' },
        { status: 401 }
      )
    }

    console.log('Units POST: User authenticated successfully:', user.id)

    const body = await request.json()
    const { property_id, unit_number, expense_percentage } = body

    // Verify user owns the property
    const { data: property, error: propertyError } = await supabaseWithToken
      .from('properties')
      .select('id')
      .eq('id', property_id)
      .eq('admin_id', user.id)
      .single()

    if (propertyError || !property) {
      return NextResponse.json(
        { error: 'Property not found or access denied' },
        { status: 404 }
      )
    }

    // Lookup admin (INTEGER id) to store on units.admin_id
    const { data: adminRecord, error: adminError } = await supabaseWithToken
      .from('admins')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (adminError || !adminRecord) {
      return NextResponse.json({ error: 'Admin record not found' }, { status: 404 })
    }

    // Create the unit
    const { data: unit, error } = await supabaseWithToken
      .from('units')
      .insert({
        admin_id: adminRecord.id,
        property_id,
        unit_number,
        expense_percentage,
        status: 'vacant'
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

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      unit,
      message: `Unit ${unit_number} created successfully`
    })
  } catch (error) {
    console.error('Create unit error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

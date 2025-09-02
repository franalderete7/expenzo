import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = (page - 1) * limit

    // Extract authorization header
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('Properties API: No authorization header or invalid format')
      return NextResponse.json(
        { error: 'Unauthorized - No valid authorization header' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7) // Remove 'Bearer ' prefix
    console.log('Properties API: Token extracted, length:', token.length)

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
    console.log('Properties API: Attempting to get user...')
    const { data: { user }, error: userError } = await supabaseWithToken.auth.getUser()

    if (userError) {
      console.log('Properties API: User error:', userError)
      return NextResponse.json(
        { error: 'Unauthorized - User authentication failed', details: userError.message },
        { status: 401 }
      )
    }

    if (!user) {
      console.log('Properties API: No user found')
      return NextResponse.json(
        { error: 'Unauthorized - No user data' },
        { status: 401 }
      )
    }

    console.log('Properties API: User authenticated successfully:', user.id)

    // Get admin record for the current user
    console.log('Properties API: Looking up admin record for user:', user.id)
    const { data: adminRecord, error: adminError } = await supabaseWithToken
      .from('admins')
      .select('id, user_id') // Need both id and user_id
      .eq('user_id', user.id)
      .single()

    if (adminError) {
      console.log('Properties API: Admin lookup error:', adminError)
      return NextResponse.json(
        { error: 'Admin record not found', details: adminError.message },
        { status: 404 }
      )
    }

    if (!adminRecord) {
      console.log('Properties API: No admin record found for user:', user.id)
      return NextResponse.json(
        { error: 'Admin record not found - no data returned' },
        { status: 404 }
      )
    }

    console.log('Properties API: Admin record found - ID:', adminRecord.id, 'User ID:', adminRecord.user_id)

    // Get properties owned by the current admin (properties.admin_id holds user.id UUID per current DB)
    console.log('Properties API: Fetching properties for user UUID:', user.id)
    const { data: properties, error, count } = await supabaseWithToken
      .from('properties')
      .select('*', { count: 'exact' })
      .eq('admin_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('Properties fetch error:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      data: properties || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    })
  } catch (error) {
    console.error('Properties API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, street_address, city, description } = body

    // Extract authorization header
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('Properties POST: No authorization header or invalid format')
      return NextResponse.json(
        { error: 'Unauthorized - No valid authorization header' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7) // Remove 'Bearer ' prefix
    console.log('Properties POST: Token extracted, length:', token.length)

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
    console.log('Properties POST: Attempting to get user...')
    const { data: { user }, error: userError } = await supabaseWithToken.auth.getUser()

    if (userError) {
      console.log('Properties POST: User error:', userError)
      return NextResponse.json(
        { error: 'Unauthorized - User authentication failed', details: userError.message },
        { status: 401 }
      )
    }

    if (!user) {
      console.log('Properties POST: No user found')
      return NextResponse.json(
        { error: 'Unauthorized - No user data' },
        { status: 401 }
      )
    }

    console.log('Properties POST: User authenticated successfully:', user.id)

    // Get admin record for the current user
    console.log('Properties POST: Looking up admin record for user:', user.id)
    const { data: adminRecord, error: adminError } = await supabaseWithToken
      .from('admins')
      .select('id, user_id') // Need both id and user_id
      .eq('user_id', user.id)
      .single()

    if (adminError) {
      console.log('Properties POST: Admin lookup error:', adminError)
      return NextResponse.json(
        { error: 'Admin record not found', details: adminError.message },
        { status: 404 }
      )
    }

    if (!adminRecord) {
      console.log('Properties POST: No admin record found for user:', user.id)
      return NextResponse.json(
        { error: 'Admin record not found - no data returned' },
        { status: 404 }
      )
    }

    console.log('Properties POST: Admin record found - ID:', adminRecord.id, 'User ID:', adminRecord.user_id)

    // Validate required fields
    if (!name || !street_address || !city) {
      return NextResponse.json(
        { error: 'Name, street address, and city are required' },
        { status: 400 }
      )
    }

    // Create property; properties.admin_id holds user.id UUID per current DB
    console.log('Properties POST: Creating property for user UUID:', user.id)
    const { data: property, error } = await supabaseWithToken
      .from('properties')
      .insert([
        {
          name,
          street_address,
          city,
          description,
          admin_id: user.id,
        },
      ])
      .select()
      .single()

    if (error) {
      console.error('Properties POST: Property creation error:', error)
      return NextResponse.json(
        { error: error.message, details: error.details },
        { status: 400 }
      )
    }

    console.log('Properties POST: Property created successfully:', property?.id)
    return NextResponse.json({
      data: property,
      message: 'Property created successfully',
    })
  } catch (error) {
    console.error('Property creation API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  try {
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const propertyId = searchParams.get('property_id')
    const status = searchParams.get('status')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const offset = (page - 1) * limit

    // Build query - only show units from user's properties
    let query = supabase
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
    const { data: userProperties } = await supabase
      .from('properties')
      .select('id')
      .eq('admin_id', user.id)

    const propertyIds = userProperties?.map(p => p.id) || []
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
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7) // Remove 'Bearer ' prefix

    // Create Supabase client with the user's token
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
    const { data: { user }, error: userError } = await supabaseWithToken.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

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

    // Create the unit
    const { data: unit, error } = await supabaseWithToken
      .from('units')
      .insert({
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

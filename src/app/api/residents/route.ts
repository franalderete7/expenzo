import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// GET all residents for a property
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const propertyId = searchParams.get('property_id')

    if (!propertyId) {
      return NextResponse.json(
        { error: 'Property ID is required' },
        { status: 400 }
      )
    }

    // Verify user owns the property
    const { data: property, error: propertyError } = await supabaseWithToken
      .from('properties')
      .select('id')
      .eq('id', propertyId)
      .eq('admin_id', user.id)
      .single()

    if (propertyError || !property) {
      return NextResponse.json(
        { error: 'Property not found or access denied' },
        { status: 404 }
      )
    }

    // Get residents with pagination - filter by units that belong to this property
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const offset = (page - 1) * limit

    const { data: residents, error, count } = await supabaseWithToken
      .from('residents')
      .select(`
        *,
        units (
          id,
          unit_number,
          property_id
        )
      `, { count: 'exact' })
      .eq('units.property_id', propertyId)
      .range(offset, offset + limit - 1)
      .order('name')

    if (error) throw error

    return NextResponse.json({
      residents,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    })
  } catch (error) {
    console.error('Get residents error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// CREATE a new resident
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
    const { property_id, unit_id, name, email, phone, role } = body

    // Validate required fields
    if (!name || !role) {
      return NextResponse.json(
        { error: 'Missing required fields: name, role' },
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
      return NextResponse.json(
        { error: 'Admin record not found' },
        { status: 404 }
      )
    }

    // If property_id is provided, verify user owns it
    if (property_id) {
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
    }

    // If unit_id is provided, verify it exists and belongs to the property
    if (unit_id) {
      const { data: unit, error: unitError } = await supabaseWithToken
        .from('units')
        .select('id, property_id')
        .eq('id', unit_id)
        .single()

      if (unitError || !unit) {
        return NextResponse.json(
          { error: 'Unit not found' },
          { status: 404 }
        )
      }

      // If property_id was provided, make sure unit belongs to that property
      if (property_id && unit.property_id !== property_id) {
        return NextResponse.json(
          { error: 'Unit does not belong to the specified property' },
          { status: 400 }
        )
      }

      // Check if unit already has a resident
      const { data: existingResident, error: residentCheckError } = await supabaseWithToken
        .from('residents')
        .select('id, name')
        .eq('unit_id', unit_id)
        .single()

      if (existingResident) {
        return NextResponse.json(
          { error: `La unidad ya tiene un residente asignado (${existingResident.name}). Una unidad solo puede tener un residente.` },
          { status: 409 }
        )
      }

      if (residentCheckError && residentCheckError.code !== 'PGRST116') {
        console.error('Error checking for existing resident:', residentCheckError)
        return NextResponse.json(
          { error: 'Error verificando residentes existentes' },
          { status: 500 }
        )
      }
    }

    // Create the resident
    const { data: resident, error } = await supabaseWithToken
      .from('residents')
      .insert({
        property_id: property_id || null,
        unit_id: unit_id || null,
        name,
        email: email || null,
        phone: phone || null,
        role,
        admin_id: adminRecord.id
      })
      .select(`
        *,
        units (
          id,
          unit_number,
          property_id
        ),
        properties (
          id,
          name,
          street_address,
          city
        )
      `)
      .single()

    if (error) throw error

    // If unit_id was provided, update unit status to occupied
    if (unit_id) {
      const { error: updateError } = await supabaseWithToken
        .from('units')
        .update({ status: 'occupied' })
        .eq('id', unit_id)

      if (updateError) {
        console.error('Error updating unit status:', updateError)
        // Don't throw here, resident was created successfully
      }
    }

    return NextResponse.json({
      resident,
      message: 'Resident created successfully'
    })
  } catch (error) {
    console.error('Create resident error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

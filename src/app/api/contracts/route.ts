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
        }
      }
    )

    const { data: { user }, error: userError } = await supabaseWithToken.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const propertyId = searchParams.get('property_id')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const offset = (page - 1) * limit

    if (!propertyId) {
      return NextResponse.json({ error: 'Property ID is required' }, { status: 400 })
    }

    // Get user's admin record
    const { data: adminRecord, error: adminError } = await supabaseWithToken
      .from('admins')
      .select('id, user_id')
      .eq('user_id', user.id)
      .single()

    if (adminError || !adminRecord) {
      return NextResponse.json({
        error: 'Admin record not found',
        details: `User ID: ${user.id}, Error: ${adminError?.message}`
      }, { status: 404 })
    }

    // Verify user owns the property
    const { data: property, error: propertyError } = await supabaseWithToken
      .from('properties')
      .select('id')
      .eq('id', propertyId)
      .eq('admin_id', adminRecord.user_id)
      .single()

    if (propertyError || !property) {
      return NextResponse.json({
        error: 'Property not found or access denied',
        details: `Property ID: ${propertyId}, Admin ID: ${adminRecord.user_id}, Error: ${propertyError?.message}`
      }, { status: 404 })
    }

    // Get contracts for units in this property
    const { data: contracts, error, count } = await supabaseWithToken
      .from('contracts')
      .select(`
        *,
        unit:units (
          id,
          unit_number,
          property:properties (
            id,
            name
          )
        ),
        tenant:residents (
          id,
          name,
          email
        )
      `, { count: 'exact' })
      .eq('unit.property_id', propertyId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('Get contracts error:', error)
      return NextResponse.json({ error: 'Error fetching contracts' }, { status: 500 })
    }

    return NextResponse.json({
      contracts: contracts || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    })
  } catch (error) {
    console.error('Get contracts API error:', error)
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
        }
      }
    )

    const { data: { user }, error: userError } = await supabaseWithToken.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      unit_id,
      tenant_id,
      start_date,
      end_date,
      initial_rent_amount,
      rent_increase_frequency = 'quarterly',
      status = 'active',
      currency,
      rent_increase_index
    } = body

    if (!unit_id || !tenant_id || !start_date || !end_date || !initial_rent_amount) {
      return NextResponse.json(
        { error: 'Missing required fields: unit_id, tenant_id, start_date, end_date, initial_rent_amount' },
        { status: 400 }
      )
    }

    // Get user's admin record
    const { data: adminRecord, error: adminError } = await supabaseWithToken
      .from('admins')
      .select('id, user_id')
      .eq('user_id', user.id)
      .single()

    if (adminError || !adminRecord) {
      return NextResponse.json({ error: 'Admin record not found' }, { status: 404 })
    }

    // Verify user owns the unit (through property)
    const { data: unit, error: unitError } = await supabaseWithToken
      .from('units')
      .select('id, property_id, property:properties!inner(admin_id)')
      .eq('id', unit_id)
      .eq('property.admin_id', adminRecord.user_id)
      .single()

    if (unitError || !unit) {
      return NextResponse.json({ error: 'Unit not found or access denied' }, { status: 404 })
    }

    // Verify tenant belongs to the same property
    const { data: tenant, error: tenantError } = await supabaseWithToken
      .from('residents')
      .select('id')
      .eq('id', tenant_id)
      .eq('property_id', unit.property_id)
      .single()

    if (tenantError || !tenant) {
      return NextResponse.json({ error: 'Tenant not found or does not belong to this property' }, { status: 404 })
    }

    const { data: contract, error } = await supabaseWithToken
      .from('contracts')
      .insert({
        unit_id,
        tenant_id,
        start_date,
        end_date,
        initial_rent_amount: parseFloat(initial_rent_amount),
        rent_increase_frequency,
        status,
        currency: currency || null,
        rent_increase_index: rent_increase_index || null
      })
      .select(`
        *,
        unit:units (
          id,
          unit_number,
          property:properties (
            id,
            name
          )
        ),
        tenant:residents (
          id,
          name,
          email
        )
      `)
      .single()

    if (error) {
      console.error('Create contract error:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({
      contract,
      message: 'Contract created successfully'
    })
  } catch (error) {
    console.error('Create contract API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

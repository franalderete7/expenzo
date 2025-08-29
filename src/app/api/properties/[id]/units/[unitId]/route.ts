import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; unitId: string }> }
) {
  try {
    const { id: propertyId, unitId } = await params

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

    // Verify property belongs to user
    const { error: propertyError } = await supabaseWithToken
      .from('properties')
      .select('id')
      .eq('id', propertyId)
      .eq('admin_id', user.id)
      .single()

    if (propertyError) {
      return NextResponse.json(
        { error: 'Property not found or access denied' },
        { status: 404 }
      )
    }

    // Get specific unit
    const { data: unit, error: unitError } = await supabaseWithToken
      .from('units')
      .select(`
        *,
        residents (
          id,
          name,
          email,
          phone,
          role
        )
      `)
      .eq('id', unitId)
      .eq('property_id', propertyId)
      .single()

    if (unitError) {
      return NextResponse.json(
        { error: 'Unit not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ unit })
  } catch (error) {
    console.error('Get unit error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; unitId: string }> }
) {
  try {
    const { id: propertyId, unitId } = await params

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

    // Verify property belongs to user
    const { error: propertyError } = await supabase
      .from('properties')
      .select('id')
      .eq('id', propertyId)
      .eq('admin_id', user.id)
      .single()

    if (propertyError) {
      return NextResponse.json(
        { error: 'Property not found or access denied' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const {
      unit_number,
      status,
      expense_percentage,
      nis_number,
      catastro,
      water_account,
      gas_account,
      electricity_account
    } = body

    // Validate required fields
    if (!unit_number || !status || expense_percentage === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: unit_number, status, expense_percentage' },
        { status: 400 }
      )
    }

    // Update unit
    const { data: unit, error: updateError } = await supabaseWithToken
      .from('units')
      .update({
        unit_number,
        status,
        expense_percentage,
        nis_number: nis_number || null,
        catastro: catastro || null,
        water_account: water_account || null,
        gas_account: gas_account || null,
        electricity_account: electricity_account || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', unitId)
      .eq('property_id', propertyId)
      .select(`
        *,
        residents (
          id,
          name,
          email,
          phone,
          role
        )
      `)
      .single()

    if (updateError) {
      console.error('Update unit error:', updateError)
      return NextResponse.json(
        { error: 'Failed to update unit' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: 'Unit updated successfully',
      unit
    })
  } catch (error) {
    console.error('Update unit error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; unitId: string }> }
) {
  try {
    const { id: propertyId, unitId } = await params

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

    // Verify property belongs to user
    const { error: propertyError } = await supabaseWithToken
      .from('properties')
      .select('id')
      .eq('id', propertyId)
      .eq('admin_id', user.id)
      .single()

    if (propertyError) {
      return NextResponse.json(
        { error: 'Property not found or access denied' },
        { status: 404 }
      )
    }

    // Delete unit (this will cascade delete related records)
    const { error: deleteError } = await supabaseWithToken
      .from('units')
      .delete()
      .eq('id', unitId)
      .eq('property_id', propertyId)

    if (deleteError) {
      console.error('Delete unit error:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete unit' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: 'Unit deleted successfully'
    })
  } catch (error) {
    console.error('Delete unit error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

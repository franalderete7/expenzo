import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verify property belongs to user
    const { data: property, error: propertyError } = await supabase
      .from('properties')
      .select('id')
      .eq('id', id)
      .eq('admin_id', user.id)
      .single()

    if (propertyError) {
      return NextResponse.json(
        { error: 'Property not found or access denied' },
        { status: 404 }
      )
    }

    // Get units for this property
    const { data: units, error } = await supabase
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
      .eq('property_id', id)
      .order('unit_number')

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({ units })
  } catch (error) {
    console.error('Get property units error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: propertyId } = await params

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verify property belongs to user
    const { data: property, error: propertyError } = await supabase
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

    const body = await request.json()
    const { unit_number, expense_percentage } = body

    // Create the unit
    const { data: unit, error } = await supabase
      .from('units')
      .insert({
        property_id: propertyId,
        unit_number,
        expense_percentage,
        status: 'vacant'
      })
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

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      unit,
      message: `Unit ${unit_number} created successfully in property`
    })
  } catch (error) {
    console.error('Create property unit error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

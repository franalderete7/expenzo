import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// GET a specific resident by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: residentId } = await params

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

    // Get specific resident with unit and property information
    const { data: resident, error } = await supabaseWithToken
      .from('residents')
      .select(`
        *,
        units (
          id,
          unit_number,
          property_id
        )
      `)
      .eq('id', residentId)
      .single()

    if (error) throw error
    if (!resident) {
      return NextResponse.json(
        { error: 'Resident not found' },
        { status: 404 }
      )
    }

    // Verify the property belongs to user (check resident's property_id first, then unit's property_id)
    const propertyIdToVerify = resident.property_id || resident.units?.property_id

    if (propertyIdToVerify) {
      const { data: property, error: propertyError } = await supabaseWithToken
        .from('properties')
        .select('id')
        .eq('id', propertyIdToVerify)
        .eq('admin_id', user.id)
        .single()

      if (propertyError || !property) {
        return NextResponse.json(
          { error: 'Property not found or access denied' },
          { status: 404 }
        )
      }
    }

    return NextResponse.json({ resident })
  } catch (error) {
    console.error('Get resident error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// UPDATE a specific resident by ID
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: residentId } = await params

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

    // First get the resident to verify ownership
    const { data: existingResident, error: fetchError } = await supabaseWithToken
      .from('residents')
      .select(`
        *,
        units (
          id,
          property_id
        )
      `)
      .eq('id', residentId)
      .single()

    if (fetchError || !existingResident) {
      return NextResponse.json(
        { error: 'Resident not found' },
        { status: 404 }
      )
    }

    // Verify the property belongs to user (check resident's property_id first, then unit's property_id)
    const propertyIdToVerify = existingResident.property_id || existingResident.units?.property_id

    if (propertyIdToVerify) {
      const { data: property, error: propertyError } = await supabaseWithToken
        .from('properties')
        .select('id')
        .eq('id', propertyIdToVerify)
        .eq('admin_id', user.id)
        .single()

      if (propertyError || !property) {
        return NextResponse.json(
          { error: 'Property not found or access denied' },
          { status: 404 }
        )
      }
    }

    // If property_id is provided in update, verify user owns it
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

    // If unit_id is provided, verify it exists and belongs to the correct property
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

      // Check if unit belongs to the property being assigned
      const targetPropertyId = property_id || existingResident.property_id
      if (targetPropertyId && unit.property_id !== targetPropertyId) {
        return NextResponse.json(
          { error: 'Unit does not belong to the target property' },
          { status: 400 }
        )
      }

      // Check if unit already has a different resident (only if it's not the same resident)
      if (unit_id !== existingResident.unit_id) {
        const { data: existingResidentInUnit, error: residentCheckError } = await supabaseWithToken
          .from('residents')
          .select('id, name')
          .eq('unit_id', unit_id)
          .neq('id', residentId) // Exclude current resident
          .single()

        if (existingResidentInUnit) {
          return NextResponse.json(
            { error: `La unidad ya tiene un residente asignado (${existingResidentInUnit.name}). Una unidad solo puede tener un residente.` },
            { status: 409 }
          )
        }

        if (residentCheckError && residentCheckError.code !== 'PGRST116') {
          console.error('Error checking for existing resident in unit:', residentCheckError)
          return NextResponse.json(
            { error: 'Error verificando residentes existentes en la unidad' },
            { status: 500 }
          )
        }
      }
    }

    // Update the resident
    const { data: updatedResident, error } = await supabaseWithToken
      .from('residents')
      .update({
        property_id: property_id || null,
        unit_id: unit_id || null,
        name,
        email: email || null,
        phone: phone || null,
        role,
        updated_at: new Date().toISOString()
      })
      .eq('id', residentId)
      .select(`
        *,
        units (
          id,
          unit_number,
          property_id
        )
      `)
      .single()

    if (error) throw error
    if (!updatedResident) {
      return NextResponse.json(
        { error: 'Resident not found or could not be updated' },
        { status: 404 }
      )
    }

    // Handle unit status updates
    const oldUnitId = existingResident.unit_id
    const newUnitId = unit_id

    // If resident had a unit before and now has a different unit or no unit, set old unit to vacant
    if (oldUnitId && oldUnitId !== newUnitId) {
      const { error: oldUnitError } = await supabaseWithToken
        .from('units')
        .update({ status: 'vacant' })
        .eq('id', oldUnitId)

      if (oldUnitError) {
        console.error('Error updating old unit status to vacant:', oldUnitError)
      }
    }

    // If resident now has a unit (that they didn't have before), set new unit to occupied
    if (newUnitId && newUnitId !== oldUnitId) {
      const { error: newUnitError } = await supabaseWithToken
        .from('units')
        .update({ status: 'occupied' })
        .eq('id', newUnitId)

      if (newUnitError) {
        console.error('Error updating new unit status to occupied:', newUnitError)
      }
    }

    return NextResponse.json({
      resident: updatedResident,
      message: 'Resident updated successfully'
    })
  } catch (error) {
    console.error('Update resident error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE a specific resident by ID
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: residentId } = await params

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

    // First get the resident to verify ownership
    const { data: existingResident, error: fetchError } = await supabaseWithToken
      .from('residents')
      .select(`
        *,
        units (
          id,
          property_id
        )
      `)
      .eq('id', residentId)
      .single()

    if (fetchError || !existingResident) {
      return NextResponse.json(
        { error: 'Resident not found' },
        { status: 404 }
      )
    }

    // Verify the property belongs to user (check resident's property_id first, then unit's property_id)
    const propertyIdToVerify = existingResident.property_id || existingResident.units?.property_id

    if (propertyIdToVerify) {
      const { data: property, error: propertyError } = await supabaseWithToken
        .from('properties')
        .select('id')
        .eq('id', propertyIdToVerify)
        .eq('admin_id', user.id)
        .single()

      if (propertyError || !property) {
        return NextResponse.json(
          { error: 'Property not found or access denied' },
          { status: 404 }
        )
      }
    }

    // Delete the resident
    const { error } = await supabaseWithToken
      .from('residents')
      .delete()
      .eq('id', residentId)

    if (error) throw error

    // If resident had a unit assigned, set it back to vacant
    if (existingResident.unit_id) {
      const { error: unitUpdateError } = await supabaseWithToken
        .from('units')
        .update({ status: 'vacant' })
        .eq('id', existingResident.unit_id)

      if (unitUpdateError) {
        console.error('Error updating unit status to vacant after resident deletion:', unitUpdateError)
        // Don't throw here, resident was deleted successfully
      }
    }

    return NextResponse.json({
      message: 'Resident deleted successfully'
    })
  } catch (error) {
    console.error('Delete resident error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

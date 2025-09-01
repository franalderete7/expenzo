import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
        },
      }
    )

    const { data: { user }, error: userError } = await supabaseWithToken.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Get user's admin record
    const { data: adminRecord, error: adminError } = await supabaseWithToken
      .from('admins')
      .select('id, user_id')
      .eq('user_id', user.id)
      .single()

    if (adminError || !adminRecord) {
      return NextResponse.json({ error: 'Admin record not found' }, { status: 404 })
    }

    // Get unit with ownership verification through property
    const { data: unit, error } = await supabaseWithToken
      .from('units')
      .select(`
        *,
        property:properties!inner (
          id,
          name,
          street_address,
          city,
          admin_id
        ),
        residents (
          id,
          name,
          email,
          phone,
          role
        )
      `)
      .eq('id', id)
      .eq('property.admin_id', adminRecord.user_id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Unit not found or access denied' }, { status: 404 })
      }
      return NextResponse.json({ error: error.message }, { status: 400 })
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
  { params }: { params: Promise<{ id: string }> }
) {
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
        },
      }
    )

    const { data: { user }, error: userError } = await supabaseWithToken.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
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

    // Get user's admin record
    const { data: adminRecord, error: adminError } = await supabaseWithToken
      .from('admins')
      .select('id, user_id')
      .eq('user_id', user.id)
      .single()

    if (adminError || !adminRecord) {
      return NextResponse.json({ error: 'Admin record not found' }, { status: 404 })
    }

    // Verify the unit exists and user owns it
    const { data: existingUnit, error: fetchError } = await supabaseWithToken
      .from('units')
      .select(`
        id,
        property:properties!inner (
          admin_id
        )
      `)
      .eq('id', id)
      .eq('property.admin_id', adminRecord.user_id)
      .single()

    if (fetchError || !existingUnit) {
      return NextResponse.json({ error: 'Unit not found or access denied' }, { status: 404 })
    }

    // Prepare update data
    const updateData: Partial<{
      unit_number: string
      status: 'occupied' | 'vacant'
      expense_percentage: number
      nis_number: string | null
      catastro: string | null
      water_account: string | null
      gas_account: string | null
      electricity_account: string | null
      updated_at: string
    }> = {}
    if (unit_number !== undefined) updateData.unit_number = unit_number
    if (status !== undefined) updateData.status = status
    if (expense_percentage !== undefined) updateData.expense_percentage = parseFloat(expense_percentage)
    if (nis_number !== undefined) updateData.nis_number = nis_number || null
    if (catastro !== undefined) updateData.catastro = catastro || null
    if (water_account !== undefined) updateData.water_account = water_account || null
    if (gas_account !== undefined) updateData.gas_account = gas_account || null
    if (electricity_account !== undefined) updateData.electricity_account = electricity_account || null

    updateData.updated_at = new Date().toISOString()

    const { data: unit, error } = await supabaseWithToken
      .from('units')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        property:properties (
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
      `)
      .single()

    if (error) {
      console.error('Update unit error:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({
      unit,
      message: 'Unit updated successfully'
    })
  } catch (error) {
    console.error('Update unit API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
        },
      }
    )

    const { data: { user }, error: userError } = await supabaseWithToken.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Get user's admin record
    const { data: adminRecord, error: adminError } = await supabaseWithToken
      .from('admins')
      .select('id, user_id')
      .eq('user_id', user.id)
      .single()

    if (adminError || !adminRecord) {
      return NextResponse.json({ error: 'Admin record not found' }, { status: 404 })
    }

    // Verify the unit exists and user owns it
    const { data: unit, error: fetchError } = await supabaseWithToken
      .from('units')
      .select(`
        id,
        property:properties!inner (
          admin_id
        )
      `)
      .eq('id', id)
      .eq('property.admin_id', adminRecord.user_id)
      .single()

    if (fetchError || !unit) {
      return NextResponse.json({ error: 'Unit not found or access denied' }, { status: 404 })
    }

    // Delete the unit
    const { error } = await supabaseWithToken
      .from('units')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Delete unit error:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({
      message: 'Unit deleted successfully'
    })
  } catch (error) {
    console.error('Delete unit API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

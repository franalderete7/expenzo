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
        }
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

    // Get contract with ownership verification
    const { data: contract, error } = await supabaseWithToken
      .from('contracts')
      .select(`
        *,
        unit:units (
          id,
          unit_number,
          property:properties!inner (
            id,
            name,
            admin_id
          )
        ),
        tenant:residents (
          id,
          name,
          email
        )
      `)
      .eq('id', id)
      .eq('unit.property.admin_id', adminRecord.user_id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Contract not found or access denied' }, { status: 404 })
      }
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ contract })
  } catch (error) {
    console.error('Get contract error:', error)
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
        }
      }
    )

    const { data: { user }, error: userError } = await supabaseWithToken.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const {
      unit_id,
      tenant_id,
      start_date,
      end_date,
      initial_rent_amount,
      rent_increase_frequency,
      status,
      currency,
      rent_increase_index
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

    // Verify the contract exists and user owns it
    const { data: existingContract, error: fetchError } = await supabaseWithToken
      .from('contracts')
      .select(`
        id,
        unit:units (
          property:properties!inner (
            admin_id
          )
        )
      `)
      .eq('id', id)
      .eq('unit.property.admin_id', adminRecord.user_id)
      .single()

    if (fetchError || !existingContract) {
      return NextResponse.json({ error: 'Contract not found or access denied' }, { status: 404 })
    }

    // Prepare update data
    const updateData: Partial<{
      unit_id: number
      tenant_id: number
      start_date: string
      end_date: string
      initial_rent_amount: number
      rent_increase_frequency: 'monthly' | 'quarterly' | 'semi-annually' | 'annually'
      status: 'active' | 'expired' | 'renewed'
      currency: string | null
      rent_increase_index: string | null
      updated_at: string
    }> = {}
    if (unit_id !== undefined) updateData.unit_id = unit_id
    if (tenant_id !== undefined) updateData.tenant_id = tenant_id
    if (start_date !== undefined) updateData.start_date = start_date
    if (end_date !== undefined) updateData.end_date = end_date
    if (initial_rent_amount !== undefined) updateData.initial_rent_amount = parseFloat(initial_rent_amount)
    if (rent_increase_frequency !== undefined) updateData.rent_increase_frequency = rent_increase_frequency
    if (status !== undefined) updateData.status = status
    if (currency !== undefined) updateData.currency = currency || null
    if (rent_increase_index !== undefined) updateData.rent_increase_index = rent_increase_index || null

    updateData.updated_at = new Date().toISOString()

    const { data: contract, error } = await supabaseWithToken
      .from('contracts')
      .update(updateData)
      .eq('id', id)
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
      console.error('Update contract error:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({
      contract,
      message: 'Contract updated successfully'
    })
  } catch (error) {
    console.error('Update contract API error:', error)
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
        }
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

    // Verify the contract exists and user owns it
    const { data: contract, error: fetchError } = await supabaseWithToken
      .from('contracts')
      .select(`
        id,
        unit:units (
          property:properties!inner (
            admin_id
          )
        )
      `)
      .eq('id', id)
      .eq('unit.property.admin_id', adminRecord.user_id)
      .single()

    if (fetchError || !contract) {
      return NextResponse.json({ error: 'Contract not found or access denied' }, { status: 404 })
    }

    // Delete the contract
    const { error } = await supabaseWithToken
      .from('contracts')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Delete contract error:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({
      message: 'Contract deleted successfully'
    })
  } catch (error) {
    console.error('Delete contract API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

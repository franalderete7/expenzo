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
        },
      }
    )

    const { data: { user }, error: userError } = await supabaseWithToken.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const contractId = searchParams.get('contract_id')
    if (!contractId) {
      return NextResponse.json({ error: 'contract_id is required' }, { status: 400 })
    }

    // Verify contract ownership
    const { data: contract, error: contractError } = await supabaseWithToken
      .from('contracts')
      .select(`id, unit:units!inner(property:properties!inner(admin_id))`)
      .eq('id', contractId)
      .single()

    if (contractError || !contract) {
      return NextResponse.json({ error: 'Contract not found or access denied' }, { status: 404 })
    }

    const { data: rents, error } = await supabaseWithToken
      .from('rents')
      .select('*')
      .eq('contract_id', contractId)
      .order('period_year')
      .order('period_month')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ rents: rents || [] })
  } catch (error) {
    console.error('Get rents error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}



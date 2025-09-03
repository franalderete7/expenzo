import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Helper function to get admin client for bypassing RLS
function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
}

export async function GET() {
  try {
    const adminClient = getAdminClient()

    const { data: ipcValues, error } = await adminClient
      .from('ipc_values')
      .select('*')
      .order('period_year', { ascending: false })
      .order('period_month', { ascending: false })

    if (error) throw error

    return NextResponse.json({ ipcValues: ipcValues || [] })
  } catch (error) {
    console.error('Error fetching IPC values:', error)
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
        },
      }
    )

    const { data: { user }, error: userError } = await supabaseWithToken.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { period_month, period_year, ipc_value } = body

    if (!period_month || !period_year || !ipc_value) {
      return NextResponse.json(
        { error: 'Missing required fields: period_month, period_year, ipc_value' },
        { status: 400 }
      )
    }

    const adminClient = getAdminClient()

    // Check if IPC value already exists for this period
    const { data: existingValue } = await adminClient
      .from('ipc_values')
      .select('id')
      .eq('period_month', period_month)
      .eq('period_year', period_year)
      .maybeSingle()

    if (existingValue) {
      return NextResponse.json(
        { error: 'IPC value already exists for this period' },
        { status: 400 }
      )
    }

    const { data: newValue, error } = await adminClient
      .from('ipc_values')
      .insert({
        period_month,
        period_year,
        ipc_value: parseFloat(ipc_value)
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({
      message: 'IPC value created successfully',
      ipcValue: newValue
    })
  } catch (error) {
    console.error('Error creating IPC value:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

type Frequency = 'monthly' | 'quarterly' | 'semi-annually' | 'annually'

function monthsBetween(startYear: number, startMonth: number, endYear: number, endMonth: number) {
  return (endYear - startYear) * 12 + (endMonth - startMonth)
}

function isAdjustmentMonth(offset: number, frequency: Frequency) {
  switch (frequency) {
    case 'monthly':
      return true
    case 'quarterly':
      return offset % 3 === 0
    case 'semi-annually':
      return offset % 6 === 0
    case 'annually':
      return offset % 12 === 0
    default:
      return false
  }
}

export async function POST(
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

    // Admin
    const { data: adminRecord, error: adminError } = await supabaseWithToken
      .from('admins')
      .select('id, user_id')
      .eq('user_id', user.id)
      .single()

    if (adminError || !adminRecord) {
      return NextResponse.json({ error: 'Admin record not found' }, { status: 404 })
    }

    // Load contract with verification
    const { data: contract, error: contractError } = await supabaseWithToken
      .from('contracts')
      .select(`
        id, unit_id, tenant_id, start_date, end_date, initial_rent_amount,
        rent_increase_frequency, currency, icl_index_type,
        unit:units!inner(
          property_id,
          property:properties!inner(admin_id)
        )
      `)
      .eq('id', id)
      .eq('unit.property.admin_id', adminRecord.user_id)
      .single()
    // Safely extract property_id from unit join (can be object or array)
    function extractPropertyId(u: unknown): number | null {
      if (Array.isArray(u)) {
        const first = u[0] as unknown
        if (first && typeof first === 'object' && 'property_id' in first) {
          const pid = (first as { property_id: number }).property_id
          return Number(pid)
        }
        return null
      }
      if (u && typeof u === 'object' && 'property_id' in u) {
        const pid = (u as { property_id: number }).property_id
        return Number(pid)
      }
      return null
    }
    const propertyIdFromUnit = extractPropertyId((contract as unknown as { unit: unknown }).unit)
    if (!propertyIdFromUnit) {
      return NextResponse.json({ error: 'No se pudo determinar property_id del contrato' }, { status: 400 })
    }


    if (contractError || !contract) {
      return NextResponse.json({ error: 'Contract not found or access denied' }, { status: 404 })
    }

    // Parse dates as plain YYYY-MM-DD to avoid timezone shifts
    const [sYear, sMonth] = contract.start_date.split('-').map((v: string, idx: number) => idx === 1 ? parseInt(v, 10) : parseInt(v, 10))
    const [eYear, eMonth] = contract.end_date.split('-').map((v: string, idx: number) => idx === 1 ? parseInt(v, 10) : parseInt(v, 10))
    const now = new Date()
    const nowYear = now.getFullYear()
    const nowMonth = now.getMonth() + 1

    // Compute cutoff (min of end and now) in year/month space
    const endAfterNow = monthsBetween(eYear, eMonth, nowYear, nowMonth) > 0
    const cutoffYear = endAfterNow ? nowYear : eYear
    const cutoffMonth = endAfterNow ? nowMonth : eMonth
    const startYear = sYear
    const startMonth = sMonth

    const totalMonths = monthsBetween(startYear, startMonth, cutoffYear, cutoffMonth) + 1
    if (totalMonths <= 0) {
      return NextResponse.json({ message: 'No periods to calculate' })
    }

    // Fetch index values based on contract's icl_index_type (use admin client since index data should be global)
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const indexType = contract.icl_index_type || 'ICL'

    // Fetch ICL values if needed (for ICL or Average calculations)
    const iclMap = new Map<string, number>()
    if (indexType === 'ICL' || indexType === 'Average') {
      const { data: icls } = await adminClient
        .from('icl_values')
        .select('period_year, period_month, icl_value')
        .gte('period_year', startYear)
        .lte('period_year', cutoffYear)

      for (const r of icls || []) {
        iclMap.set(`${r.period_year}-${r.period_month}`, Number(r.icl_value))
      }
    }

    // Fetch IPC values if needed (for IPC or Average calculations)
    const ipcMap = new Map<string, number>()
    if (indexType === 'IPC' || indexType === 'Average') {
      const { data: ipcs } = await adminClient
        .from('ipc_values')
        .select('period_year, period_month, ipc_value')
        .gte('period_year', startYear)
        .lte('period_year', cutoffYear)

      for (const r of ipcs || []) {
        ipcMap.set(`${r.period_year}-${r.period_month}`, Number(r.ipc_value))
      }
    }

    const baseKey = `${startYear}-${startMonth}`

    // Get base values for the contract start period
    const baseICL = iclMap.get(baseKey)
    const baseIPC = ipcMap.get(baseKey)

    // Determine base index value based on type
    let baseIndexValue: number | null = null
    if (indexType === 'ICL' && baseICL) {
      baseIndexValue = baseICL
    } else if (indexType === 'IPC' && baseIPC) {
      baseIndexValue = baseIPC
    } else if (indexType === 'Average' && baseICL && baseIPC) {
      baseIndexValue = (baseICL + baseIPC) / 2
    }

    // Get existing rents to preserve paid data and avoid duplicates
    const { data: existingRents } = await supabaseWithToken
      .from('rents')
      .select('id, period_year, period_month, amount_paid')
      .eq('contract_id', contract.id)

    const existingMap = new Map<string, { id: number, amount_paid: number }>()
    for (const r of existingRents || []) {
      existingMap.set(`${r.period_year}-${r.period_month}`, { id: r.id, amount_paid: Number(r.amount_paid || 0) })
    }

    type RentInsert = {
      admin_id: number
      property_id: number
      contract_id: number
      period_month: number
      period_year: number
      amount: number
      amount_paid: number
      base_amount: number
      icl_adjustment_factor: number | null
      base_icl_value: number | null
      adjustment_icl_value: number | null
      is_adjusted: boolean
      adjustment_period_month: number | null
      adjustment_period_year: number | null
    }
    type RentUpdate = RentInsert & { id: number }

    const inserts: RentInsert[] = []
    const updates: RentUpdate[] = []

    const freq = (contract.rent_increase_frequency || 'quarterly') as Frequency
    const baseAmount = Number(contract.initial_rent_amount)

    let lastAdjustedAmount = baseAmount
    for (let i = 0; i < totalMonths; i++) {
      const y = startYear + Math.floor((startMonth - 1 + i) / 12)
      const m = ((startMonth - 1 + i) % 12) + 1
      const key = `${y}-${m}`

      let amount = lastAdjustedAmount
      let icl_adjustment_factor: number | null = null
      let base_icl_value: number | null = null
      let adjustment_icl_value: number | null = null
      let is_adjusted = false
      let adjustment_period_month: number | null = null
      let adjustment_period_year: number | null = null

      if (i === 0) {
        amount = baseAmount
      } else if (isAdjustmentMonth(i, freq) && baseIndexValue) {
        // Calculate adjustment based on index type
        let adjustmentValue: number | null = null
        let currentBaseValue = baseIndexValue

        if (indexType === 'ICL') {
          adjustmentValue = iclMap.get(key) ?? null
          if (adjustmentValue && baseICL) {
            icl_adjustment_factor = adjustmentValue / baseICL
            base_icl_value = baseICL
            adjustment_icl_value = adjustmentValue
          }
        } else if (indexType === 'IPC') {
          adjustmentValue = ipcMap.get(key) ?? null
          if (adjustmentValue && baseIPC) {
            icl_adjustment_factor = adjustmentValue / baseIPC
            base_icl_value = baseIPC  // Using this field to store IPC values for compatibility
            adjustment_icl_value = adjustmentValue
          }
        } else if (indexType === 'Average') {
          const adjICL = iclMap.get(key) ?? null
          const adjIPC = ipcMap.get(key) ?? null
          if (adjICL && adjIPC && baseICL && baseIPC) {
            const avgBase = (baseICL + baseIPC) / 2
            const avgAdjustment = (adjICL + adjIPC) / 2
            icl_adjustment_factor = avgAdjustment / avgBase
            base_icl_value = avgBase  // Store the average base value
            adjustment_icl_value = avgAdjustment  // Store the average adjustment value
            adjustmentValue = avgAdjustment
            currentBaseValue = avgBase
          }
        }

        if (adjustmentValue && currentBaseValue) {
          amount = Math.round(baseAmount * (adjustmentValue / currentBaseValue) * 100) / 100
          is_adjusted = true
          adjustment_period_month = m
          adjustment_period_year = y
          lastAdjustedAmount = amount
        } else {
          // missing index values for target month, keep lastAdjustedAmount
          amount = lastAdjustedAmount
        }
      } else {
        amount = lastAdjustedAmount
      }

      const existing = existingMap.get(key)
      const row: RentInsert = {
        admin_id: Number(adminRecord.id),
        property_id: propertyIdFromUnit,
        contract_id: contract.id,
        period_month: m,
        period_year: y,
        amount,
        amount_paid: existing?.amount_paid ?? 0,
        base_amount: baseAmount,
        icl_adjustment_factor,
        base_icl_value,
        adjustment_icl_value,
        is_adjusted,
        adjustment_period_month,
        adjustment_period_year
      }

      if (existing?.id) {
        updates.push({ id: existing.id, ...row })
      } else {
        inserts.push(row)
      }
    }

    if (inserts.length) {
      const { error: insertError } = await supabaseWithToken
        .from('rents')
        .insert(inserts)
      if (insertError) {
        console.error('Insert rents error:', insertError)
        return NextResponse.json({ error: 'Error inserting rents' }, { status: 500 })
      }
    }

    if (updates.length) {
      for (const u of updates) {
        const { id, ...rest } = u
        const { error: updateError } = await supabaseWithToken
          .from('rents')
          .update(rest)
          .eq('id', id)
        if (updateError) {
          console.error('Update rent error:', updateError)
          return NextResponse.json({ error: 'Error updating rents' }, { status: 500 })
        }
      }
    }

    // Return updated list
    const { data: rents } = await supabaseWithToken
      .from('rents')
      .select('*')
      .eq('contract_id', contract.id)
      .order('period_year')
      .order('period_month')

    return NextResponse.json({ rents })
  } catch (error) {
    console.error('Recalculate rents error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}



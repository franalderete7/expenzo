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

    const { id: expenseId } = await params

    // Get user's admin record
    const { data: adminRecord, error: adminError } = await supabaseWithToken
      .from('admins')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (adminError || !adminRecord) {
      return NextResponse.json({ error: 'Admin record not found' }, { status: 404 })
    }

    const { data: expense, error } = await supabaseWithToken
      .from('expenses')
      .select(`
        *,
        properties (
          id,
          name,
          street_address,
          city
        )
      `)
      .eq('id', expenseId)
      .eq('properties.admin_id', adminRecord.id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
      }
      throw error
    }

    return NextResponse.json({ expense })
  } catch (error) {
    console.error('Get expense error:', error)
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

    const { id: expenseId } = await params
    const body = await request.json()
    const { expense_type, amount, date, description } = body

    if (!expense_type || !amount || !date) {
      return NextResponse.json(
        { error: 'Missing required fields: expense_type, amount, date' },
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

    // First verify the expense exists and belongs to user's property
    const { data: existingExpense, error: fetchError } = await supabaseWithToken
      .from('expenses')
      .select(`
        id,
        property_id,
        amount,
        date,
        monthly_expense_summary_id,
        properties!inner (
          id,
          admin_id
        )
      `)
      .eq('id', expenseId)
      .single()

    if (fetchError || !existingExpense) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
    }

    // Verify user owns the property
    const { data: property, error: propertyError } = await supabaseWithToken
      .from('properties')
      .select('id')
      .eq('id', existingExpense.property_id)
      .eq('admin_id', adminRecord.user_id)
      .single()

    if (propertyError || !property) {
      return NextResponse.json({ error: 'Property not found or access denied' }, { status: 404 })
    }

    console.log(`🔄 Updating HONORARIOS expense ${expenseId} with amount ${amount}, type: ${expense_type}`)

    const { data: updatedExpense, error } = await supabaseWithToken
      .from('expenses')
      .update({
        expense_type,
        amount: parseFloat(amount),
        date,
        description: description || null,
        // admin_id and property_id remain unchanged on update
      })
      .eq('id', expenseId)
      .select(`
        *,
        properties (
          id,
          name,
          street_address,
          city
        )
      `)
      .single()

    if (error) throw error

    // Update monthly expenses summary by moving monthly_expense_summary_id if needed and recalculating totals
    // Derive year/month directly from YYYY-MM-DD string to avoid timezone issues
    const parseYearMonth = (dateStr: string) => {
      const [y, m] = dateStr.split('-')
      return { year: parseInt(y, 10), month: parseInt(m, 10) }
    }
    const { year: oldPeriodYear, month: oldPeriodMonth } = parseYearMonth(existingExpense.date)
    const { year: newPeriodYear, month: newPeriodMonth } = parseYearMonth(date)
    console.log(`🗓️ Updating expense period: old=${oldPeriodYear}-${oldPeriodMonth}, new=${newPeriodYear}-${newPeriodMonth}`)

    // If the date changed, we need to handle both old and new periods
    if (oldPeriodYear !== newPeriodYear || oldPeriodMonth !== newPeriodMonth) {
      // Subtract from old period
      const adminClient = getAdminClient()
      const { data: oldSummary } = await adminClient
        .from('monthly_expense_summaries')
        .select('id, total_expenses')
        .eq('property_id', existingExpense.property_id)
        .eq('period_year', oldPeriodYear)
        .eq('period_month', oldPeriodMonth)
        .maybeSingle()

      if (oldSummary) {
        const newTotal = Math.max(0, oldSummary.total_expenses - existingExpense.amount)

        // Use admin client to bypass potential RLS issues
        const { error: oldUpdateError } = await adminClient
          .from('monthly_expense_summaries')
          .update({ total_expenses: newTotal })
          .eq('id', oldSummary.id)

        if (oldUpdateError) {
          console.error('Error updating old monthly summary:', oldUpdateError, {
            summaryId: oldSummary.id,
            oldTotal: oldSummary.total_expenses,
            amount: existingExpense.amount,
            newTotal
          })
        } else {
          console.log(`Updated old summary ${oldSummary.id} total to ${newTotal}`)
        }
      }

      // Ensure/get new period summary
      let newSummaryId: number | null = null
      const { data: newSummary } = await supabaseWithToken
        .from('monthly_expense_summaries')
        .select('id, total_expenses')
        .eq('property_id', existingExpense.property_id)
        .eq('period_year', newPeriodYear)
        .eq('period_month', newPeriodMonth)
        .eq('admin_id', adminRecord.user_id)
        .single()

      if (newSummary) {
        newSummaryId = newSummary.id
      } else {
        // Create new monthly summary - bypass RLS for this operation
        const supabaseAdmin = getAdminClient()

        const { data: insertedNewSummary, error: insertError } = await supabaseAdmin
          .from('monthly_expense_summaries')
          .insert({
            property_id: existingExpense.property_id,
            period_year: newPeriodYear,
            period_month: newPeriodMonth,
            total_expenses: 0,
            admin_id: adminRecord.user_id
          })
          .select('id')
          .single()

        if (insertError) {
          console.error('Error creating new monthly summary:', insertError)
        } else {
          newSummaryId = insertedNewSummary?.id || null
        }
      }

      // Update the expense to point to the new monthly summary
      if (newSummaryId) {
        await supabaseWithToken
          .from('expenses')
          .update({ monthly_expense_summary_id: newSummaryId })
          .eq('id', expenseId)
      }

      if (newSummaryId) {
        // Add the expense amount to the new summary
        const newTotal = (newSummary?.total_expenses || 0) + parseFloat(amount)

        // Use admin client to bypass potential RLS issues
        const adminClient = getAdminClient()
        const { error: newUpdateError } = await adminClient
          .from('monthly_expense_summaries')
          .update({ total_expenses: newTotal })
          .eq('id', newSummaryId)

        if (newUpdateError) {
          console.error('Error updating new monthly summary:', newUpdateError, {
            summaryId: newSummaryId,
            oldTotal: newSummary?.total_expenses || 0,
            amount: parseFloat(amount),
            newTotal
          })
        } else {
          console.log(`Updated new summary ${newSummaryId} total to ${newTotal}`)
        }
      }
    } else {
      // Same period, update the difference directly
      const adminClient = getAdminClient()
      const { data: summary } = await adminClient
        .from('monthly_expense_summaries')
        .select('id, total_expenses')
        .eq('property_id', existingExpense.property_id)
        .eq('period_year', oldPeriodYear)
        .eq('period_month', oldPeriodMonth)
        .eq('admin_id', adminRecord.user_id)
        .maybeSingle()

      if (summary) {
        console.log(`🔄 Recomputing total for summary ${summary.id} after expense update`)

        // Recompute total from linked expenses to avoid drift
        const adminClient = getAdminClient()
        const { data: sumRows, error: sumError } = await adminClient
          .from('expenses')
          .select('amount')
          .eq('monthly_expense_summary_id', summary.id)

        if (sumError) {
          console.error('❌ Error querying expenses for summary recalc on update:', sumError)
        } else {
          console.log(`📊 Found ${sumRows?.length || 0} expenses linked to summary ${summary.id}`)
          const newTotal = (sumRows || []).reduce((acc: number, r: { amount: number | string }) => acc + Number(r.amount || 0), 0)
          console.log(`💰 Calculated new total: ${newTotal} (old total was ${summary.total_expenses})`)

          const { error: updateError } = await adminClient
            .from('monthly_expense_summaries')
            .update({ total_expenses: newTotal })
            .eq('id', summary.id)

          if (updateError) {
            console.error('❌ Error updating monthly summary on update:', updateError, {
              summaryId: summary.id,
              oldTotal: summary.total_expenses,
              newTotal
            })
          } else {
            console.log(`✅ Successfully updated summary ${summary.id} total to ${newTotal}`)
          }
        }
      }
    }

    return NextResponse.json({
      expense: updatedExpense,
      message: 'Expense updated successfully'
    })
  } catch (error) {
    console.error('Update expense error:', error)
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

    const { id: expenseId } = await params

    // Get user's admin record
    const { data: adminRecord, error: adminError } = await supabaseWithToken
      .from('admins')
      .select('id, user_id')
      .eq('user_id', user.id)
      .single()

    if (adminError || !adminRecord) {
      return NextResponse.json({ error: 'Admin record not found' }, { status: 404 })
    }

    // First verify the expense exists and belongs to user's property
    const { data: existingExpense, error: fetchError } = await supabaseWithToken
      .from('expenses')
      .select(`
        id,
        property_id,
        amount,
        date,
        expense_type,
        properties!inner (
          id,
          admin_id
        )
      `)
      .eq('id', expenseId)
      .single()

    if (fetchError || !existingExpense) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
    }

    // Verify user owns the property
    const { data: property, error: propertyError } = await supabaseWithToken
      .from('properties')
      .select('id')
      .eq('id', existingExpense.property_id)
      .eq('admin_id', adminRecord.user_id)
      .single()

    if (propertyError || !property) {
      return NextResponse.json({ error: 'Property not found or access denied' }, { status: 404 })
    }

    console.log(`🗑️ Deleting HONORARIOS expense ${expenseId}, type: ${existingExpense.expense_type}, amount: ${existingExpense.amount}`)

    const { error } = await supabaseWithToken
      .from('expenses')
      .delete()
      .eq('id', expenseId)

    if (error) {
      console.error('❌ Error deleting expense:', error)
      throw error
    }

    console.log(`✅ Expense ${expenseId} deleted successfully`)

    // Update monthly expenses summary
    const expenseDate = new Date(existingExpense.date)
    const periodYear = expenseDate.getFullYear()
    const periodMonth = expenseDate.getMonth() + 1

    console.log(`🔍 Looking for summary: property_id=${existingExpense.property_id}, period_year=${periodYear}, period_month=${periodMonth}, admin_id=${adminRecord.user_id}`)

    // Use admin client to query summary (same as CREATE route) to avoid RLS issues
    const adminClient = getAdminClient()
    const { data: summary, error: summaryError } = await adminClient
      .from('monthly_expense_summaries')
      .select('id, total_expenses')
      .eq('property_id', existingExpense.property_id)
      .eq('period_year', periodYear)
      .eq('period_month', periodMonth)
      .eq('admin_id', adminRecord.user_id)
      .maybeSingle()

    if (summaryError) {
      console.error('❌ Error finding monthly summary:', summaryError)
    } else if (!summary) {
      console.log('⚠️ No monthly summary found for this expense - this is normal if all expenses for this month were deleted')
    }

    if (summary) {
      console.log(`🔄 Recomputing total for summary ${summary.id} after expense deletion`)

      // Small delay to ensure transaction is committed
      await new Promise(resolve => setTimeout(resolve, 100))

      // Recompute total from linked expenses to avoid drift
      const adminClient = getAdminClient()
      const { data: sumRows, error: sumError } = await adminClient
        .from('expenses')
        .select('amount')
        .eq('monthly_expense_summary_id', summary.id)

      if (sumError) {
        console.error('❌ Error querying expenses for summary recalc:', sumError)
      } else {
        console.log(`📊 Found ${sumRows?.length || 0} expenses linked to summary ${summary.id}`)
        const newTotal = (sumRows || []).reduce((acc: number, r: { amount: number | string }) => acc + Number(r.amount || 0), 0)
        console.log(`💰 Calculated new total: ${newTotal} (old total was ${summary.total_expenses})`)

        const { error: updateError } = await adminClient
          .from('monthly_expense_summaries')
          .update({ total_expenses: newTotal })
          .eq('id', summary.id)

        if (updateError) {
          console.error('❌ Error updating HONORARIOS monthly summary after deletion:', updateError, {
            summaryId: summary.id,
            newTotal,
            oldTotal: summary.total_expenses
          })
        } else {
          console.log(`✅ Successfully updated HONORARIOS summary ${summary.id} total to ${newTotal}`)
        }
      }
    }

    return NextResponse.json({ message: 'Expense deleted successfully' })
  } catch (error) {
    console.error('Delete expense error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

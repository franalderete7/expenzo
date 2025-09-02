import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Helper to bypass RLS when we have already verified ownership
function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
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
    const { name } = await request.json()

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Category name is required' },
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

    // Check if another category with this name exists for this admin
    const { data: existingCategory } = await supabaseWithToken
      .from('expense_categories')
      .select('id')
      .eq('admin_id', adminRecord.id)
      .eq('name', name.trim())
      .neq('id', id)
      .single()

    if (existingCategory) {
      return NextResponse.json(
        { error: 'Category name already exists' },
        { status: 400 }
      )
    }

    // Update category
    const { data: category, error } = await supabaseWithToken
      .from('expense_categories')
      .update({
        name: name.trim(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('admin_id', adminRecord.id) // Ensure user owns the category
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Category not found or access denied' }, { status: 404 })
      }
      console.error('Error updating expense category:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({
      category,
      message: 'Category updated successfully'
    })
  } catch (error) {
    console.error('Update expense category API error:', error)
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

    // First verify the category exists and belongs to the user
    const { data: existingCategory, error: fetchError } = await supabaseWithToken
      .from('expense_categories')
      .select('*')
      .eq('id', id)
      .eq('admin_id', adminRecord.id)
      .single()

    if (fetchError || !existingCategory) {
      return NextResponse.json({ error: 'Category not found or access denied' }, { status: 404 })
    }

    // Check if category is being used by any expenses (use admin client to avoid RLS issues)
    const adminClient = getAdminClient()
    const { data: expensesUsingCategory, error: checkError } = await adminClient
      .from('expenses')
      .select('id')
      .eq('category', existingCategory.name)
      .eq('admin_id', adminRecord.id)
      .limit(1)

    if (checkError) {
      console.error('Error checking category usage (admin client):', checkError, {
        adminId: adminRecord.id,
        categoryName: existingCategory.name,
      })
      return NextResponse.json({ error: 'Error checking category usage' }, { status: 500 })
    }

    if (expensesUsingCategory && expensesUsingCategory.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete category that is being used by expenses' },
        { status: 400 }
      )
    }

    // Delete category
    const { error } = await supabaseWithToken
      .from('expense_categories')
      .delete()
      .eq('id', id)
      .eq('admin_id', adminRecord.id) // Ensure user owns the category

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Category not found or access denied' }, { status: 404 })
      }
      console.error('Error deleting expense category:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({
      message: 'Category deleted successfully'
    })
  } catch (error) {
    console.error('Delete expense category API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

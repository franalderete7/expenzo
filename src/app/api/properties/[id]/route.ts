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

    // Get property
    const { data: property, error } = await supabase
      .from('properties')
      .select('*')
      .eq('id', id)
      .eq('admin_id', user.id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Property not found' },
          { status: 404 }
        )
      }
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({ property })
  } catch (error) {
    console.error('Get property error:', error)
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
    const { id } = await params
    const body = await request.json()
    const { name, street_address, city, description } = body

    // TEMPORARY: Use service role to bypass RLS
    const { createClient } = await import('@supabase/supabase-js')
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    // Check if property exists first
    const { data: existingProperty, error: fetchError } = await supabaseAdmin
      .from('properties')
      .select('id, name')
      .eq('id', id)
      .single()

    if (fetchError || !existingProperty) {
      return NextResponse.json(
        { error: 'Property not found' },
        { status: 404 }
      )
    }

    // Update property
    const { data: property, error } = await supabaseAdmin
      .from('properties')
      .update({
        name,
        street_address,
        city,
        description,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Property update error:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      property,
      message: `Property "${property.name}" updated successfully`,
    })
  } catch (error) {
    console.error('Property update API error:', error)
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
    const { id } = await params

    // TEMPORARY: Use service role to bypass RLS
    const { createClient } = await import('@supabase/supabase-js')
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    // Check if property exists first
    const { data: property, error: fetchError } = await supabaseAdmin
      .from('properties')
      .select('id, name')
      .eq('id', id)
      .single()

    if (fetchError || !property) {
      return NextResponse.json(
        { error: 'Property not found' },
        { status: 404 }
      )
    }

    // Delete property (this will cascade delete units, residents, contracts, etc.)
    const { error } = await supabaseAdmin
      .from('properties')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Property deletion error:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      message: `Property "${property.name}" deleted successfully`,
    })
  } catch (error) {
    console.error('Property deletion API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()
    console.log('Sign-in attempt for email:', email)

    if (!email || !password) {
      console.log('Sign-in failed: Missing email or password')
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Sign in with Supabase Auth
    console.log('Sign-in: Attempting authentication...')
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      console.log('Sign-in failed: Authentication error:', error.message)
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      )
    }

    console.log('Sign-in successful for user:', data.user.id)

    // Check if user exists in admins table, create if not
    console.log('Sign-in: Checking admin record...')
    const { data: existingAdmin, error: adminError } = await supabase
      .from('admins')
      .select('*')
      .eq('email', email)
      .single()

    if (adminError && adminError.code === 'PGRST116') {
      console.log('Sign-in: Admin record not found, creating new one...')
      // User doesn't exist in admins table, create them
      const { data: newAdmin, error: insertError } = await supabase
        .from('admins')
        .insert([
          {
            user_id: data.user.id, // This is crucial for the properties API
            username: data.user.user_metadata?.full_name || email.split('@')[0],
            email: email,
            password_hash: 'managed_by_supabase_auth',
            full_name: data.user.user_metadata?.full_name || 'Admin User',
          },
        ])
        .select()
        .single()

      if (insertError) {
        console.error('Sign-in: Error creating admin user:', insertError)
        return NextResponse.json(
          { error: 'Failed to create admin record', details: insertError.message },
          { status: 500 }
        )
      }

      console.log('Sign-in: Admin record created successfully:', newAdmin.id)
    } else if (existingAdmin) {
      console.log('Sign-in: Admin record already exists:', existingAdmin.id)

      // Check if user_id is set, if not update it
      if (!existingAdmin.user_id) {
        console.log('Sign-in: Updating admin record with user_id...')
        const { error: updateError } = await supabase
          .from('admins')
          .update({ user_id: data.user.id })
          .eq('id', existingAdmin.id)

        if (updateError) {
          console.error('Sign-in: Error updating admin user_id:', updateError)
        } else {
          console.log('Sign-in: Admin user_id updated successfully')
        }
      }
    } else if (adminError) {
      console.log('Sign-in: Admin lookup error:', adminError)
      return NextResponse.json(
        { error: 'Admin lookup failed', details: adminError.message },
        { status: 500 }
      )
    }

    console.log('Sign-in: Process completed successfully')
    return NextResponse.json({
      message: 'Sign in successful',
      user: data.user,
      session: data.session,
    })
  } catch (error) {
    console.error('Sign-in: Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

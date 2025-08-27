import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Sign in with Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      )
    }

    // Check if user exists in admins table, create if not
    const { data: adminData, error: adminError } = await supabase
      .from('admins')
      .select('*')
      .eq('email', email)
      .single()

    if (adminError && adminError.code === 'PGRST116') {
      // User doesn't exist in admins table, create them
      const { error: insertError } = await supabase
        .from('admins')
        .insert([
          {
            username: data.user.user_metadata?.full_name || email.split('@')[0],
            email: email,
            password_hash: 'managed_by_supabase_auth',
            full_name: data.user.user_metadata?.full_name || 'Admin User',
          },
        ])

      if (insertError) {
        console.error('Error creating admin user:', insertError)
      }
    }

    return NextResponse.json({
      message: 'Sign in successful',
      user: data.user,
      session: data.session,
    })
  } catch (error) {
    console.error('Sign in error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

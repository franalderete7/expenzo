import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    // Get the session token from the request
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // If no auth header, still return success (client will handle signout)
      return NextResponse.json({
        message: 'Sign out successful (no session)',
      })
    }

    const token = authHeader.substring(7)

    // Create a Supabase client with the user's token
    const supabaseWithToken = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    )

    // Try to sign out with the token
    const { error } = await supabaseWithToken.auth.signOut()

    if (error) {
      console.warn('Server-side signout failed:', error.message)
      // Don't fail the request, just log the warning
      // Client-side signout will still work
    }

    return NextResponse.json({
      message: 'Sign out successful',
    })
  } catch (error) {
    console.error('Sign out error:', error)
    // Don't fail the request even if server-side signout fails
    // Client-side signout will still work
    return NextResponse.json({
      message: 'Sign out completed (with warnings)',
    })
  }
}

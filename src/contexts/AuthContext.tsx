'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  refreshSession: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()

        if (!isMounted) return

        if (error) {
          console.error('Error getting session:', error)
          setSession(null)
          setUser(null)
          setLoading(false)
          return
        }

        setSession(session)
        setUser(session?.user ?? null)
        setLoading(false)
      } catch (error) {
        console.error('Error in getInitialSession:', error)
        if (isMounted) {
          setSession(null)
          setUser(null)
          setLoading(false)
        }
      }
    }

    getInitialSession()

    // Periodically check session validity
    const checkSessionValidity = async () => {
      if (!isMounted) return

      try {
        const { data: { session }, error } = await supabase.auth.getSession()

        if (error) {
          console.warn('Session validation error:', error)
          setSession(null)
          setUser(null)
          setLoading(false)
          return
        }

        // Check if session is expired or invalid
        if (session && session.expires_at) {
          const now = Math.floor(Date.now() / 1000)
          if (session.expires_at < now) {
            console.log('Session expired, clearing local state')
            setSession(null)
            setUser(null)
            setLoading(false)
          }
        }
      } catch (error) {
        console.error('Session validation failed:', error)
      }
    }

    // Check session validity every minute
    const intervalId = setInterval(checkSessionValidity, 60000)

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return

      console.log('🔄 [AUTH STATE] Event:', event)
      console.log('🔄 [AUTH STATE] Current URL:', window.location.href)
      console.log('🔄 [AUTH STATE] User ID:', session?.user?.id)
      console.log('🔄 [AUTH STATE] Session expires:', session?.expires_at)
      console.log('🔄 [AUTH STATE] User metadata:', session?.user?.user_metadata)

      // Handle different auth events
      switch (event) {
        case 'SIGNED_IN':
          console.log('✅ [SIGNED_IN] User signed in successfully')
          console.log('✅ [SIGNED_IN] Current location after sign in:', window.location.href)

          setSession(session)
          setUser(session?.user ?? null)
          setLoading(false)

          // Ensure we're on the correct domain after sign in
          const currentOrigin = window.location.origin
          const expectedOrigin = process.env.NODE_ENV === 'production'
            ? 'https://expenzo-seven.vercel.app'
            : 'http://localhost:3000'

          console.log('🏠 [SIGNED_IN] Current origin:', currentOrigin)
          console.log('🎯 [SIGNED_IN] Expected origin:', expectedOrigin)
          console.log('🌍 [SIGNED_IN] Environment:', process.env.NODE_ENV)

          if (currentOrigin !== expectedOrigin) {
            console.warn('⚠️ [SIGNED_IN] ORIGIN MISMATCH DETECTED!')
            console.warn('⚠️ [SIGNED_IN] Expected:', expectedOrigin)
            console.warn('⚠️ [SIGNED_IN] Got:', currentOrigin)
            console.warn('⚠️ [SIGNED_IN] This might cause redirect issues!')

            // Check if we were redirected from OAuth
            const urlParams = new URLSearchParams(window.location.search)
            const hasAuthParams = urlParams.has('code') || urlParams.has('access_token') || urlParams.has('refresh_token')
            console.log('🔍 [SIGNED_IN] Has OAuth params in URL:', hasAuthParams)
            console.log('🔍 [SIGNED_IN] URL params:', Object.fromEntries(urlParams.entries()))
          } else {
            console.log('✅ [SIGNED_IN] Origin matches expected environment')
          }
          break
        case 'SIGNED_OUT':
          console.log('👋 [SIGNED_OUT] User signed out')
          setSession(null)
          setUser(null)
          setLoading(false)
          break
        case 'TOKEN_REFRESHED':
          console.log('🔄 [TOKEN_REFRESHED] Token refreshed successfully')
          setSession(session)
          setUser(session?.user ?? null)
          break
        case 'USER_UPDATED':
          console.log('👤 [USER_UPDATED] User data updated')
          setSession(session)
          setUser(session?.user ?? null)
          break
        default:
          console.log('❓ [UNKNOWN_EVENT] Unhandled auth event:', event)
          setSession(session)
          setUser(session?.user ?? null)
          setLoading(false)
      }
    })

    return () => {
      isMounted = false
      clearInterval(intervalId)
      subscription.unsubscribe()
    }
  }, [])

  const signInWithGoogle = async () => {
    // Ensure we have the correct origin for redirect
    const currentOrigin = window.location.origin
    const redirectUrl = `${currentOrigin}/dashboard`

    console.log('🔗 [SIGNIN START] Current location:', window.location.href)
    console.log('🔗 [SIGNIN] Detected origin:', currentOrigin)
    console.log('🔗 [SIGNIN] Constructed redirect URL:', redirectUrl)
    console.log('🔗 [SIGNIN] Environment:', process.env.NODE_ENV)
    console.log('🔗 [SIGNIN] Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)

    // Check if we're already in the wrong environment
    if (process.env.NODE_ENV === 'development' && !currentOrigin.includes('localhost')) {
      console.warn('⚠️ [SIGNIN] Development mode but not on localhost!')
    }
    if (process.env.NODE_ENV === 'production' && !currentOrigin.includes('vercel.app')) {
      console.warn('⚠️ [SIGNIN] Production mode but not on Vercel!')
    }

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    })

    if (error) {
      console.error('❌ [SIGNIN ERROR]:', error)
      console.error('❌ [SIGNIN ERROR] Details:', {
        message: error.message,
        status: error.status,
        name: error.name
      })
      throw error
    }

    console.log('✅ [SIGNIN SUCCESS] OAuth initiated, data:', data)
    console.log('⏳ [SIGNIN] Waiting for redirect to:', redirectUrl)
  }

  const signOut = async () => {
    try {
      // First try to sign out via API route (server-side)
      const response = await fetch('/api/auth/signout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        console.warn('Server signout failed, trying client-side signout')
      }

      // Always do client-side signout as fallback/primary method
      const { error } = await supabase.auth.signOut()
      if (error) {
        console.error('Client-side signout error:', error)
        throw error
      }

      // Clear local state immediately
      setSession(null)
      setUser(null)
      setLoading(false)
    } catch (error) {
      console.error('Signout error:', error)
      // Even if signout fails, clear local state
      setSession(null)
      setUser(null)
      setLoading(false)
      throw error
    }
  }

  const refreshSession = async () => {
    try {
      setLoading(true)
      const { data: { session }, error } = await supabase.auth.refreshSession()

      if (error) {
        console.error('Session refresh error:', error)
        setSession(null)
        setUser(null)
      } else {
        setSession(session)
        setUser(session?.user ?? null)
      }
    } catch (error) {
      console.error('Session refresh failed:', error)
      setSession(null)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  const value = {
    user,
    session,
    loading,
    signInWithGoogle,
    signOut,
    refreshSession,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

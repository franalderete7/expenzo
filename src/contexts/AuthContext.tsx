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

      console.log('Auth state changed:', event, session?.user?.id, session?.expires_at)

      // Handle different auth events
      switch (event) {
        case 'SIGNED_IN':
          setSession(session)
          setUser(session?.user ?? null)
          setLoading(false)
          break
        case 'SIGNED_OUT':
          setSession(null)
          setUser(null)
          setLoading(false)
          break
        case 'TOKEN_REFRESHED':
          setSession(session)
          setUser(session?.user ?? null)
          break
        case 'USER_UPDATED':
          setSession(session)
          setUser(session?.user ?? null)
          break
        default:
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
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
      },
    })
    if (error) throw error
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

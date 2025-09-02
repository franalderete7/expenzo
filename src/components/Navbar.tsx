'use client'

import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { LogOut, User, RefreshCw } from 'lucide-react'

function GoogleSignInButton({ onClick }: { onClick: () => void }) {
  const handleClick = () => {
    console.log('🔘 [NAVBAR] Google sign-in button clicked')
    console.log('🔘 [NAVBAR] Current location:', window.location.href)
    console.log('🔘 [NAVBAR] Current origin:', window.location.origin)
    onClick()
  }

  return (
    <Button
      onClick={handleClick}
      className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 hover:border-gray-400 px-4 py-2 h-auto font-normal cursor-pointer shadow-sm"
    >
      <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
        <path
          fill="#4285F4"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        />
        <path
          fill="#34A853"
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        />
        <path
          fill="#FBBC05"
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        />
        <path
          fill="#EA4335"
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        />
      </svg>
      Continuar con Google
    </Button>
  )
}

export function Navbar() {
  const { user, signInWithGoogle, signOut, refreshSession } = useAuth()

  const handleSignOut = async () => {
    try {
      await signOut()
      // Force a hard navigation to clear all state
      window.location.href = '/'
    } catch (error) {
      console.error('Error signing out:', error)
      // Even if signout fails, redirect to home
      window.location.href = '/'
    }
  }

  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 relative z-50">
      <div className="flex h-14 items-center justify-between px-4 max-w-7xl mx-auto">
        <Link className="flex items-center space-x-2" href="/">
          <span className="font-bold text-xl">Expenzo</span>
        </Link>

        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full cursor-pointer">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user.user_metadata.avatar_url} alt={user.user_metadata.full_name} />
                  <AvatarFallback>
                    {user.user_metadata.full_name?.charAt(0) || user.email?.charAt(0) || 'U'}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {user.user_metadata.full_name || 'Usuario'}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => refreshSession().catch(console.error)}
                className="cursor-pointer"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                <span>Refrescar sesión</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Cerrar sesión</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <GoogleSignInButton onClick={signInWithGoogle} />
        )}
      </div>
    </nav>
  )
}

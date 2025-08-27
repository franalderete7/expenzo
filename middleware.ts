import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Protect dashboard routes
  if (request.nextUrl.pathname.startsWith('/dashboard') && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  // Redirect authenticated users away from home page (only if not already redirecting)
  if (request.nextUrl.pathname === '/' && user && !request.nextUrl.searchParams.has('redirected')) {
    console.log('Middleware: Redirecting authenticated user to dashboard', user.id)
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    url.searchParams.set('redirected', 'true') // Prevent redirect loops
    return NextResponse.redirect(url)
  }

  // Log for debugging
  if (request.nextUrl.pathname === '/') {
    console.log('Middleware: Home page accessed', {
      hasUser: !!user,
      userId: user?.id,
      hasRedirectedParam: request.nextUrl.searchParams.has('redirected')
    })
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/', '/dashboard/:path*'],
}

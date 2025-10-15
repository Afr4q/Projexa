import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// List of public routes that don't require authentication
const publicRoutes = ['/', '/auth/callback']

export async function middleware(request: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req: request, res })
  const { data: { session } } = await supabase.auth.getSession()

  const path = request.nextUrl.pathname

  // Allow public routes
  if (publicRoutes.includes(path)) {
    // If logged in and on login page, redirect to appropriate dashboard
    if (session && path === '/') {
      const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('id', session.user.id)
        .single()

      if (userData?.role) {
        return NextResponse.redirect(new URL(`/dashboard/${userData.role}`, request.url))
      }
    }
    return res
  }

  // Handle auth callback route
  if (path.startsWith('/auth/callback')) {
    return res
  }

  // Check if user is authenticated for protected routes
  if (!session) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // For dashboard routes, verify role-based access
  if (path.startsWith('/dashboard/')) {
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', session.user.id)
      .single()

    if (!userData?.role) {
      return NextResponse.redirect(new URL('/', request.url))
    }

    const urlParts = path.split('/')
    const accessedRole = urlParts[2] // Get role from URL: /dashboard/{role}/...

    // If user tries to access wrong dashboard, redirect to their correct one
    if (accessedRole !== userData.role) {
      return NextResponse.redirect(new URL(`/dashboard/${userData.role}`, request.url))
    }
  }

  return res
}

export const config = {
  matcher: [
    '/',
    '/auth/callback',
    '/dashboard/:path*'
  ]
}
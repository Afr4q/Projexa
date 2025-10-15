import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  if (code) {
    const supabase = createRouteHandlerClient({ cookies })
    
    // Exchange the code for a session
    await supabase.auth.exchangeCodeForSession(code)

    // After successful authentication, get the user's role
    const { data: { session } } = await supabase.auth.getSession()

    if (session?.user) {
      // Get user's role from the users table
      const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('id', session.user.id)
        .single()

      if (userData?.role) {
        // Redirect to appropriate dashboard
        return NextResponse.redirect(new URL(`/dashboard/${userData.role}`, request.url))
      }
    }
  }

  // If anything goes wrong, redirect to home page
  return NextResponse.redirect(new URL('/', request.url))
}
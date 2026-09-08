import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  // If Supabase is not configured, allow pass-through for development
  if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('dummy-project')) {
    return response
  }

  try {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set({
              name,
              value,
              ...options,
            })
          )
        },
      },
    })

    const {
      data: { user },
    } = await supabase.auth.getUser()

    const { pathname } = request.nextUrl

    // 1. If user is authenticated:
    if (user) {
      // Fast path for Server Action RPCs: authenticated actions handle their own granular RBAC server-side
      if (request.headers.has('next-action')) {
        return response
      }

      // Query user profile to verify active status and role on page navigations
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, is_active')
        .eq('id', user.id)
        .single()

      const isActive = (profile as any)?.is_active ?? true
      const role = (profile as any)?.role || 'teacher'

      // Check if user is deactivated
      if (!isActive) {
        if (request.headers.has('next-action')) {
          return new NextResponse(
            JSON.stringify({ error: 'Account deactivated' }),
            { status: 403, headers: { 'content-type': 'application/json' } }
          )
        }
        const redirectUrl = new URL('/login?error=account_deactivated', request.url)
        return NextResponse.redirect(redirectUrl)
      }

      // Check Super Admin route protection
      if (pathname.startsWith('/admin')) {
        if (role !== 'super_admin') {
          // Unauthorized: redirect to dashboard root
          if (request.headers.has('next-action')) {
            return new NextResponse(
              JSON.stringify({ error: 'Unauthorized admin access' }),
              { status: 403, headers: { 'content-type': 'application/json' } }
            )
          }
          const redirectUrl = new URL('/?error=unauthorized_admin_access', request.url)
          return NextResponse.redirect(redirectUrl)
        }
      }

      // If user is already authenticated and visits /login, redirect to dashboard
      if (pathname === '/login') {
        const redirectUrl = new URL('/', request.url)
        return NextResponse.redirect(redirectUrl)
      }
    } else {
      // 2. If user is unauthenticated:
      // Protect internal pages
      const isProtected =
        pathname === '/' ||
        pathname.startsWith('/admin') ||
        pathname.startsWith('/incidents') ||
        pathname.startsWith('/records') ||
        pathname.startsWith('/schedules') ||
        pathname.startsWith('/logs') ||
        pathname.startsWith('/maintenance') ||
        pathname.startsWith('/print')

      if (isProtected) {
        // Do not redirect Server Action RPC requests to HTML login page (avoids Flight parsing errors)
        if (request.headers.has('next-action')) {
          return new NextResponse(
            JSON.stringify({ error: 'Unauthorized. Please sign in.' }),
            { status: 401, headers: { 'content-type': 'application/json' } }
          )
        }

        const redirectUrl = new URL(
          `/login?redirect=${encodeURIComponent(pathname)}`,
          request.url
        )
        return NextResponse.redirect(redirectUrl)
      }
    }
  } catch (error) {
    // Fail-open gracefully on transient edge network errors
    console.warn('Middleware auth verification error:', error)
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images / icons
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

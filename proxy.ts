import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import {
  SESSION_CLAIM_COOKIE_NAME,
  SESSION_CLAIM_TTL_MS,
  createSessionClaim,
  verifySessionClaim,
} from '@/lib/security/session-claim'

/**
 * Extracts the Supabase Auth user ID (sub) directly from request session cookies
 * without making external network calls.
 */
function extractSupabaseAuthSub(request: NextRequest): string | null {
  const allCookies = request.cookies.getAll()
  const tokenCookies = allCookies.filter(
    (c) => c.name.startsWith('sb-') && c.name.includes('-auth-token')
  )
  if (!tokenCookies.length) return null

  // Sort chunks if cookie was split (.0, .1)
  tokenCookies.sort((a, b) => a.name.localeCompare(b.name))
  const rawVal = tokenCookies.map((c) => c.value).join('')

  try {
    let accessToken: string | null = null
    if (rawVal.startsWith('[') || rawVal.startsWith('{')) {
      const parsed = JSON.parse(rawVal)
      if (Array.isArray(parsed) && typeof parsed[0] === 'string') {
        accessToken = parsed[0]
      } else if (parsed && typeof parsed.access_token === 'string') {
        accessToken = parsed.access_token
      }
    } else if (rawVal.startsWith('base64-')) {
      const decoded = atob(rawVal.slice(7))
      const parsed = JSON.parse(decoded)
      accessToken = parsed?.access_token || (Array.isArray(parsed) ? parsed[0] : null)
    } else if (rawVal.includes('.')) {
      accessToken = rawVal
    }

    if (!accessToken || !accessToken.includes('.')) return null
    const parts = accessToken.split('.')
    if (parts.length < 2) return null

    let base64Payload = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    while (base64Payload.length % 4) base64Payload += '='
    const payloadStr = atob(base64Payload)
    const payload = JSON.parse(payloadStr)
    return payload?.sub || null
  } catch {
    return null
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 0. Explicit public PWA and static asset pass-through
  if (
    pathname === '/manifest.webmanifest' ||
    pathname === '/manifest.json' ||
    pathname === '/sw.js' ||
    pathname === '/offline.html' ||
    pathname.startsWith('/icons/') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next()
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // 1. Fast path for Server Action RPCs:
  // Server Actions execute their own granular RBAC and user-scoping server-side.
  if (request.headers.has('next-action')) {
    return response
  }

  // 2. Fast path for RSC Prefetch requests:
  // Prevents cascading network roundtrips when the client prefetches navigation links.
  if (
    request.headers.get('purpose') === 'prefetch' ||
    request.headers.has('next-router-prefetch')
  ) {
    return response
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  // If Supabase is not configured, allow pass-through for development
  if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('dummy-project')) {
    return response
  }

  // 3. FAST PATH: Check signed short-TTL session claim cookie (< 0.2ms, ZERO WAN calls)
  const currentSub = extractSupabaseAuthSub(request)
  const rawClaim = request.cookies.get(SESSION_CLAIM_COOKIE_NAME)?.value

  if (rawClaim && currentSub) {
    const claim = await verifySessionClaim(rawClaim)
    // Guard 3: User ID Binding (claim.uid must match current auth sub)
    if (claim && claim.uid === currentSub) {
      // Check account active status
      if (!claim.isActive) {
        const redirectUrl = new URL('/login?error=account_deactivated', request.url)
        return NextResponse.redirect(redirectUrl)
      }

      // Check account approval status
      if (claim.approvalStatus === 'rejected') {
        const redirectUrl = new URL('/login?error=account_rejected', request.url)
        return NextResponse.redirect(redirectUrl)
      }

      // Check Super Admin route protection
      if (pathname.startsWith('/admin')) {
        if (claim.role !== 'super_admin' || claim.approvalStatus !== 'approved' || !claim.isActive) {
          const redirectUrl = new URL('/?error=unauthorized_admin_access', request.url)
          return NextResponse.redirect(redirectUrl)
        }
      }

      // Check Maintenance route protection
      if (pathname.startsWith('/maintenance')) {
        const canAccessMaintenance =
          claim.role === 'super_admin' ||
          claim.role === 'lab_incharge' ||
          claim.role === 'hod' ||
          claim.role === 'coordinator'

        if (!canAccessMaintenance || claim.approvalStatus !== 'approved' || !claim.isActive) {
          const redirectUrl = new URL('/?error=unauthorized_maintenance_access', request.url)
          return NextResponse.redirect(redirectUrl)
        }
      }

      // If user is already authenticated and visits /login, redirect
      if (pathname === '/login') {
        const dest = claim.approvalStatus !== 'approved' ? '/profile' : '/'
        const redirectUrl = new URL(dest, request.url)
        return NextResponse.redirect(redirectUrl)
      }

      // Fast-path valid! Proceed with 0ms delay and zero WAN calls
      return response
    }
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

    // 1. If user is authenticated:
    if (user) {
      // Query profile to verify role and status
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, is_active, approval_status')
        .eq('id', user.id)
        .single()

      const isActive = (profile as any)?.is_active ?? true
      const role = (profile as any)?.role || 'teacher'
      const approvalStatus = (profile as any)?.approval_status || 'approved'

      // Check if user is deactivated
      if (!isActive) {
        const redirectUrl = new URL('/login?error=account_deactivated', request.url)
        return NextResponse.redirect(redirectUrl)
      }

      // Check if user is rejected
      if (approvalStatus === 'rejected') {
        const redirectUrl = new URL('/login?error=account_rejected', request.url)
        return NextResponse.redirect(redirectUrl)
      }

      // Check Super Admin route protection
      if (pathname.startsWith('/admin')) {
        if (role !== 'super_admin' || approvalStatus !== 'approved' || !isActive) {
          const redirectUrl = new URL('/?error=unauthorized_admin_access', request.url)
          return NextResponse.redirect(redirectUrl)
        }
      }

      // Check Maintenance route protection
      if (pathname.startsWith('/maintenance')) {
        const canAccessMaintenance =
          role === 'super_admin' ||
          role === 'lab_incharge' ||
          role === 'hod' ||
          (role as string) === 'coordinator' ||
          (profile as any)?.permissions?.can_manage_maintenance === true

        if (!canAccessMaintenance || approvalStatus !== 'approved' || !isActive) {
          const redirectUrl = new URL('/?error=unauthorized_maintenance_access', request.url)
          return NextResponse.redirect(redirectUrl)
        }
      }

      // Issue/refresh signed session claim cookie for subsequent fast-path hits
      try {
        const freshClaim = await createSessionClaim({
          uid: user.id,
          role,
          approvalStatus,
          isActive,
        })
        response.cookies.set({
          name: SESSION_CLAIM_COOKIE_NAME,
          value: freshClaim,
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: Math.floor(SESSION_CLAIM_TTL_MS / 1000),
          path: '/',
        })
      } catch (signErr) {
        console.warn('Failed to sign session claim:', signErr)
      }

      // If user is already authenticated and visits /login, redirect
      if (pathname === '/login') {
        const dest = approvalStatus !== 'approved' ? '/profile' : '/'
        const redirectUrl = new URL(dest, request.url)
        return NextResponse.redirect(redirectUrl)
      }
    } else {
      // 2. If user is unauthenticated:
      // Invalidate any leftover session claim cookie
      if (request.cookies.has(SESSION_CLAIM_COOKIE_NAME)) {
        response.cookies.delete(SESSION_CLAIM_COOKIE_NAME)
      }

      // Protect internal pages
      const isProtected =
        pathname === '/' ||
        pathname.startsWith('/admin') ||
        pathname.startsWith('/incidents') ||
        pathname.startsWith('/records') ||
        pathname.startsWith('/schedules') ||
        pathname.startsWith('/logs') ||
        pathname.startsWith('/maintenance') ||
        pathname.startsWith('/computer-lab') ||
        pathname.startsWith('/print')

      if (isProtected) {
        const redirectUrl = new URL(
          `/login?redirect=${encodeURIComponent(pathname)}`,
          request.url
        )
        return NextResponse.redirect(redirectUrl)
      }
    }
  } catch (error) {
    console.warn('Proxy auth verification error:', error)

    // Never redirect server actions with HTTP 307/308 in catch block — it breaks Flight protocol
    if (request.headers.has('next-action')) {
      return response
    }

    const isProtected =
      pathname === '/' ||
      pathname.startsWith('/admin') ||
      pathname.startsWith('/incidents') ||
      pathname.startsWith('/records') ||
      pathname.startsWith('/schedules') ||
      pathname.startsWith('/logs') ||
      pathname.startsWith('/maintenance') ||
      pathname.startsWith('/computer-lab') ||
      pathname.startsWith('/print')

    if (isProtected) {
      const redirectUrl = new URL(
        `/login?error=session_expired&redirect=${encodeURIComponent(pathname)}`,
        request.url
      )
      return NextResponse.redirect(redirectUrl)
    }
  }

  return response
}

export default proxy

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - manifest.webmanifest
     * - manifest.json
     * - sw.js (service worker)
     * - offline.html (offline fallback page)
     * - icons (PWA icons)
     */
    '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|manifest.json|sw.js|offline.html|icons/).*)',
  ],
}

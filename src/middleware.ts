import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { normalizeRole, type Role } from '@/lib/permissions'

const PUBLIC_PATHS = ['/login', '/signup']
const PUBLIC_PREFIXES = ['/legal/', '/api/auth/login', '/api/auth/signup']

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

function getRoleFromRequest(request: NextRequest): Role | null {
  const userInfoRaw = request.cookies.get('user_info')?.value
  if (!userInfoRaw) return null
  try {
    const parsed = JSON.parse(userInfoRaw) as { role?: string | null }
    return normalizeRole(parsed.role)
  } catch {
    return null
  }
}

/** Route protection: only allow paths the role is permitted to access. */
function isPathAllowedForRole(pathname: string, role: Role | null): boolean {
  if (!role) return false

  // Admin can access everything
  if (role === 'Admin') return true

  // Admin-only routes
  if (pathname.startsWith('/admin')) return false
  if (pathname.startsWith('/orders')) return false
  if (pathname.startsWith('/customers')) return false
  if (pathname.startsWith('/sales-reps')) return false
  if (pathname.startsWith('/distributors')) return false
  if (pathname.startsWith('/reports')) return false

  // Quotes: Sales Rep and Distributor only (no Technician)
  if (pathname.startsWith('/quotes')) {
    return role === 'Sales Rep' || role === 'Distributor'
  }

  // Inventory/codes: Admin and Technician only (not Sales Rep or Distributor)
  if (pathname === '/inventory/codes' || pathname.startsWith('/inventory/codes/')) {
    return role === 'Technician'
  }

  // Dashboard, profile, alerts, inventory (and other inventory subpaths for Sales Rep/Distributor)
  return true
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow static assets and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.') // e.g. .ico, .png
  ) {
    return NextResponse.next()
  }

  // API routes: no redirect; each route returns 401/403 if unauthenticated or forbidden
  if (pathname.startsWith('/api')) {
    return NextResponse.next()
  }

  if (isPublicPath(pathname)) {
    // If already logged in, don't show login/signup again
    const authToken = request.cookies.get('auth_token')?.value
    if (authToken && (pathname === '/login' || pathname === '/signup')) {
      return NextResponse.redirect(new URL('/', request.url))
    }
    return NextResponse.next()
  }

  const token = request.cookies.get('auth_token')?.value
  if (!token) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Role-based route protection: redirect unauthorized users to dashboard
  const role = getRoleFromRequest(request)
  if (!isPathAllowedForRole(pathname, role)) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - public folder files (images, etc.)
     */
    '/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}

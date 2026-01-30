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
  if (role === 'Admin') return true
  if (!role) return true

  if (pathname.startsWith('/admin')) return false
  if (pathname.startsWith('/orders')) return false
  if (pathname.startsWith('/customers')) return false
  if (pathname.startsWith('/sales-reps')) return false
  if (pathname.startsWith('/distributors')) return false
  if (pathname.startsWith('/reports')) return false

  if (pathname.startsWith('/quotes')) {
    return role === 'Sales Rep' || role === 'Distributor'
  }

  if (pathname === '/inventory/codes' || pathname.startsWith('/inventory/codes/')) {
    return role === 'Technician'
  }

  return true
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  if (pathname.startsWith('/api')) {
    return NextResponse.next()
  }

  if (isPublicPath(pathname)) {
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

  const role = getRoleFromRequest(request)
  if (!isPathAllowedForRole(pathname, role)) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}

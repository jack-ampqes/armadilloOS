import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Routes that don't require authentication
const publicRoutes = ['/login', '/signup']

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Check if the route is public
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route))

  // Get the auth token from cookies
  const authToken = request.cookies.get('auth_token')?.value

  // If trying to access a protected route without auth, redirect to login
  if (!isPublicRoute && !authToken) {
    const loginUrl = new URL('/login', request.url)
    // Store the original URL to redirect back after login
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // If logged in and trying to access login/signup, redirect to home
  if (isPublicRoute && authToken) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

// Configure which routes the proxy runs on
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     * - API routes (they handle their own auth)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$|api/).*)',
  ],
}

import { NextRequest, NextResponse } from 'next/server'
import { normalizeRole, type Role, type Permission, hasPermission } from './permissions'

export interface AuthenticatedUser {
  id: string
  email: string
  name: string | null
  role: Role
}

export type AuthResult =
  | { user: AuthenticatedUser }
  | { response: NextResponse }

function unauthorized(message = 'Unauthorized'): NextResponse {
  return NextResponse.json({ error: message }, { status: 401 })
}

function forbidden(message = 'Forbidden'): NextResponse {
  return NextResponse.json({ error: message }, { status: 403 })
}

export function requireAuthWithRole(req: NextRequest): AuthResult {
  const authToken = req.cookies.get('auth_token')?.value
  const userInfoRaw = req.cookies.get('user_info')?.value

  if (!authToken || !userInfoRaw) {
    return { response: unauthorized() }
  }

  try {
    const parsed = JSON.parse(userInfoRaw) as {
      id?: string
      email?: string
      name?: string | null
      role?: string | null
    }

    if (!parsed.id || !parsed.email) {
      return { response: unauthorized('Invalid user session') }
    }

    const role = normalizeRole(parsed.role)

    const user: AuthenticatedUser = {
      id: String(parsed.id),
      email: String(parsed.email),
      name: parsed.name ?? null,
      role,
    }

    return { user }
  } catch {
    return { response: unauthorized('Invalid session data') }
  }
}

export function requirePermission(
  req: NextRequest,
  permission: Permission
): AuthResult {
  const auth = requireAuthWithRole(req)
  if ('response' in auth) {
    return auth
  }

  const { user } = auth

  if (!hasPermission(user.role, permission)) {
    return { response: forbidden('Insufficient permissions') }
  }

  return { user }
}


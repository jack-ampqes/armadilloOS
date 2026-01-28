'use client'

import { useEffect, useState } from 'react'
import type { Permission, Role } from './permissions'
import { getRoleFromUserInfoCookie, hasPermission } from './permissions'

interface UsePermissionsResult {
  role: Role | null
  hasPermission: (permission: Permission) => boolean
}

export function usePermissions(): UsePermissionsResult {
  const [role, setRole] = useState<Role | null>(null)

  useEffect(() => {
    const currentRole = getRoleFromUserInfoCookie()
    setRole(currentRole)
  }, [])

  return {
    role,
    hasPermission: (permission: Permission) =>
      role ? hasPermission(role, permission) : false,
  }
}


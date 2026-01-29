'use client'

import { useState, useEffect } from 'react'
import { ShieldUser, Loader2, AlertCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { usePermissions } from '@/lib/usePermissions'
import type { Role, Permission } from '@/lib/permissions'
import { ROLE_PERMISSIONS } from '@/lib/permissions'

const ROLES: Role[] = ['Admin', 'Sales Rep', 'Distributor', 'Technician']

interface UserRow {
  id: string
  email: string
  name: string | null
  role: string | null
  created_at?: string
  updated_at?: string
}

function permissionsSummary(role: Role): string {
  const perms = ROLE_PERMISSIONS[role]
  if (!perms) return '—'
  if (perms.FullAccess) return 'Full access'
  const list = (Object.entries(perms) as [Permission, boolean][])
    .filter(([, v]) => v)
    .map(([k]) => k.replace(/([A-Z])/g, ' $1').trim())
  return list.length ? list.join(', ') : '—'
}

export default function AdminUsersPage() {
  const { role } = usePermissions()
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  const isAdmin = role === 'Admin'

  useEffect(() => {
    if (!isAdmin) return
    fetchUsers()
  }, [isAdmin])

  const fetchUsers = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/users')
      const data = await res.json()
      if (res.ok && Array.isArray(data)) {
        setUsers(data)
      } else {
        setError(typeof data?.error === 'string' ? data.error : 'Failed to load users')
      }
    } catch {
      setError('Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  const updateRole = async (userId: string, newRole: Role) => {
    setSavingId(userId)
    setSaveError(null)
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })
      const data = await res.json()
      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
        )
      } else {
        setSaveError(typeof data?.error === 'string' ? data.error : 'Failed to update role')
      }
    } catch {
      setSaveError('Failed to update role')
    } finally {
      setSavingId(null)
    }
  }

  if (!isAdmin) {
    return (
      <div className="max-w-7xl space-y-8">
        <h1 className="text-3xl font-bold text-white">Users & roles</h1>
        <Card className="border-amber-500/50 bg-amber-500/10">
          <CardContent className="p-6">
            <p className="text-amber-400 font-medium">You don’t have permission to view this page.</p>
            <p className="text-white/70 text-sm mt-1">Only Admins can manage user roles.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex max-w-7xl items-center justify-center py-24">
        <Loader2 className="h-10 w-10 animate-spin text-white/60" />
      </div>
    )
  }

  return (
    <div className="max-w-7xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white flex items-center gap-2">
          <ShieldUser className="h-8 w-8 text-white/80" />
          Users & roles
        </h1>
        <p className="mt-2 text-white/60">
          Edit user roles. Permissions are derived from each role.
        </p>
      </div>

      {error && (
        <Card className="border-red-500/50 bg-red-500/10">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0" />
            <p className="text-red-300">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchUsers}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {saveError && (
        <Card className="border-amber-500/50 bg-amber-500/10">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-amber-400 flex-shrink-0" />
            <p className="text-amber-300">{saveError}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-white/80">Email</TableHead>
                <TableHead className="text-white/80">Name</TableHead>
                <TableHead className="text-white/80">Role</TableHead>
                <TableHead className="text-white/80">Permissions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => {
                const currentRole = (user.role?.trim() && ROLES.includes(user.role as Role))
                  ? (user.role as Role)
                  : 'Distributor'
                return (
                  <TableRow key={user.id}>
                    <TableCell className="text-white font-medium">{user.email}</TableCell>
                    <TableCell className="text-white/80">{user.name ?? '—'}</TableCell>
                    <TableCell>
                      <Select
                        value={currentRole}
                        onValueChange={(value) => updateRole(user.id, value as Role)}
                        disabled={savingId === user.id}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLES.map((r) => (
                            <SelectItem key={r} value={r}>
                              {r}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {savingId === user.id && (
                        <Loader2 className="inline-block h-4 w-4 animate-spin text-white/60 ml-2" aria-hidden />
                      )}
                    </TableCell>
                    <TableCell className="text-white/60 text-sm max-w-xs truncate" title={permissionsSummary(currentRole)}>
                      {permissionsSummary(currentRole)}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {users.length === 0 && !error && (
        <Card>
          <CardContent className="py-12 text-center text-white/60">
            No users found.
          </CardContent>
        </Card>
      )}
    </div>
  )
}

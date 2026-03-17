'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ShieldUser, Loader2, AlertCircle, Pencil, Camera, Check, X, Building2, Upload, Copy } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const ROLES: Role[] = ['Admin', 'Sales Rep', 'Distributor', 'Technician']

interface CompanyRef {
  id: string
  name: string
  icon_url?: string | null
  logo_url?: string | null
}

interface UserRow {
  id: string
  email: string
  name: string | null
  role: string | null
  avatar_url?: string | null
  company_id?: string | null
  companies?: CompanyRef | null
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
  const router = useRouter()
  const { role } = usePermissions()
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [editingNameId, setEditingNameId] = useState<string | null>(null)
  const [editingNameValue, setEditingNameValue] = useState('')
  const [avatarUploadingId, setAvatarUploadingId] = useState<string | null>(null)
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([])
  const [importLoading, setImportLoading] = useState(false)
  const [importResult, setImportResult] = useState<{
    added: number
    skipped: number
    temporaryPassword?: string
    errors?: string[]
  } | null>(null)
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importDragOver, setImportDragOver] = useState(false)
  const avatarInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const csvInputRef = useRef<HTMLInputElement | null>(null)

  const isAdmin = role === 'Admin'
  const roleKnown = role !== null

  useEffect(() => {
    if (!roleKnown) return
    if (!isAdmin) {
      router.replace('/')
      return
    }
    fetchUsers()
  }, [roleKnown, isAdmin, router])

  const fetchUsers = async () => {
    setLoading(true)
    setError(null)
    try {
      const [usersRes, companiesRes] = await Promise.all([
        fetch('/api/admin/users'),
        fetch('/api/admin/companies'),
      ])
      const usersData = usersRes.ok ? await usersRes.json() : []
      const companiesData = companiesRes.ok ? await companiesRes.json() : []
      if (usersRes.ok && Array.isArray(usersData)) {
        setUsers(usersData)
      } else {
        setError(typeof (usersData?.error) === 'string' ? usersData.error : 'Failed to load users')
      }
      setCompanies(Array.isArray(companiesData) ? companiesData : [])
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

  const startEditingName = (user: UserRow) => {
    setEditingNameId(user.id)
    setEditingNameValue(user.name ?? '')
  }

  const cancelEditingName = () => {
    setEditingNameId(null)
    setEditingNameValue('')
  }

  const saveName = async (userId: string) => {
    setSavingId(userId)
    setSaveError(null)
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingNameValue.trim() || null }),
      })
      const data = await res.json()
      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) =>
            u.id === userId ? { ...u, name: data.name ?? u.name } : u
          )
        )
        setEditingNameId(null)
        setEditingNameValue('')
      } else {
        setSaveError(typeof data?.error === 'string' ? data.error : 'Failed to update name')
      }
    } catch {
      setSaveError('Failed to update name')
    } finally {
      setSavingId(null)
    }
  }

  const handleAvatarChange = async (userId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarUploadingId(userId)
    setSaveError(null)
    try {
      const formData = new FormData()
      formData.append('avatar', file)
      const res = await fetch(`/api/admin/users/${userId}/avatar`, {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (res.ok && data.avatar_url !== undefined) {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, avatar_url: data.avatar_url, updated_at: data.updated_at } : u))
        )
      } else {
        setSaveError(typeof data?.error === 'string' ? data.error : 'Failed to update photo')
      }
    } catch {
      setSaveError('Failed to update photo')
    } finally {
      setAvatarUploadingId(null)
      e.target.value = ''
    }
  }

  const triggerAvatarInput = (userId: string) => {
    avatarInputRefs.current[userId]?.click()
  }

  const updateCompany = async (userId: string, companyId: string | null) => {
    setSavingId(userId)
    setSaveError(null)
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: companyId }),
      })
      const data = await res.json()
      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) =>
            u.id === userId
              ? { ...u, company_id: data.company_id ?? companyId, companies: data.companies ?? u.companies }
              : u
          )
        )
      } else {
        setSaveError(typeof data?.error === 'string' ? data.error : 'Failed to update company')
      }
    } catch {
      setSaveError('Failed to update company')
    } finally {
      setSavingId(null)
    }
  }

  const displayPhotoUrl = (user: UserRow) => {
    if (user.avatar_url) return user.avatar_url
    return user.companies?.logo_url ?? null
  }

  const sortedUsers = [...users].sort((a, b) => {
    const nameA = (a.companies?.name ?? '').toLowerCase()
    const nameB = (b.companies?.name ?? '').toLowerCase()
    if (nameA === '' && nameB === '') return 0
    if (nameA === '') return 1
    if (nameB === '') return -1
    return nameA.localeCompare(nameB)
  })

  const handleImportCSV = async (file: File | null) => {
    if (!file) return
    setImportLoading(true)
    setImportResult(null)
    setSaveError(null)
    try {
      const formData = new FormData()
      formData.append('csv', file)
      const res = await fetch('/api/admin/users/import', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (res.ok) {
        setImportResult({
          added: data.added ?? 0,
          skipped: data.skipped ?? 0,
          temporaryPassword: data.temporaryPassword,
          errors: data.errors,
        })
        setImportFile(null)
        await fetchUsers()
      } else {
        setSaveError(data?.error || 'Import failed')
      }
    } catch {
      setSaveError('Import failed')
    } finally {
      setImportLoading(false)
    }
  }

  const onImportFileSelect = (file: File | null) => {
    if (!file) return
    const isCsv = file.name.toLowerCase().endsWith('.csv') || file.type === 'text/csv'
    if (!isCsv) {
      setSaveError('Please select a CSV file.')
      return
    }
    setImportFile(file)
    setSaveError(null)
  }

  const openImportDialog = () => {
    setImportDialogOpen(true)
    setImportFile(null)
    setImportResult(null)
    setSaveError(null)
  }

  const copyTempPassword = () => {
    if (importResult?.temporaryPassword) {
      navigator.clipboard.writeText(importResult.temporaryPassword)
    }
  }

  // Wait for role to load from cookie before deciding; avoid redirecting admins on first paint
  if (!roleKnown) {
    return (
      <div className="flex max-w-7xl items-center justify-center py-24">
        <Loader2 className="h-10 w-10 animate-spin text-white/60" />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="max-w-7xl space-y-8">
        <h1 className="text-3xl font-bold text-white">Users & roles</h1>
        <Card className="border-amber-500/50 bg-amber-500/10">
          <CardContent className="p-6">
            <p className="text-amber-400 font-medium">You don’t have permission to view this page.</p>
            <p className="text-white/70 text-sm mt-1">Redirecting to dashboard…</p>
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-2">
            <ShieldUser className="h-8 w-8 text-white/80" />
            Users & roles
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            disabled={importLoading}
            onClick={openImportDialog}
          >
            <Upload className="h-4 w-4 mr-2" />
            Import CSV
          </Button>
          <Link href="/admin/companies">
            <Button variant="outline">
              <Building2 className="h-4 w-4 mr-2" /> Company Profiles
            </Button>
          </Link>
        </div>
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

      {importResult && !importDialogOpen && (
        <Card className="border-green-500/50 bg-green-500/10">
          <CardContent className="p-4 space-y-2">
            <p className="text-green-300 font-medium">
              Import complete: {importResult.added} added, {importResult.skipped} skipped (existing email).
            </p>
            {importResult.temporaryPassword && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-white/80 text-sm">Temporary password for new users (share securely):</span>
                <code className="px-2 py-1 bg-black/20 rounded text-sm font-mono">{importResult.temporaryPassword}</code>
                <Button variant="ghost" size="sm" onClick={copyTempPassword} className="text-white/80 hover:text-white">
                  <Copy className="h-4 w-4 mr-1" /> Copy
                </Button>
              </div>
            )}
            {importResult.errors && importResult.errors.length > 0 && (
              <ul className="text-amber-300 text-sm list-disc list-inside mt-2">
                {importResult.errors.slice(0, 10).map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
                {importResult.errors.length > 10 && (
                  <li>… and {importResult.errors.length - 10} more</li>
                )}
              </ul>
            )}
            <Button variant="ghost" size="sm" className="text-white/60" onClick={() => setImportResult(null)}>
              Dismiss
            </Button>
          </CardContent>
        </Card>
      )}

      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-md border-white/20 bg-[#181818] text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Import users from CSV</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-white/60">Expected columns (first row = header):</p>
          <ul className="text-sm text-white/80 list-disc list-inside space-y-0.5">
            <li><strong>email</strong></li>
            <li><strong>name</strong></li>
            <li><strong>role</strong></li>
            <li><strong>company</strong></li>
          </ul>
          {!importResult ? (
            <>
              <input
                ref={csvInputRef}
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={(e) => onImportFileSelect(e.target.files?.[0] ?? null)}
                aria-label="Select CSV file"
              />
              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                  importDragOver ? 'border-blue-400 bg-blue-500/10' : 'border-white/30 bg-white/5'
                }`}
                onDragOver={(e) => { e.preventDefault(); setImportDragOver(true) }}
                onDragLeave={() => setImportDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setImportDragOver(false)
                  const file = e.dataTransfer.files?.[0]
                  onImportFileSelect(file ?? null)
                }}
                onClick={() => csvInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); csvInputRef.current?.click() } }}
                aria-label="Drop CSV file or click to browse"
              >
                {importFile ? (
                  <p className="text-white font-medium">{importFile.name}</p>
                ) : (
                  <>
                    <Upload className="h-10 w-10 mx-auto text-white/50 mb-2" />
                    <p className="text-white/80">Drop your CSV here or click to browse</p>
                  </>
                )}
              </div>
              {importFile && (
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" size="sm" onClick={() => setImportFile(null)}>
                    Clear
                  </Button>
                  <Button size="sm" disabled={importLoading} onClick={() => handleImportCSV(importFile)}>
                    {importLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Import
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-3">
              <p className="text-green-300 font-medium">
                {importResult.added} added, {importResult.skipped} skipped (existing email).
              </p>
              {importResult.temporaryPassword && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-white/80 text-sm">Temporary password (share securely):</span>
                  <code className="px-2 py-1 bg-black/20 rounded text-sm font-mono">{importResult.temporaryPassword}</code>
                  <Button variant="ghost" size="sm" onClick={copyTempPassword} className="text-white/80 hover:text-white">
                    <Copy className="h-4 w-4 mr-1" /> Copy
                  </Button>
                </div>
              )}
              {importResult.errors && importResult.errors.length > 0 && (
                <ul className="text-amber-300 text-sm list-disc list-inside">
                  {importResult.errors.slice(0, 5).map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                  {importResult.errors.length > 5 && <li>… and {importResult.errors.length - 5} more</li>}
                </ul>
              )}
              <Button className="w-full" onClick={() => { setImportResult(null); setImportDialogOpen(false) }}>
                Done
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-white/80 w-0">Photo</TableHead>
                <TableHead className="text-white/80">Email</TableHead>
                <TableHead className="text-white/80">Company</TableHead>
                <TableHead className="text-white/80">Name</TableHead>
                <TableHead className="text-white/80">Role</TableHead>
                <TableHead className="text-white/80">Permissions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedUsers.map((user) => {
                const currentRole = (user.role?.trim() && ROLES.includes(user.role as Role))
                  ? (user.role as Role)
                  : 'Distributor'
                const isEditingName = editingNameId === user.id
                const isSaving = savingId === user.id
                const isAvatarUploading = avatarUploadingId === user.id
                return (
                  <TableRow key={user.id}>
                    <TableCell className="w-0">
                      <input
                        ref={(el) => { avatarInputRefs.current[user.id] = el }}
                        type="file"
                        accept="image/jpeg,image/png,image/gif,image/webp"
                        className="sr-only"
                        onChange={(e) => handleAvatarChange(user.id, e)}
                        aria-label={`Change photo for ${user.email}`}
                      />
                      <button
                        type="button"
                        onClick={() => triggerAvatarInput(user.id)}
                        disabled={isAvatarUploading}
                        className="relative w-10 h-10 rounded-full bg-white/10 flex items-center justify-center overflow-hidden ring-2 ring-transparent hover:ring-white/30 focus:ring-white/50 focus:outline-none transition-all disabled:opacity-70 group"
                        title="Change photo"
                      >
                        <Image
                          src={
                            displayPhotoUrl(user)
                              ? `${displayPhotoUrl(user)}${(displayPhotoUrl(user) || '').includes('?') ? '&' : '?'}t=${user.updated_at || ''}`
                              : '/armadilloProfile.png'
                          }
                          alt=""
                          width={40}
                          height={40}
                          className="object-cover w-full h-full"
                          unoptimized={!!displayPhotoUrl(user)}
                        />
                        {isAvatarUploading ? (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                            <Loader2 className="w-5 h-5 text-white animate-spin" />
                          </div>
                        ) : (
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 flex items-center justify-center transition-colors">
                            <Camera className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        )}
                      </button>
                    </TableCell>
                    <TableCell className="text-white font-medium">{user.email}</TableCell>
                    <TableCell>
                      <Select
                        value={user.company_id ?? '__none__'}
                        onValueChange={(value) => updateCompany(user.id, value === '__none__' ? null : value)}
                        disabled={isSaving}
                      >
                        <SelectTrigger className="w-[160px]">
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">None</SelectItem>
                          {companies.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-white/80">
                      {isEditingName ? (
                        <div className="flex items-center gap-2">
                          <Input
                            value={editingNameValue}
                            onChange={(e) => setEditingNameValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveName(user.id)
                              if (e.key === 'Escape') cancelEditingName()
                            }}
                            className="h-8 w-48 bg-white/10 border-white/20 text-white text-sm"
                            placeholder="Name"
                            autoFocus
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-green-400 hover:text-green-300"
                            onClick={() => saveName(user.id)}
                            disabled={isSaving}
                            aria-label="Save name"
                          >
                            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-white/60 hover:text-white"
                            onClick={cancelEditingName}
                            disabled={isSaving}
                            aria-label="Cancel"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span>{user.name ?? '—'}</span>
                          <button
                            type="button"
                            onClick={() => startEditingName(user)}
                            className="p-1 rounded text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                            title="Edit name"
                            aria-label="Edit name"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={currentRole}
                        onValueChange={(value) => updateRole(user.id, value as Role)}
                        disabled={isSaving}
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
                      {isSaving && !isEditingName && (
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

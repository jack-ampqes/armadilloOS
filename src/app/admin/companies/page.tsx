'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Building2, Loader2, AlertCircle, Plus, Pencil, Camera, Check, X, Trash2 } from 'lucide-react'
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
import { usePermissions } from '@/lib/usePermissions'

interface Company {
  id: string
  name: string
  icon_url?: string | null
  logo_url?: string | null
  created_at?: string
  updated_at?: string
}

export default function AdminCompaniesPage() {
  const router = useRouter()
  const { role } = usePermissions()
  const [companies, setCompanies] = useState<Company[]>([])
  const [users, setUsers] = useState<{ id: string; company_id?: string | null }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [uploadingIconId, setUploadingIconId] = useState<string | null>(null)
  const [uploadingLogoId, setUploadingLogoId] = useState<string | null>(null)
  const iconInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const logoInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const isAdmin = role === 'Admin'
  const roleKnown = role !== null

  useEffect(() => {
    if (!roleKnown) return
    if (!isAdmin) {
      router.replace('/')
      return
    }
    fetchData()
  }, [roleKnown, isAdmin, router])

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [companiesRes, usersRes] = await Promise.all([
        fetch('/api/admin/companies'),
        fetch('/api/admin/users'),
      ])
      const companiesData = companiesRes.ok ? await companiesRes.json() : []
      const usersData = usersRes.ok ? await usersRes.json() : []
      setCompanies(Array.isArray(companiesData) ? companiesData : [])
      setUsers(Array.isArray(usersData) ? usersData : [])
    } catch {
      setError('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const userCount = (companyId: string) =>
    users.filter((u) => u.company_id === companyId).length

  const createCompany = async () => {
    const name = newName.trim()
    if (!name) return
    setCreating(true)
    setSaveError(null)
    try {
      const res = await fetch('/api/admin/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      const data = await res.json()
      if (res.ok) {
        setCompanies((prev) => [...prev, data])
        setNewName('')
      } else {
        setSaveError(data?.error || 'Failed to create company')
      }
    } catch {
      setSaveError('Failed to create company')
    } finally {
      setCreating(false)
    }
  }

  const updateCompanyName = async (id: string) => {
    setSaveError(null)
    try {
      const res = await fetch(`/api/admin/companies/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingName.trim() || companies.find((c) => c.id === id)?.name }),
      })
      const data = await res.json()
      if (res.ok) {
        setCompanies((prev) => prev.map((c) => (c.id === id ? { ...c, name: data.name } : c)))
        setEditingId(null)
      } else {
        setSaveError(data?.error || 'Failed to update name')
      }
    } catch {
      setSaveError('Failed to update name')
    }
  }

  const deleteCompany = async (id: string) => {
    if (!confirm('Remove this company? Users will be unassigned.')) return
    setSaveError(null)
    try {
      const res = await fetch(`/api/admin/companies/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setCompanies((prev) => prev.filter((c) => c.id !== id))
        setUsers((prev) => prev.map((u) => (u.company_id === id ? { ...u, company_id: null } : u)))
      } else {
        const data = await res.json()
        setSaveError(data?.error || 'Failed to delete company')
      }
    } catch {
      setSaveError('Failed to delete company')
    }
  }

  const uploadIcon = async (companyId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingIconId(companyId)
    setSaveError(null)
    try {
      const formData = new FormData()
      formData.append('icon', file)
      const res = await fetch(`/api/admin/companies/${companyId}/icon`, { method: 'POST', body: formData })
      const data = await res.json()
      if (res.ok) {
        setCompanies((prev) => prev.map((c) => (c.id === companyId ? { ...c, icon_url: data.icon_url } : c)))
      } else {
        setSaveError(data?.error || 'Failed to upload icon')
      }
    } catch {
      setSaveError('Failed to upload icon')
    } finally {
      setUploadingIconId(null)
      e.target.value = ''
    }
  }

  const uploadLogo = async (companyId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingLogoId(companyId)
    setSaveError(null)
    try {
      const formData = new FormData()
      formData.append('logo', file)
      const res = await fetch(`/api/admin/companies/${companyId}/logo`, { method: 'POST', body: formData })
      const data = await res.json()
      if (res.ok) {
        setCompanies((prev) => prev.map((c) => (c.id === companyId ? { ...c, logo_url: data.logo_url } : c)))
      } else {
        setSaveError(data?.error || 'Failed to upload logo')
      }
    } catch {
      setSaveError('Failed to upload logo')
    } finally {
      setUploadingLogoId(null)
      e.target.value = ''
    }
  }

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
        <h1 className="text-3xl font-bold text-white">Company Profiles</h1>
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
            <Building2 className="h-8 w-8 text-white/80" />
            Company Profiles
          </h1>
        </div>
        <Link href="/admin/users">
          <Button variant="outline">Users & roles</Button>
        </Link>
      </div>

      {error && (
        <Card className="border-red-500/50 bg-red-500/10">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0" />
            <p className="text-red-300">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchData}>
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

      {/* Create company */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Company name"
              className="w-48 bg-white/10 border-white/20 text-white"
              onKeyDown={(e) => e.key === 'Enter' && createCompany()}
            />
            <Button onClick={createCompany} disabled={creating || !newName.trim()}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              <span className="ml-2">Add company</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-white/80 w-0">Badge (icon)</TableHead>
                <TableHead className="text-white/80 w-0">Logo</TableHead>
                <TableHead className="text-white/80">Name</TableHead>
                <TableHead className="text-white/80">Users</TableHead>
                <TableHead className="w-0"><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {companies.map((company) => {
                const isEditing = editingId === company.id
                const count = userCount(company.id)
                return (
                  <TableRow key={company.id}>
                    <TableCell className="w-0">
                      <input
                        ref={(el) => { iconInputRefs.current[company.id] = el }}
                        type="file"
                        accept="image/jpeg,image/png,image/gif,image/webp"
                        className="sr-only"
                        onChange={(e) => uploadIcon(company.id, e)}
                        aria-label={`Upload badge for ${company.name}`}
                      />
                      <button
                        type="button"
                        onClick={() => iconInputRefs.current[company.id]?.click()}
                        disabled={!!uploadingIconId}
                        className="relative w-10 h-10 rounded bg-white/10 flex items-center justify-center overflow-hidden ring-2 ring-transparent hover:ring-white/30 disabled:opacity-70 group"
                        title="Upload badge icon"
                      >
                        {company.icon_url ? (
                          <Image
                            src={`${company.icon_url}${company.updated_at ? `?t=${company.updated_at}` : ''}`}
                            alt=""
                            width={40}
                            height={40}
                            className="object-contain w-full h-full"
                            unoptimized
                          />
                        ) : (
                          <Camera className="w-5 h-5 text-white/50" />
                        )}
                        {uploadingIconId === company.id && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                            <Loader2 className="w-5 h-5 text-white animate-spin" />
                          </div>
                        )}
                      </button>
                    </TableCell>
                    <TableCell className="w-0">
                      <input
                        ref={(el) => { logoInputRefs.current[company.id] = el }}
                        type="file"
                        accept="image/jpeg,image/png,image/gif,image/webp"
                        className="sr-only"
                        onChange={(e) => uploadLogo(company.id, e)}
                        aria-label={`Upload logo for ${company.name}`}
                      />
                      <button
                        type="button"
                        onClick={() => logoInputRefs.current[company.id]?.click()}
                        disabled={!!uploadingLogoId}
                        className="relative w-10 h-10 rounded-full bg-white/10 flex items-center justify-center overflow-hidden ring-2 ring-transparent hover:ring-white/30 disabled:opacity-70 group"
                        title="Upload logo (shared profile photo)"
                      >
                        {company.logo_url ? (
                          <Image
                            src={`${company.logo_url}${company.updated_at ? `?t=${company.updated_at}` : ''}`}
                            alt=""
                            width={40}
                            height={40}
                            className="object-cover w-full h-full"
                            unoptimized
                          />
                        ) : (
                          <Camera className="w-5 h-5 text-white/50" />
                        )}
                        {uploadingLogoId === company.id && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                            <Loader2 className="w-5 h-5 text-white animate-spin" />
                          </div>
                        )}
                      </button>
                    </TableCell>
                    <TableCell className="text-white/80">
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <Input
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            className="h-8 w-48 bg-white/10 border-white/20 text-white text-sm"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') updateCompanyName(company.id)
                              if (e.key === 'Escape') setEditingId(null)
                            }}
                            autoFocus
                          />
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-green-400" onClick={() => updateCompanyName(company.id)}>
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingId(null)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span>{company.name}</span>
                          <button
                            type="button"
                            onClick={() => { setEditingId(company.id); setEditingName(company.name); }}
                            className="p-1 rounded text-white/50 hover:text-white hover:bg-white/10"
                            title="Edit name"
                            aria-label="Edit name"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-white/60">
                      {count} user{count !== 1 ? 's' : ''}
                      {count > 0 && (
                        <Link href="/admin/users" className="ml-2 text-blue-400 hover:underline text-sm">
                          Manage
                        </Link>
                      )}
                    </TableCell>
                    <TableCell className="w-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        onClick={() => deleteCompany(company.id)}
                        title="Delete company"
                        aria-label="Delete company"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {companies.length === 0 && !error && (
        <Card>
          <CardContent className="py-12 text-center text-white/60">
            No companies yet. Add one above and assign users on the Users page.
          </CardContent>
        </Card>
      )}
    </div>
  )
}

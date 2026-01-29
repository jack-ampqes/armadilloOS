'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { User, Edit2, Save, X } from 'lucide-react'

interface UserProfile {
  id: string
  email: string
  name: string | null
  role: string
  created_at: string
  updated_at: string
}

interface ShopifyConnectionStatus {
  connected: boolean
  source: 'supabase' | 'env' | null
  shop?: string | null
  scope?: string | null
  installed_at?: string | null
  updated_at?: string | null
}

interface QuickBooksConnectionStatus {
  connected: boolean
  source: 'supabase' | 'env' | null
  realmId?: string | null
  expired?: boolean
  connected_by_email?: string | null
  updated_at?: string | null
}

function ProfilePageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
  })
  const [shopifyStatus, setShopifyStatus] = useState<ShopifyConnectionStatus | null>(null)
  const [shopDomain, setShopDomain] = useState('')
  const [shopifyError, setShopifyError] = useState('')
  const [quickbooksStatus, setQuickbooksStatus] = useState<QuickBooksConnectionStatus | null>(null)
  const [quickbooksError, setQuickbooksError] = useState('')
  const [quickbooksVerifyLoading, setQuickbooksVerifyLoading] = useState(false)
  const [quickbooksAccounts, setQuickbooksAccounts] = useState<
    Array<{ id?: string; name?: string; type?: string; subType?: string }> | null
  >(null)
  const [quickbooksVerifyError, setQuickbooksVerifyError] = useState('')

  useEffect(() => {
    const token = localStorage.getItem('auth_token')
    if (!token) {
      router.push('/login')
      return
    }

    fetchProfile()
    fetchShopifyStatus()
    fetchQuickBooksStatus()
  }, [router])

  useEffect(() => {
    if (searchParams.get('quickbooks') === 'connected') {
      fetchQuickBooksStatus()
      router.replace('/profile')
    }
  }, [searchParams])

  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem('auth_token')
      const userEmail = localStorage.getItem('user_email')
      if (!userEmail) {
        router.push('/login')
        return
      }
      const response = await fetch('/api/profile', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-User-Email': userEmail,
        },
      })

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/login')
          return
        }
        let errorData
        try {
          errorData = await response.json()
        } catch {
          errorData = { error: `HTTP ${response.status}: ${response.statusText}` }
        }
        console.error('Profile API error:', errorData)
        throw new Error(errorData.error || `Failed to fetch profile (${response.status})`)
      }

      const data = await response.json()
      setProfile(data)
      setFormData({
        name: data.name || '',
        email: data.email || '',
      })
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to load profile'
      setError(errorMessage)
      console.error('Profile fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchShopifyStatus = async () => {
    try {
      const res = await fetch('/api/shopify/connection')
      if (!res.ok) return
      const data = (await res.json()) as ShopifyConnectionStatus
      setShopifyStatus(data)
      if (data?.shop && !shopDomain) {
        setShopDomain(data.shop)
      }
    } catch {
      // ignore
    }
  }

  const fetchQuickBooksStatus = async () => {
    try {
      const res = await fetch('/api/quickbooks/connection')
      if (!res.ok) return
      const data = (await res.json()) as QuickBooksConnectionStatus
      setQuickbooksStatus(data)
    } catch {
      // ignore
    }
  }

  const handleConnectShopify = () => {
    setShopifyError('')
    const userEmail = localStorage.getItem('user_email') || ''
    if (!shopDomain.trim()) {
      setShopifyError('Enter your shop domain (e.g. "your-store.myshopify.com")')
      return
    }
    if (!userEmail) {
      setShopifyError('Missing user email in localStorage. Please log in again.')
      return
    }
    window.location.href = `/api/shopify/auth?shop=${encodeURIComponent(
      shopDomain.trim()
    )}&userEmail=${encodeURIComponent(userEmail)}`
  }

  const handleConnectQuickBooks = () => {
    setQuickbooksError('')
    const userEmail = localStorage.getItem('user_email') || ''
    if (!userEmail) {
      setQuickbooksError('Missing user email in localStorage. Please log in again.')
      return
    }
    window.location.href = `/api/quickbooks/auth?userEmail=${encodeURIComponent(userEmail)}`
  }

  const handleVerifyQuickBooks = async () => {
    setQuickbooksVerifyError('')
    setQuickbooksAccounts(null)
    setQuickbooksVerifyLoading(true)
    try {
      const res = await fetch('/api/quickbooks/accounts')
      const data = (await res.json()) as {
        ok?: boolean
        error?: string
        accounts?: Array<{ id?: string; name?: string; type?: string; subType?: string }>
      }
      if (data.ok && Array.isArray(data.accounts)) {
        setQuickbooksAccounts(data.accounts)
      } else {
        setQuickbooksVerifyError(data.error ?? 'Verification failed')
      }
    } catch {
      setQuickbooksVerifyError('Could not reach QuickBooks')
    } finally {
      setQuickbooksVerifyLoading(false)
    }
  }

  const handleSave = async () => {
    setError('')
    setSaving(true)

    try {
      const token = localStorage.getItem('auth_token')
      const userEmail = localStorage.getItem('user_email')
      if (!userEmail) {
        router.push('/login')
        return
      }
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-User-Email': userEmail,
        },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update profile')
      }

      const data = await response.json()
      setProfile(data)
      setEditing(false)
      
      // Update localStorage if email changed
      if (data.email && data.email !== localStorage.getItem('user_email')) {
        localStorage.setItem('user_email', data.email)
      }
      if (data.name) {
        localStorage.setItem('user_name', data.name)
      } else {
        localStorage.removeItem('user_name')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    if (profile) {
      setFormData({
        name: profile.name || '',
        email: profile.email || '',
      })
    }
    setEditing(false)
    setError('')
  }

  const getRoleBadgeVariant = (role: string) => {
    switch (role?.toLowerCase()) {
      case 'Admin':
        return 'destructive'
      case 'Rep':
        return 'warning'
      case 'Tech':
      default:
        return 'secondary'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#181818] flex items-center justify-center">
        <div className="text-white">Loading profile...</div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-[#181818] flex items-center justify-center">
        <div className="text-white">Failed to load profile</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#181818] flex items-start justify-start p-6 lg:pl-[10%]">
      <div className="max-w-2xl w-full">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">Profile</h1>
          <p className="text-white/60">Manage your account information</p>
        </div>

        <Card className="bg-[#1f1f1f] border-white/20 p-6">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center overflow-hidden">
                <Image 
                  src="/armadilloProfile.png" 
                  alt="Profile" 
                  width={64}
                  height={64}
                  className="object-contain"
                />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">
                  {profile.name || 'No name set'}
                </h2>
                <p className="text-white/60 text-sm">{profile.email}</p>
              </div>
            </div>
            <Badge variant={getRoleBadgeVariant(profile.role)} className="text-xs">
              {profile.role || 'user'}
            </Badge>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <Label htmlFor="name" className="text-white">
                Name
              </Label>
              {editing ? (
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="bg-white/10 border-white/20 text-white mt-1"
                  placeholder="Enter your name"
                />
              ) : (
                <div className="mt-1 px-3 py-2 bg-white/5 border border-white/10 rounded-md text-white">
                  {profile.name || 'Not set'}
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="email" className="text-white">
                Email
              </Label>
              {editing ? (
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="bg-white/10 border-white/20 text-white mt-1"
                  placeholder="Enter your email"
                />
              ) : (
                <div className="mt-1 px-3 py-2 bg-white/5 border border-white/10 rounded-md text-white">
                  {profile.email}
                </div>
              )}
            </div>

            <div>
              <Label className="text-white">Role</Label>
              <div className="mt-1">
                <Badge variant={getRoleBadgeVariant(profile.role)}>
                  {profile.role || 'user'}
                </Badge>
              </div>
              <p className="text-white/40 text-xs mt-1">
                Role cannot be changed from this page
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
              <div>
                <Label className="text-white/60 text-xs">Account Created</Label>
                <p className="text-white text-sm mt-1">
                  {formatDate(profile.created_at)}
                </p>
              </div>
              <div>
                <Label className="text-white/60 text-xs">Last Updated</Label>
                <p className="text-white text-sm mt-1">
                  {formatDate(profile.updated_at)}
                </p>
              </div>
            </div>
          </div>

          {/* Shopify / QuickBooks — Admin only */}
          {profile.role === 'Admin' && (
            <>
              <div className="mt-6 pt-6 border-t border-white/10 space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-white font-semibold">Shopify</h3>
                    <p className="text-white/60 text-sm">
                      Connect your store to track orders in armadilloOS.
                    </p>
                  </div>
                  <Badge variant={shopifyStatus?.connected ? 'success' : 'secondary'}>
                    {shopifyStatus?.connected ? 'Connected' : 'Not connected'}
                  </Badge>
                </div>

                <div>
                  <Label htmlFor="shopDomain" className="text-white">
                    Shop domain
                  </Label>
                  <Input
                    id="shopDomain"
                    value={shopDomain}
                    onChange={(e) => setShopDomain(e.target.value)}
                    className="bg-white/10 border-white/20 text-white mt-1"
                    placeholder='your-store.myshopify.com'
                  />
                  {shopifyStatus?.connected && shopifyStatus.shop && (
                    <p className="text-white/40 text-xs mt-2">
                      Connected to <span className="text-white/70">{shopifyStatus.shop}</span>
                      {shopifyStatus.source ? ` (via ${shopifyStatus.source})` : ''}
                    </p>
                  )}
                  {shopifyError && (
                    <p className="text-red-400 text-xs mt-2">{shopifyError}</p>
                  )}
                </div>

                <div className="flex justify-end">
                  <Button
                    type="button"
                    onClick={handleConnectShopify}
                    className="bg-white text-[#181818] hover:bg-white/90"
                  >
                    Connect Shopify
                  </Button>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-white/10 space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-white font-semibold">QuickBooks</h3>
                    <p className="text-white/60 text-sm">
                      Connect QuickBooks Online to sync estimates and invoices.
                    </p>
                  </div>
                  <Badge variant={quickbooksStatus?.connected ? 'success' : 'secondary'}>
                    {quickbooksStatus?.connected ? 'Connected' : 'Not connected'}
                  </Badge>
                </div>
                {quickbooksStatus?.connected && quickbooksStatus.realmId && (
                  <p className="text-white/40 text-xs">
                    Company ID: <span className="text-white/70">{quickbooksStatus.realmId}</span>
                    {quickbooksStatus.source ? ` (via ${quickbooksStatus.source})` : ''}
                  </p>
                )}
                {quickbooksError && (
                  <p className="text-red-400 text-xs">{quickbooksError}</p>
                )}
                {quickbooksStatus?.connected && (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleVerifyQuickBooks}
                      disabled={quickbooksVerifyLoading}
                      className="border-white/20 text-white hover:bg-white/10"
                    >
                      {quickbooksVerifyLoading ? 'Verifying...' : 'Verify connection'}
                    </Button>
                    {quickbooksVerifyError && (
                      <p className="text-red-400 text-xs">{quickbooksVerifyError}</p>
                    )}
                    {quickbooksAccounts && (
                      <div className="rounded-md border border-white/10 bg-white/5 p-3">
                        <p className="text-white/80 text-sm font-medium mb-2">
                          Connected and verified — chart of accounts (first 5):
                        </p>
                        <ul className="text-white/60 text-xs space-y-1">
                          {quickbooksAccounts.map((a, i) => (
                            <li key={a.id ?? i}>
                              {a.name ?? '—'} {a.type ? `(${a.type})` : ''}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                )}
                <div className="flex justify-end">
                  <Button
                    type="button"
                    onClick={handleConnectQuickBooks}
                    className="bg-white text-[#181818] hover:bg-white/90"
                  >
                    Connect QuickBooks
                  </Button>
                </div>
              </div>
            </>
          )}

          <div className="mt-6 flex justify-end space-x-3">
            {editing ? (
              <>
                <Button
                  variant="outline"
                  onClick={handleCancel}
                  disabled={saving}
                  className="border-white/20 text-white hover:bg-white/10"
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-white text-[#181818] hover:bg-white/90"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </>
            ) : (
              <Button
                onClick={() => setEditing(true)}
                className="bg-white text-[#181818] hover:bg-white/90"
              >
                <Edit2 className="w-4 h-4 mr-2" />
                Edit Profile
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}

export default function ProfilePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#181818] flex items-center justify-center">
        <div className="text-white">Loading profile...</div>
      </div>
    }>
      <ProfilePageContent />
    </Suspense>
  )
}

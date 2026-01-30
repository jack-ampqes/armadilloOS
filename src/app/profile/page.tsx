'use client'

import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import Cropper from 'react-easy-crop'
import type { Area } from 'react-easy-crop'
import 'react-easy-crop/react-easy-crop.css'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { getCroppedImg } from '@/lib/crop-image'
import { User, Edit2, Save, X, Camera, Loader2, ChevronDown } from 'lucide-react'

interface UserProfile {
  id: string
  email: string
  name: string | null
  role: string
  avatar_url?: string | null
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
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [avatarError, setAvatarError] = useState('')
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const [cropperOpen, setCropperOpen] = useState(false)
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null)
  const [fileToCrop, setFileToCrop] = useState<File | null>(null)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [shopifyOpen, setShopifyOpen] = useState(false)
  const [quickbooksOpen, setQuickbooksOpen] = useState(false)

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

  const handleAvatarClick = () => {
    setAvatarError('')
    avatarInputRef.current?.click()
  }

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarError('')
    setCroppedAreaPixels(null)
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setFileToCrop(file)
    setCropImageSrc(URL.createObjectURL(file))
    setCropperOpen(true)
    e.target.value = ''
  }

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels)
  }, [])

  const onCropAreaChange = useCallback((_: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels)
  }, [])

  const handleCropCancel = useCallback(() => {
    if (cropImageSrc) URL.revokeObjectURL(cropImageSrc)
    setCropperOpen(false)
    setCropImageSrc(null)
    setFileToCrop(null)
    setCroppedAreaPixels(null)
  }, [cropImageSrc])

  const handleCropConfirm = async () => {
    if (!cropImageSrc || !fileToCrop || !croppedAreaPixels) return
    setAvatarUploading(true)
    try {
      const blob = await getCroppedImg(cropImageSrc, croppedAreaPixels)
      const token = localStorage.getItem('auth_token')
      const userEmail = localStorage.getItem('user_email')
      if (!token || !userEmail) {
        setAvatarError('Please log in again.')
        return
      }
      const file = new File([blob], fileToCrop.name.replace(/\.[^.]+$/, '.jpg') || 'avatar.jpg', {
        type: 'image/jpeg',
      })
      const formData = new FormData()
      formData.append('avatar', file)
      const response = await fetch('/api/profile/avatar', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-User-Email': userEmail,
        },
        body: formData,
      })
      const data = await response.json()
      if (!response.ok) {
        setAvatarError(data.error || 'Failed to upload picture')
        return
      }
      setProfile(data)
      handleCropCancel()
    } catch {
      setAvatarError('Failed to crop or upload picture')
    } finally {
      setAvatarUploading(false)
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
      <Dialog open={cropperOpen} onOpenChange={(open) => !open && handleCropCancel()}>
        <DialogContent className="max-w-lg bg-[#1f1f1f] border-white/20 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Crop your profile picture</DialogTitle>
          </DialogHeader>
          <div className="relative h-[min(70vmin,360px)] w-full bg-black/40 rounded-lg overflow-hidden">
            {cropImageSrc && (
              <Cropper
                image={cropImageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                minZoom={1}
                maxZoom={3}
                zoomSpeed={1}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
                onCropAreaChange={onCropAreaChange}
                style={{
                  containerStyle: { backgroundColor: 'transparent' },
                  cropAreaStyle: { border: '2px solid rgba(255,255,255,0.6)' },
                }}
                classes={{ containerClassName: 'bg-transparent' }}
                restrictPosition={true}
                mediaProps={{}}
                cropperProps={{}}
                rotation={0}
                roundCropAreaPixels={true}
                keyboardStep={0.5}
              />
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={handleCropCancel}
              className="border-white/20 text-white hover:bg-white/10"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleCropConfirm}
              disabled={avatarUploading || !croppedAreaPixels}
              className="bg-white text-[#181818] hover:bg-white/90"
            >
              {avatarUploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading…
                </>
              ) : (
                'Use photo'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="max-w-2xl w-full">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">Profile</h1>
          <p className="text-white/60">Manage your account information</p>
        </div>

        <Card className="bg-[#1f1f1f] border-white/20 p-6">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center space-x-4">
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="hidden"
                onChange={handleAvatarChange}
              />
              <div className="flex flex-col items-center gap-1">
                <button
                  type="button"
                  onClick={handleAvatarClick}
                  disabled={avatarUploading}
                  className="relative w-16 h-16 rounded-full bg-white/10 flex items-center justify-center overflow-hidden ring-2 ring-transparent hover:ring-white/30 focus:ring-white/50 focus:outline-none transition-all disabled:opacity-70 disabled:pointer-events-none group"
                  aria-label="Change profile picture"
                >
                  <Image
                    src={
                      profile.avatar_url
                        ? `${profile.avatar_url}${profile.avatar_url.includes('?') ? '&' : '?'}t=${profile.updated_at || ''}`
                        : '/armadilloProfile.png'
                    }
                    alt="Profile"
                    width={64}
                    height={64}
                    className="object-cover w-full h-full"
                    unoptimized={!!profile.avatar_url}
                  />
                  {avatarUploading ? (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <Loader2 className="w-6 h-6 text-white animate-spin" />
                    </div>
                  ) : (
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 flex items-center justify-center transition-colors">
                      <Camera className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  )}
                </button>
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

          {(error || avatarError) && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg">
              <p className="text-red-400 text-sm">{error || avatarError}</p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <Label htmlFor={editing ? 'name' : undefined} className="text-white">
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
              <Label htmlFor={editing ? 'email' : undefined} className="text-white">
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
              <div className="mt-6 pt-6 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShopifyOpen((o) => !o)}
                  className="flex w-full items-center justify-between gap-4 rounded-md py-1 text-left hover:bg-white/5 transition-colors"
                  aria-expanded={shopifyOpen}
                >
                  <div className="flex items-center gap-2">
                    <ChevronDown
                      className={`h-5 w-5 text-white/60 shrink-0 transition-transform ${shopifyOpen ? '' : '-rotate-90'}`}
                    />
                    <div>
                      <h3 className="text-white font-semibold">Shopify</h3>

                    </div>
                  </div>
                  <Badge variant={shopifyStatus?.connected ? 'success' : 'secondary'}>
                    {shopifyStatus?.connected ? 'Connected' : 'Not connected'}
                  </Badge>
                </button>
                {shopifyOpen && (
                  <div className="mt-4 space-y-4 pl-7">
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
                )}
              </div>

              <div className="mt-6 pt-6 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setQuickbooksOpen((o) => !o)}
                  className="flex w-full items-center justify-between gap-4 rounded-md py-1 text-left hover:bg-white/5 transition-colors"
                  aria-expanded={quickbooksOpen}
                >
                  <div className="flex items-center gap-2">
                    <ChevronDown
                      className={`h-5 w-5 text-white/60 shrink-0 transition-transform ${quickbooksOpen ? '' : '-rotate-90'}`}
                    />
                    <div>
                      <h3 className="text-white font-semibold">QuickBooks</h3>
                    </div>
                  </div>
                  <Badge variant={quickbooksStatus?.connected ? 'success' : 'secondary'}>
                    {quickbooksStatus?.connected ? 'Connected' : 'Not connected'}
                  </Badge>
                </button>
                {quickbooksOpen && (
                  <div className="mt-4 space-y-4 pl-7">
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
                )}
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

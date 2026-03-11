'use client'

import Image from 'next/image'

export interface CompanyRef {
  id: string
  name: string
  icon_url?: string | null
  logo_url?: string | null
}

/** Display photo URL: user's own avatar if set, else company logo (shared default). */
export function getDisplayPhotoUrl(
  avatarUrl: string | null | undefined,
  companyLogoUrl: string | null | undefined
): string | null {
  if (avatarUrl) return avatarUrl
  return companyLogoUrl ?? null
}

interface UserDisplayProps {
  name: string | null
  email?: string | null
  avatarUrl?: string | null
  company?: CompanyRef | null
  updatedAt?: string | null
  /** Size of the avatar in pixels */
  avatarSize?: number
  /** Show company badge (icon) next to name */
  showCompanyBadge?: boolean
  /** Show email below name */
  showEmail?: boolean
  className?: string
}

/**
 * Renders a user with optional avatar (company logo or personal), name, and company badge.
 * Use wherever users are "mentioned" to show consistent branding.
 */
export function UserDisplay({
  name,
  email,
  avatarUrl,
  company,
  updatedAt,
  avatarSize = 32,
  showCompanyBadge = true,
  showEmail,
  className = '',
}: UserDisplayProps) {
  const photoUrl = getDisplayPhotoUrl(avatarUrl, company?.logo_url)
  const displayName = name?.trim() || 'Unknown'

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      {photoUrl && (
        <Image
          src={`${photoUrl}${updatedAt ? `?t=${updatedAt}` : ''}`}
          alt=""
          width={avatarSize}
          height={avatarSize}
          className="rounded-full object-cover flex-shrink-0"
          unoptimized
        />
      )}
      <span className="flex flex-col min-w-0">
        <span className="flex items-center gap-1.5">
          <span className="font-medium text-white truncate">{displayName}</span>
          {showCompanyBadge && company?.icon_url && (
            <Image
              src={`${company.icon_url}${updatedAt ? `?t=${updatedAt}` : ''}`}
              alt=""
              width={18}
              height={18}
              className="object-contain rounded flex-shrink-0"
              unoptimized
              title={company.name}
            />
          )}
        </span>
        {showEmail && email && (
          <span className="text-white/60 text-xs truncate">{email}</span>
        )}
      </span>
    </span>
  )
}

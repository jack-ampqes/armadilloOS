'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'

interface SyncedGifProps {
  src: string
  alt: string
  width?: number
  height?: number
  className?: string
  priority?: boolean
  unoptimized?: boolean
}

// Shared timestamp to sync all GIFs - initialized on client only
let syncTimestamp: number | null = null
let isInitialized = false

export function SyncedGif({ 
  src, 
  alt, 
  width, 
  height, 
  className, 
  priority = false,
  unoptimized = false 
}: SyncedGifProps) {
  // Start with null to match server render, then update on client
  const [syncKey, setSyncKey] = useState<number | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // Mark as mounted (client-side only)
    setMounted(true)
    
    // Initialize sync timestamp on first mount
    if (!isInitialized) {
      syncTimestamp = Date.now()
      isInitialized = true
    }
    
    // Use the shared timestamp
    if (syncTimestamp) {
      setSyncKey(syncTimestamp)
    }
  }, [])

  // During SSR and initial render, use the original src without sync param
  // After hydration, use the synced src
  const imageSrc = mounted && syncKey ? `${src}?sync=${syncKey}` : src

  if (width && height) {
    return (
      <Image
        src={imageSrc}
        alt={alt}
        width={width}
        height={height}
        className={className}
        priority={priority}
        unoptimized={unoptimized}
        key={mounted ? syncKey : 'initial'}
      />
    )
  }

  return (
    <div className={className} style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Image
        src={imageSrc}
        alt={alt}
        fill
        priority={priority}
        unoptimized={unoptimized}
        key={mounted ? syncKey : 'initial'}
        style={{ objectFit: 'contain' }}
      />
    </div>
  )
}

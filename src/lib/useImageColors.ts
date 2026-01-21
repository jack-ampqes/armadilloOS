'use client'

import { useState, useEffect } from 'react'

interface ImageColors {
  dominant: string | null
  vibrant: string | null
  loading: boolean
}

// Extract dominant color from an image using canvas
export function useImageColors(imageUrl: string | null): ImageColors {
  const [colors, setColors] = useState<ImageColors>({
    dominant: null,
    vibrant: null,
    loading: true,
  })

  useEffect(() => {
    if (!imageUrl) {
      setColors({ dominant: null, vibrant: null, loading: false })
      return
    }

    const img = new Image()
    img.crossOrigin = 'anonymous'
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        
        if (!ctx) {
          setColors({ dominant: null, vibrant: null, loading: false })
          return
        }

        // Scale down for performance
        const scale = Math.min(1, 100 / Math.max(img.width, img.height))
        canvas.width = img.width * scale
        canvas.height = img.height * scale
        
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const pixels = imageData.data
        
        // Color frequency map
        const colorCounts: Record<string, { count: number; r: number; g: number; b: number; saturation: number }> = {}
        
        for (let i = 0; i < pixels.length; i += 4) {
          const r = pixels[i]
          const g = pixels[i + 1]
          const b = pixels[i + 2]
          const a = pixels[i + 3]
          
          // Skip transparent/near-transparent pixels
          if (a < 128) continue
          
          // Skip very light colors (likely background)
          const brightness = (r + g + b) / 3
          if (brightness > 240) continue
          
          // Skip very dark colors
          if (brightness < 15) continue
          
          // Calculate saturation
          const max = Math.max(r, g, b)
          const min = Math.min(r, g, b)
          const saturation = max === 0 ? 0 : (max - min) / max
          
          // Quantize to reduce similar colors (group into buckets of 24)
          const qr = Math.round(r / 24) * 24
          const qg = Math.round(g / 24) * 24
          const qb = Math.round(b / 24) * 24
          
          const key = `${qr},${qg},${qb}`
          
          if (!colorCounts[key]) {
            colorCounts[key] = { count: 0, r: qr, g: qg, b: qb, saturation }
          }
          colorCounts[key].count++
          // Update saturation if this pixel is more saturated
          if (saturation > colorCounts[key].saturation) {
            colorCounts[key].saturation = saturation
          }
        }
        
        // Convert to array and sort
        const sortedColors = Object.values(colorCounts)
          .filter(c => c.count > 10) // Minimum pixel count threshold
          .sort((a, b) => b.count - a.count)
        
        // Find most frequent color
        const dominant = sortedColors[0]
        
        // Find most vibrant (saturated) color
        const vibrant = [...sortedColors]
          .sort((a, b) => b.saturation - a.saturation)[0]
        
        const toHex = (c: { r: number; g: number; b: number }) => {
          const toHexVal = (n: number) => Math.min(255, Math.max(0, n)).toString(16).padStart(2, '0')
          return `#${toHexVal(c.r)}${toHexVal(c.g)}${toHexVal(c.b)}`
        }
        
        setColors({
          dominant: dominant ? toHex(dominant) : null,
          vibrant: vibrant ? toHex(vibrant) : null,
          loading: false,
        })
      } catch (error) {
        console.error('Error extracting colors:', error)
        setColors({ dominant: null, vibrant: null, loading: false })
      }
    }
    
    img.onerror = () => {
      setColors({ dominant: null, vibrant: null, loading: false })
    }
    
    img.src = imageUrl
  }, [imageUrl])

  return colors
}

// Helper to determine if a color is light or dark
export function isLightColor(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const brightness = (r * 299 + g * 587 + b * 114) / 1000
  return brightness > 128
}

// Generate complementary colors
export function getColorVariants(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  
  return {
    base: hex,
    light: `rgba(${r}, ${g}, ${b}, 0.2)`,
    medium: `rgba(${r}, ${g}, ${b}, 0.5)`,
    border: `rgba(${r}, ${g}, ${b}, 0.4)`,
    text: isLightColor(hex) ? '#000000' : '#ffffff',
  }
}

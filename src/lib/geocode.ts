/**
 * Geocode an address to lat/lng using OpenStreetMap Nominatim.
 * Rate limit: 1 request per second. Cache results when possible.
 */

export interface GeocodeResult {
  latitude: number
  longitude: number
  displayName?: string
}

/** Make address more geocode-friendly for US map (append country if missing). */
function normalizeAddressForGeocode(address: string): string {
  const trimmed = address.trim()
  if (!trimmed) return ''
  const lower = trimmed.toLowerCase()
  if (
    lower.includes('usa') ||
    lower.includes('united states') ||
    lower.includes('u.s.') ||
    lower.includes('u.s.a')
  ) {
    return trimmed
  }
  return `${trimmed}, USA`
}

async function fetchGeocode(query: string): Promise<GeocodeResult | null> {
  try {
    const params = new URLSearchParams({
      q: query,
      format: 'json',
      limit: '1'
    })
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?${params}`,
      {
        headers: {
          'User-Agent': 'ArmadilloSafety/1.0 (https://armadillosafety.com)'
        }
      }
    )
    if (!res.ok) return null
    const data = await res.json()
    if (!Array.isArray(data) || data.length === 0) return null
    const first = data[0]
    const lat = parseFloat(first.lat)
    const lon = parseFloat(first.lon)
    if (isNaN(lat) || isNaN(lon)) return null
    return {
      latitude: lat,
      longitude: lon,
      displayName: first.display_name
    }
  } catch {
    return null
  }
}

export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const trimmed = address.trim()
  if (!trimmed) return null

  const query = normalizeAddressForGeocode(trimmed)
  let result = await fetchGeocode(query)
  if (!result && query !== trimmed) {
    await new Promise((r) => setTimeout(r, 1100))
    result = await fetchGeocode(trimmed)
  }
  return result
}


import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { geocodeAddress } from '@/lib/geocode'

/** GET /api/distributors/map - Distributors with map pinpoints (longitude/latitude on distributor). */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const forceGeocode = searchParams.get('force_geocode') === '1'

    let distributors: Array<Record<string, unknown>> | null = null
    let distError: { code?: string } | null = null

    const withColor = await supabase
      .from('distributors')
      .select('id, name, contact_name, email, phone, color, address, longitude, latitude')
      .order('name', { ascending: true })

    if (withColor.error?.code === '42703') {
      // Columns may not exist yet; try without longitude/latitude
      const fallback = await supabase
        .from('distributors')
        .select('id, name, contact_name, email, phone, address')
        .order('name', { ascending: true })
      distributors = fallback.data?.map((d) => ({ ...d, color: null, longitude: null, latitude: null })) ?? null
      distError = fallback.error
    } else {
      distributors = withColor.data
      distError = withColor.error
    }
    if (distError) throw distError

    // For distributors with address: ensure we have lat/long (geocode if missing or force refresh)
    for (const d of distributors ?? []) {
      const distId = d.id as string
      const addressStr = (d.address as string)?.trim()
      if (!addressStr) continue

      const hasCoords = d.longitude != null && d.latitude != null && !forceGeocode
      if (hasCoords) continue

      const geo = await geocodeAddress(addressStr)
      if (!geo) continue

      // Nominatim rate limit: 1 req/sec
      await new Promise((r) => setTimeout(r, 1100))

      const { error: updateErr } = await supabase
        .from('distributors')
        .update({
          longitude: Number(geo.longitude),
          latitude: Number(geo.latitude)
        })
        .eq('id', distId)

      if (!updateErr) {
        d.longitude = geo.longitude
        d.latitude = geo.latitude
      } else {
        console.error('Map: failed to save geocoded coords for distributor', distId, updateErr)
      }
    }

    // Transform to locations array format for map (one pin per distributor from address column)
    const isValidCoord = (n: unknown): n is number =>
      typeof n === 'number' && !isNaN(n) && n !== null && n !== undefined
    const validLat = (n: number) => n >= -90 && n <= 90
    const validLng = (n: number) => n >= -180 && n <= 180

    const transformed = (distributors ?? []).map((d: Record<string, unknown>) => {
      const lng = d.longitude as number | null | undefined
      const lat = d.latitude as number | null | undefined
      const hasValidCoords =
        isValidCoord(lng) &&
        isValidCoord(lat) &&
        validLat(lat) &&
        validLng(lng)
      const locations =
        hasValidCoords
          ? [{ id: d.id, longitude: lng as number, latitude: lat as number, label: 'Address' as const }]
          : []
      return {
        id: d.id,
        name: d.name,
        contactName: d.contact_name,
        email: d.email,
        phone: d.phone,
        address: d.address ?? null,
        color: d.color ?? null,
        locations
      }
    })

    return NextResponse.json(transformed)
  } catch (error) {
    console.error('Error fetching distributors for map:', error)
    return NextResponse.json(
      { error: 'Failed to fetch distributors' },
      { status: 500 }
    )
  }
}

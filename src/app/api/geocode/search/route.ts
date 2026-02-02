import { NextResponse } from 'next/server'

/** GET /api/geocode/search?q=... - Address search for autocomplete. Returns suggestions with lat/long. */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')?.trim()
    if (!q || q.length < 3) {
      return NextResponse.json([])
    }

    const params = new URLSearchParams({
      q: `${q}, USA`,
      format: 'json',
      limit: '8'
    })

    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?${params}`,
      {
        headers: {
          'User-Agent': 'ArmadilloSafety/1.0 (https://armadillosafety.com)'
        }
      }
    )
    if (!res.ok) return NextResponse.json([])

    const data = await res.json()
    if (!Array.isArray(data)) return NextResponse.json([])

    const results = data.map((item: { display_name: string; lat: string; lon: string }) => ({
      displayName: item.display_name,
      latitude: parseFloat(item.lat),
      longitude: parseFloat(item.lon)
    })).filter((r: { latitude: number; longitude: number }) => !isNaN(r.latitude) && !isNaN(r.longitude))

    return NextResponse.json(results)
  } catch {
    return NextResponse.json([])
  }
}

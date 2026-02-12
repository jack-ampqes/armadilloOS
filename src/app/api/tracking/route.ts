import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth'
import { getEffectiveTrackingUrl, isFedExCarrier } from '@/lib/tracking'
import type { TrackingDetails, TrackingEvent } from '@/lib/tracking'

/**
 * POST /api/tracking
 * Fetch tracking details for a shipment.
 * Body: { trackingNumber: string, carrier?: string, trackingUrl?: string }
 *
 * When carrier is FedEx and FEDEX_CLIENT_ID + FEDEX_CLIENT_SECRET are set,
 * fetches real-time tracking events from FedEx Basic Integrated Visibility API.
 * Otherwise returns the tracking URL for manual lookup.
 */
export async function POST(request: NextRequest) {
  const auth = requirePermission(request, 'ManufacturerOrders')
  if ('response' in auth) {
    return auth.response
  }

  try {
    const body = await request.json()
    const trackingNumber = (body.trackingNumber || '').trim()
    const carrier = body.carrier || ''
    const existingTrackingUrl = body.trackingUrl || null

    if (!trackingNumber) {
      return NextResponse.json(
        { error: 'trackingNumber is required' },
        { status: 400 }
      )
    }

    const trackingUrl =
      getEffectiveTrackingUrl(existingTrackingUrl, carrier, trackingNumber)

    const result: TrackingDetails = {
      trackingNumber,
      carrier: carrier || 'Unknown',
      status: 'unknown',
      events: [],
      trackingUrl: trackingUrl || '',
    }

    // Try FedEx API when carrier is FedEx and credentials are configured
    if (isFedExCarrier(carrier)) {
      const fedexResult = await fetchFedExTracking(trackingNumber)
      if (fedexResult) {
        result.events = fedexResult.events
        result.status = fedexResult.status
        result.estimatedDelivery = fedexResult.estimatedDelivery
        result.origin = fedexResult.origin
        result.destination = fedexResult.destination
      }
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Tracking API error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch tracking',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/** FedEx Track API - Basic Integrated Visibility (from Postman collection) */
async function fetchFedExTracking(
  trackingNumber: string
): Promise<{
  events: TrackingEvent[]
  status: TrackingDetails['status']
  estimatedDelivery?: string
  origin?: string
  destination?: string
} | null> {
  const clientId = process.env.FEDEX_CLIENT_ID?.trim()
  const clientSecret = process.env.FEDEX_CLIENT_SECRET?.trim()
  const useSandbox = process.env.FEDEX_SANDBOX !== 'false'

  if (!clientId || !clientSecret) {
    return null
  }

  const baseUrl = useSandbox
    ? 'https://apis-sandbox.fedex.com'
    : 'https://apis.fedex.com'

  // 1. Get OAuth token
  const tokenRes = await fetch(`${baseUrl}/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
  })

  if (!tokenRes.ok) {
    console.error('FedEx OAuth failed:', await tokenRes.text())
    return null
  }

  const tokenData = await tokenRes.json()
  const accessToken = tokenData.access_token

  if (!accessToken) return null

  // 2. Call Track API - format from Postman collection
  const trackRes = await fetch(`${baseUrl}/track/v1/trackingnumbers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      'X-locale': 'en_US',
    },
    body: JSON.stringify({
      trackingInfo: [
        {
          trackingNumberInfo: {
            trackingNumber: trackingNumber,
          },
        },
      ],
      includeDetailedScans: true,
    }),
  })

  if (!trackRes.ok) {
    console.error('FedEx Track API failed:', trackRes.status, await trackRes.text())
    return null
  }

  const trackData = await trackRes.json()

  // Parse FedEx response - output.completeTrackResults[0].trackResults[0]
  const completeTrackResults = trackData?.output?.completeTrackResults
  if (!Array.isArray(completeTrackResults) || completeTrackResults.length === 0) {
    return null
  }

  const trackResults = completeTrackResults[0]?.trackResults
  if (!Array.isArray(trackResults) || trackResults.length === 0) {
    return null
  }

  const trackResult = trackResults[0]
  const scanEvents = trackResult?.scanEvents || []
  const latestStatus = trackResult?.latestStatusDetail?.description || ''
  const estimatedDelivery =
    trackResult?.dateAndTimes?.find(
      (d: { type: string }) => d.type === 'ESTIMATED_DELIVERY'
    )?.dateTime || trackResult?.estimatedDeliveryTimeWindow?.window?.begins

  // FedEx eventType codes -> human description (when eventDescription is missing)
  const EVENT_TYPE_MAP: Record<string, string> = {
    DL: 'Delivered',
    PU: 'Picked up',
    OD: 'Out for delivery',
    DP: 'Departed',
    AR: 'Arrived',
    IT: 'In transit',
    OC: 'Order created',
    OF: 'Ready for shipment',
    AA: 'At airport',
    AD: 'At delivery',
    AF: 'At FedEx facility',
    AP: 'At pickup',
    TR: 'In transit',
    PL: 'Plane landed',
    LO: 'Left origin',
  }

  const events: TrackingEvent[] = scanEvents.map((evt: Record<string, unknown>) => {
    // Handle both date+time and combined timestamp (FedEx uses both formats)
    let date = (evt.date as string) || ''
    let time = (evt.time as string) || ''
    const timestamp = evt.timestamp as string | undefined
    if (timestamp) {
      const d = new Date(timestamp)
      if (!isNaN(d.getTime())) {
        date = d.toISOString().split('T')[0]
        time = d.toTimeString().slice(0, 8) // HH:mm:ss
      }
    }

    // Location: scanLocation or address (FedEx uses both)
    const scanLoc = (evt.scanLocation || evt.address) as
      | { city?: string; stateOrProvinceCode?: string }
      | undefined
    const locParts = scanLoc
      ? [scanLoc.city, scanLoc.stateOrProvinceCode].filter(Boolean)
      : []
    const locStr = locParts.length ? locParts.join(', ') : undefined

    const eventType = evt.eventType as string | undefined
    const description =
      (evt.eventDescription as string) ||
      (eventType ? EVENT_TYPE_MAP[eventType] : null) ||
      (evt.eventType as string) ||
      'Scan'

    return {
      date,
      time,
      location: locStr,
      description,
      eventType,
      status: evt.derivedStatus as string | undefined,
    }
  })

  // Sort by date (oldest first) so deriveHighlights can correctly find origin/destination
  events.sort((a, b) => {
    const da = new Date(a.date + (a.time ? `T${a.time}` : '')).getTime()
    const db = new Date(b.date + (b.time ? `T${b.time}` : '')).getTime()
    return da - db
  })

  // Map FedEx status to our status (check "out for delivery" before "delivery" - it contains that substring)
  let status: TrackingDetails['status'] = 'unknown'
  const statusLower = latestStatus.toLowerCase()
  if (
    statusLower.includes('out for delivery') ||
    statusLower.includes('on vehicle')
  ) {
    status = 'out_for_delivery'
  } else if (statusLower.includes('delivered')) {
    status = 'delivered'
  } else if (
    statusLower.includes('transit') ||
    statusLower.includes('picked up') ||
    statusLower.includes('departed')
  ) {
    status = 'in_transit'
  } else if (statusLower.includes('exception') || statusLower.includes('exception')) {
    status = 'exception'
  } else if (statusLower.includes('pending') || statusLower.includes('label')) {
    status = 'pending'
  }

  // Extract actual origin/destination from FedEx (avoids transit hubs like Greenwood, IN)
  const toLocStr = (loc: unknown): string | undefined => {
    if (!loc || typeof loc !== 'object') return undefined
    const o = loc as Record<string, unknown>
    const addr = (o.address || o) as { city?: string; stateOrProvinceCode?: string }
    const parts = [addr.city, addr.stateOrProvinceCode].filter(Boolean)
    return parts.length ? parts.join(', ') : undefined
  }
  const origin = toLocStr(trackResult?.originLocation)
  const destination = toLocStr(trackResult?.destinationLocation)

  return {
    events,
    status,
    estimatedDelivery: estimatedDelivery || undefined,
    origin: origin || undefined,
    destination: destination || undefined,
  }
}

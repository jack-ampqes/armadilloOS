/**
 * Shipping tracking utilities - generates tracking URLs and supports FedEx API integration.
 * Based on FedEx Basic Integrated Visibility (Track API) Postman collection format.
 */

/** Carrier names as stored in the database */
export type TrackingCarrier = 'FedEx' | 'UPS' | 'USPS' | 'DHL' | 'Freight' | 'Other'

/** A single tracking scan event from a carrier API */
export interface TrackingEvent {
  date: string
  time?: string
  location?: string
  description: string
  eventType?: string
  status?: string
}

/** Normalized tracking response from our API */
export interface TrackingDetails {
  trackingNumber: string
  carrier: string
  status: 'pending' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'exception' | 'unknown'
  estimatedDelivery?: string
  events: TrackingEvent[]
  trackingUrl: string
  /** Actual origin from carrier (city, state) - avoids transit hubs */
  origin?: string
  /** Actual destination from carrier (city, state) - avoids transit hubs */
  destination?: string
}

/**
 * Get the public tracking URL for a carrier + tracking number.
 * Use this when tracking_url is not stored - we can always generate a clickable link.
 */
export function getTrackingUrl(
  carrier: string | null | undefined,
  trackingNumber: string | null | undefined
): string | null {
  if (!trackingNumber?.trim()) return null

  const num = trackingNumber.trim()
  const c = (carrier || '').toLowerCase()

  // FedEx: https://www.fedex.com/fedextrack/?trknbr=TRACKING_NUMBER
  if (c.includes('fedex')) {
    return `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(num)}`
  }

  // UPS: https://www.ups.com/track?tracknum=TRACKING_NUMBER
  if (c.includes('ups')) {
    return `https://www.ups.com/track?tracknum=${encodeURIComponent(num)}`
  }

  // USPS: https://tools.usps.com/go/TrackConfirmAction?tLabels=TRACKING_NUMBER
  if (c.includes('usps')) {
    return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(num)}`
  }

  // DHL: https://www.dhl.com/en/express/tracking.html?AWB=TRACKING_NUMBER
  if (c.includes('dhl')) {
    return `https://www.dhl.com/en/express/tracking.html?AWB=${encodeURIComponent(num)}`
  }

  // Freight/Other - no standard URL, return null (user can copy number)
  return null
}

/**
 * Get the effective tracking URL - use stored tracking_url if present, else generate from carrier + number.
 */
export function getEffectiveTrackingUrl(
  trackingUrl: string | null | undefined,
  carrier: string | null | undefined,
  trackingNumber: string | null | undefined
): string | null {
  if (trackingUrl?.trim()) return trackingUrl.trim()
  return getTrackingUrl(carrier, trackingNumber)
}

/** Check if carrier supports FedEx Track API (for fetching real-time events) */
export function isFedExCarrier(carrier: string | null | undefined): boolean {
  return (carrier || '').toLowerCase().includes('fedex')
}

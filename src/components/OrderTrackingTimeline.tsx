'use client'

import { useState } from 'react'
import { Check, MapPin } from 'lucide-react'
import type { TrackingEvent } from '@/lib/tracking'

function formatEventDate(date: string, time?: string): string {
  if (!date) return ''
  try {
    const d = new Date(date)
    if (isNaN(d.getTime())) return date
    const dateStr = d.toLocaleDateString(undefined, {
      month: 'numeric',
      day: 'numeric',
      year: '2-digit',
    })
    if (time) {
      return `${dateStr} ${time}`
    }
    return dateStr
  } catch {
    return date
  }
}

/** Map raw events to main highlights: FROM, WE HAVE YOUR PACKAGE, ON THE WAY, OUT FOR DELIVERY, TO */
function deriveHighlights(
  events: TrackingEvent[],
  apiOrigin?: string,
  apiDestination?: string
): Array<{
  key: string
  label: string
  isCurrent: boolean
}> {
  if (!events.length) return []

  const desc = (e: TrackingEvent) => (e.description || '').toLowerCase()
  const eventType = (e: TrackingEvent) => (e.eventType || '').toUpperCase()
  const isPickup = (e: TrackingEvent) =>
    desc(e).includes('picked up') ||
    desc(e).includes('pickup') ||
    desc(e).includes('received') ||
    desc(e).includes('shipment information') ||
    desc(e).includes('order created') ||
    desc(e).includes('ready for shipment') ||
    eventType(e) === 'PU' ||
    eventType(e) === 'OC' ||
    eventType(e) === 'OF'
  const isInTransit = (e: TrackingEvent) =>
    desc(e).includes('transit') ||
    desc(e).includes('departed') ||
    desc(e).includes('arrived') ||
    desc(e).includes('in transit') ||
    desc(e).includes('on the way') ||
    desc(e).includes('at fedex') ||
    desc(e).includes('at airport') ||
    desc(e).includes('left origin') ||
    eventType(e) === 'IT' ||
    eventType(e) === 'DP' ||
    eventType(e) === 'AR' ||
    eventType(e) === 'LO'
  const isOutForDelivery = (e: TrackingEvent) =>
    desc(e).includes('out for delivery') ||
    desc(e).includes('on vehicle') ||
    desc(e).includes('on truck') ||
    eventType(e) === 'OD'
  const isDelivered = (e: TrackingEvent) =>
    desc(e).includes('delivered') || eventType(e) === 'DL'

  // Events are sorted oldest-first by the API
  const oldest = events[0]
  const newest = events[events.length - 1]
  const pickupEvent = events.find(isPickup) || oldest
  const transitEvent = events.find(isInTransit)
  const outForDeliveryEvent = events.find(isOutForDelivery)
  const deliveredEvent = events.find(isDelivered)

  // Origin: prefer API-provided (actual shipper), else pickup/first scan. Avoid transit hubs.
  const origin =
    apiOrigin ||
    pickupEvent?.location ||
    oldest?.location ||
    'Origin'

  // Destination: prefer API-provided (actual recipient). Only use scan locations when delivered
  // or out for delivery - in transit, last event is often a hub (e.g. Greenwood, IN), not destination.
  const destination =
    apiDestination ||
    deliveredEvent?.location ||
    outForDeliveryEvent?.location ||
    'Destination'

  const outLabel = outForDeliveryEvent
    ? `OUT FOR DELIVERY ${[outForDeliveryEvent.location, formatEventDate(outForDeliveryEvent.date, outForDeliveryEvent.time)]
        .filter(Boolean)
        .join(' ')}`.trim()
    : 'OUT FOR DELIVERY'

  const currentStage = deliveredEvent
    ? 'to'
    : outForDeliveryEvent
      ? 'out'
      : transitEvent
        ? 'transit'
        : pickupEvent
          ? 'have'
          : 'from'

  return [
    { key: 'from', label: `FROM ${origin}`, isCurrent: currentStage === 'from' },
    { key: 'have', label: 'WE HAVE YOUR PACKAGE', isCurrent: currentStage === 'have' },
    { key: 'transit', label: 'ON THE WAY', isCurrent: currentStage === 'transit' },
    { key: 'out', label: outLabel, isCurrent: currentStage === 'out' },
    { key: 'to', label: `TO ${destination}`, isCurrent: currentStage === 'to' },
  ]
}

interface OrderTrackingTimelineProps {
  status?: string
  /** Real tracking scan events from carrier API - when provided, shows highlights + details */
  events?: TrackingEvent[]
  /** Actual origin from carrier API (avoids transit hubs like Greenwood, IN) */
  origin?: string
  /** Actual destination from carrier API (avoids transit hubs) */
  destination?: string
  /** Brand color (hex) from manufacturer logo - used for timeline accent instead of purple */
  themeColor?: string
  className?: string
}

export function OrderTrackingTimeline({
  status: _status,
  events,
  origin: apiOrigin,
  destination: apiDestination,
  themeColor,
  className = '',
}: OrderTrackingTimelineProps) {
  const [showDetails, setShowDetails] = useState(false)

  const accentColor = themeColor || '#a855f7' // fallback to purple-500
  const accentStyle = { backgroundColor: accentColor }
  const accentMutedStyle = { backgroundColor: `${accentColor}99` }
  const ringStyle = { boxShadow: `0 0 0 2px ${accentColor}80` }
  const linkStyle = { color: accentColor }

  // When we have real tracking events: show main highlights + Details toggle
  if (events && events.length > 0) {
    const highlights = deriveHighlights(events, apiOrigin, apiDestination)

    return (
      <div className={`w-full py-3 ${className}`}>
        {/* Main highlights - linear vertical timeline */}
        <div className="relative flex">
          {/* Vertical line */}
          <div
            className="absolute left-[9px] top-2 bottom-2 w-0.5"
            style={accentMutedStyle}
          />
          <div className="flex flex-col gap-0">
            {highlights.map((h) => (
              <div key={h.key} className="flex items-start gap-3 py-1">
                {/* Dot */}
                <div className="relative z-10 shrink-0 flex items-center justify-center w-5 h-5 mt-0.5">
                  <div
                    className={`w-3 h-3 rounded-full flex items-center justify-center ${
                      h.isCurrent ? '' : 'bg-white/70'
                    }`}
                    style={h.isCurrent ? { ...accentStyle, ...ringStyle } : undefined}
                  >
                    {h.isCurrent && (
                      <span className="text-white text-[8px] font-bold leading-none">›</span>
                    )}
                  </div>
                </div>
                {/* Label */}
                <div
                  className={`flex-1 py-1.5 px-3 rounded-lg min-w-0 ${
                    h.isCurrent ? 'bg-white/10' : ''
                  }`}
                >
                  <p
                    className={`text-sm ${
                      h.isCurrent ? 'font-semibold text-white' : 'text-white/70'
                    }`}
                  >
                    {h.label}
                  </p>
                  {h.isCurrent && (
                    <button
                      type="button"
                      onClick={() => setShowDetails((d) => !d)}
                      className="mt-1 text-xs font-medium opacity-90 hover:opacity-100 transition-opacity"
                      style={linkStyle}
                    >
                      {showDetails ? 'Hide details' : 'Details'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Expanded: full event list */}
        {showDetails && (
          <div className="mt-4 ml-8 pl-4 border-l-2 border-white/20 space-y-2">
            {events.map((event, i) => (
              <div key={i} className="py-2">
                <p className="text-sm font-medium text-white/90">{event.description}</p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-xs text-white/50">
                  <span>{formatEventDate(event.date, event.time)}</span>
                  {event.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {event.location}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // No FedEx events - don't show the old horizontal status timeline
  return null
}

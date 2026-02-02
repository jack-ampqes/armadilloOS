'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { useZoomPanContext } from 'react-simple-maps'
import { Plus, MapPin, Building, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
const ComposableMap = dynamic(
  () => import('react-simple-maps').then((m) => m.ComposableMap),
  { ssr: false }
)
const Geographies = dynamic(
  () => import('react-simple-maps').then((m) => m.Geographies),
  { ssr: false }
)
const Geography = dynamic(
  () => import('react-simple-maps').then((m) => m.Geography),
  { ssr: false }
)
const ZoomableGroup = dynamic(
  () => import('react-simple-maps').then((m) => m.ZoomableGroup),
  { ssr: false }
)
const Marker = dynamic(
  () => import('react-simple-maps').then((m) => m.Marker),
  { ssr: false }
)

const GEO_URL = 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json'

const STATE_NAMES: Record<string, string> = {
  '01': 'Alabama', '02': 'Alaska', '04': 'Arizona', '05': 'Arkansas',
  '06': 'California', '08': 'Colorado', '09': 'Connecticut',
  '10': 'Delaware', '11': 'DC', '12': 'Florida', '13': 'Georgia',
  '15': 'Hawaii', '16': 'Idaho', '17': 'Illinois', '18': 'Indiana',
  '19': 'Iowa', '20': 'Kansas', '21': 'Kentucky', '22': 'Louisiana',
  '23': 'Maine', '24': 'Maryland', '25': 'Massachusetts', '26': 'Michigan',
  '27': 'Minnesota', '28': 'Mississippi', '29': 'Missouri', '30': 'Montana',
  '31': 'Nebraska', '32': 'Nevada', '33': 'New Hampshire', '34': 'New Jersey',
  '35': 'New Mexico', '36': 'New York', '37': 'North Carolina', '38': 'North Dakota',
  '39': 'Ohio', '40': 'Oklahoma', '41': 'Oregon', '42': 'Pennsylvania',
  '44': 'Rhode Island', '45': 'South Carolina', '46': 'South Dakota',
  '47': 'Tennessee', '48': 'Texas', '49': 'Utah', '50': 'Vermont',
  '51': 'Virginia', '53': 'Washington', '54': 'West Virginia',
  '55': 'Wisconsin', '56': 'Wyoming',
}

const DIST_COLORS = [
  '#003049',
  '#d62828',
  '#f77f00',
  '#fcbf49',
  '#eae2b7',
  '#2a9d8f',
  '#588157',
  '#dda15e',
  '#f26a8d',
  '#118ab2',
]

interface MapLocation {
  id: string
  longitude: number
  latitude: number
  label?: string
  color?: string
}

interface DistributorMap {
  id: string
  name: string
  contactName?: string
  email: string
  phone?: string
  address?: string | null
  color?: string | null
  locations: MapLocation[]
}

function getDistColor(dist: DistributorMap, index: number): string {
  if (dist.color && /^#[0-9A-Fa-f]{6}$/.test(dist.color)) return dist.color
  return DIST_COLORS[index % DIST_COLORS.length]
}

/** Renders map content. Pins come only from distributor address (geocoded to lat/long). */
function MapContent({
  distributors,
  hoverStateId,
  setHoverStateId,
  hoverMarker,
  setHoverMarker
}: {
  distributors: DistributorMap[]
  hoverStateId: string | null
  setHoverStateId: (id: string | null) => void
  hoverMarker: { dist: DistributorMap; loc: MapLocation } | null
  setHoverMarker: (m: { dist: DistributorMap; loc: MapLocation } | null) => void
}) {
  const { k } = useZoomPanContext()
  const pinScale = 1.2 / k
  return (
    <>
      <Geographies geography={GEO_URL}>
        {({ geographies }) =>
          geographies.map((geo) => {
            const stateId = String(geo.id).padStart(2, '0')
            const isHover = hoverStateId === stateId
            return (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                fill={isHover ? '#454545' : '#333333'}
                stroke="#181818"
                strokeWidth={0.8}
                style={{
                  default: { outline: 'none' },
                  hover: { outline: 'none', cursor: 'default' },
                  pressed: { outline: 'none' }
                }}
                onMouseEnter={() => setHoverStateId(stateId)}
                onMouseLeave={() => setHoverStateId(null)}
              />
            )
          })
        }
      </Geographies>
      {distributors.map((dist, distIndex) => {
        const color = getDistColor(dist, distIndex)
        return (dist.locations ?? []).map((loc) => {
          const lng = loc.longitude
          const lat = loc.latitude
          if (typeof lng !== 'number' || typeof lat !== 'number' || isNaN(lng) || isNaN(lat)) return null
          const isHover = hoverMarker?.loc.id === loc.id
          return (
            <Marker
              key={`${dist.id}-${loc.id}`}
              coordinates={[lng, lat]}
              onMouseEnter={() => setHoverMarker({ dist, loc })}
              onMouseLeave={() => setHoverMarker(null)}
            >
              <g
                transform={`scale(${pinScale}) translate(-12, -20)`}
                className="cursor-pointer"
                style={{ opacity: isHover ? 1 : 0.7 }}
              >
                {/* Pin path: tip at (12,20). SVG applies right-to-left: translate first (tip→origin), then scale around origin */}
                <path
                  d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
                  fill={color}
                  stroke="#fff"
                  strokeWidth={1}
                  strokeLinejoin="round"
                />
              </g>
            </Marker>
          )
        }).filter(Boolean)
      })}
    </>
  )
}

export default function DistributorsPage() {
  const searchParams = useSearchParams()
  const [distributors, setDistributors] = useState<DistributorMap[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [colorPickerDistId, setColorPickerDistId] = useState<string | null>(null)
  const [pendingColor, setPendingColor] = useState<string>(DIST_COLORS[0])
  const [hoverStateId, setHoverStateId] = useState<string | null>(null)
  const [hoverMarker, setHoverMarker] = useState<{ dist: DistributorMap; loc: MapLocation } | null>(null)
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null)

  const forceGeocode = searchParams.get('force_geocode') === '1'
  useEffect(() => {
    fetchDistributors(forceGeocode)
  }, [forceGeocode])

  const fetchDistributors = async (forceGeocode = false) => {
    if (forceGeocode) setRefreshing(true)
    try {
      const url = forceGeocode ? '/api/distributors/map?force_geocode=1' : '/api/distributors/map'
      const res = await fetch(url, { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        setDistributors(data)
      }
    } catch (e) {
      console.error('Error fetching distributors:', e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const updateDistColor = async (distId: string, hexColor: string) => {
    try {
      const res = await fetch(`/api/distributors/${distId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ color: hexColor })
      })
      if (res.ok) {
        const updated = await res.json()
        setDistributors((prev) =>
          prev.map((d) => (d.id === distId ? { ...d, color: updated.color } : d))
        )
      }
    } catch (e) {
      console.error('Error updating color:', e)
    } finally {
      setColorPickerDistId(null)
    }
  }

  const openColorPicker = (dist: DistributorMap, index: number, e: React.MouseEvent) => {
    e.stopPropagation()
    setColorPickerDistId(dist.id)
    setPendingColor(getDistColor(dist, index))
  }

  const confirmColor = () => {
    if (colorPickerDistId) {
      updateDistColor(colorPickerDistId, pendingColor)
    }
  }

  const tooltipContent = hoverMarker
    ? `${hoverMarker.dist.name}${hoverMarker.loc.label ? ` – ${hoverMarker.loc.label}` : ''}`
    : hoverStateId
      ? STATE_NAMES[hoverStateId] ?? hoverStateId
      : null

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] min-h-[400px] w-full max-w-[100vw] overflow-hidden -m-8">
        <div className="flex-shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-6 py-6 border-1 border-white/10">
        <div>
          <h1 className="text-3xl font-bold text-white">Distributors</h1>
          <p className="mt-2 text-white/60 text-sm">
            Pins are placed from each distributor&apos;s address. Edit a distributor to update their location.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => { window.location.href = '/distributors?force_geocode=1' }}
            disabled={refreshing || loading}
            title="Refresh map (re-geocode addresses)"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
          <Button variant="outline" asChild>
            <Link href="/distributors/list" title="View list">
              List
            </Link>
          </Button>
          <Button asChild className="self-start sm:self-auto">
            <Link href="/distributors/new" title="Add Distributor">
              <Plus className="h-5 w-5" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-4 p-4">
        <Card className="lg:col-span-1 self-start w-full max-h-[calc(100vh-14rem)] flex flex-col overflow-hidden">
          <CardContent className="p-4 flex flex-col min-h-0 overflow-hidden">
            <h2 className="text-sm font-medium text-white/80 mb-3 flex items-center gap-2">
              <Building className="h-5 w-5" />
              Distributors
            </h2>
            <p className="text-xs text-white/60 mb-2">
              Pins from address. Click the circle to change marker color.
            </p>
            {colorPickerDistId && (
              <div className="mb-3 p-3 rounded-lg bg-white/10 border border-white/20">
                <p className="text-xs text-white/80 mb-2">
                  Choose color for {distributors.find((d) => d.id === colorPickerDistId)?.name}
                </p>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {DIST_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setPendingColor(c)}
                      className={`w-6 h-6 rounded-full border transition-all focus:outline-none focus:ring-2 focus:ring-white/50 ${
                        pendingColor === c ? 'border-white scale-110' : 'border-white/30 hover:border-white/50'
                      }`}
                      style={{ backgroundColor: c }}
                      aria-label={`Select ${c}`}
                    />
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={confirmColor}>
                    OK
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setColorPickerDistId(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
            <ul className="space-y-2 overflow-y-auto min-h-0">
              {distributors.map((dist, i) => {
                const color = getDistColor(dist, i)
                return (
                  <li key={dist.id}>
                    <div className="w-full text-left flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-white/10 transition-colors">
                      <button
                        type="button"
                        onClick={(e) => openColorPicker(dist, i, e)}
                        className="shrink-0 w-5 h-5 rounded-full border border-white/30 hover:border-white/60 hover:scale-110 transition-all focus:outline-none focus:ring-2 focus:ring-white/50"
                        style={{ backgroundColor: color }}
                        title="Change marker color"
                        aria-label={`Change color for ${dist.name}`}
                      />
                      <Link
                        href={`/distributors/${dist.id}/edit`}
                        className="flex-1 truncate text-white font-medium hover:underline"
                      >
                        {dist.name}
                      </Link>
                      {dist.locations.length > 0 ? (
                        <span className="text-xs text-white/50">on map</span>
                      ) : dist.address?.trim() ? (
                        <span className="text-xs text-amber-400/80" title="Geocoding failed or pending">
                          address not found
                        </span>
                      ) : (
                        <Link
                          href={`/distributors/${dist.id}/edit`}
                          className="text-xs text-white/40 hover:text-white/70"
                          title="Add address"
                        >
                          no address
                        </Link>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
            {distributors.length === 0 && (
              <p className="text-sm text-white/60 py-4">
                No distributors yet. Add one to start placing pinpoints.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 flex flex-col min-h-[400px] overflow-hidden border border-white/10">
          <CardContent className="p-0 flex-1 min-h-[400px] relative">
            <div
              className={`absolute inset-0 w-full h-full min-h-[400px] transition-all duration-300 ${
                loading || refreshing ? 'blur-sm' : ''
              }`}
              onMouseMove={(e) => setTooltipPos({ x: e.clientX, y: e.clientY })}
              onMouseLeave={() => setTooltipPos(null)}
            >
              <ComposableMap
                projection="geoAlbersUsa"
                projectionConfig={{ scale: 800 }}
                className="w-full h-full"
              >
                <ZoomableGroup center={[-96, 38]} zoom={1}>
                  <MapContent
                    distributors={distributors}
                    hoverStateId={hoverStateId}
                    setHoverStateId={setHoverStateId}
                    hoverMarker={hoverMarker}
                    setHoverMarker={setHoverMarker}
                  />
                </ZoomableGroup>
              </ComposableMap>
            </div>
            {(loading || refreshing) && (
              <div className="absolute inset-0 flex items-center justify-center bg-neutral-900/60 z-10">
                <div className="flex flex-col items-center gap-3">
                  <div className="loader" />
                  <p className="text-sm text-white/80">
                    {refreshing ? 'Pinning the map...' : 'Hold up...'}
                  </p>
                </div>
              </div>
            )}
            {tooltipContent && tooltipPos && !loading && !refreshing && (
                <div
                  className="fixed pointer-events-none z-50 px-2 py-1.5 rounded bg-neutral-800/95 text-neutral-200 text-xs font-medium border border-neutral-600/80 shadow-lg flex items-center gap-2"
                  style={{
                    left: tooltipPos.x + 12,
                    top: tooltipPos.y + 12
                  }}
                >
                  <MapPin className="h-3.5 w-3.5 text-neutral-400" />
                  {tooltipContent}
                </div>
              )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

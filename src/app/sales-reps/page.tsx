'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { Plus, MapPin, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

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

// Map uses 2-digit FIPS. Support both FIPS (01, 06) and state abbreviations (AL, CA).
const STATE_ABBR_TO_FIPS: Record<string, string> = {
  AL: '01', AK: '02', AZ: '04', AR: '05', CA: '06', CO: '08', CT: '09',
  DE: '10', DC: '11', FL: '12', GA: '13', HI: '15', ID: '16', IL: '17',
  IN: '18', IA: '19', KS: '20', KY: '21', LA: '22', ME: '23', MD: '24',
  MA: '25', MI: '26', MN: '27', MS: '28', MO: '29', MT: '30', NE: '31',
  NV: '32', NH: '33', NJ: '34', NM: '35', NY: '36', NC: '37', ND: '38',
  OH: '39', OK: '40', OR: '41', PA: '42', RI: '44', SC: '45', SD: '46',
  TN: '47', TX: '48', UT: '49', VT: '50', VA: '51', WA: '53', WV: '54',
  WI: '55', WY: '56',
}

interface SalesRep {
  id: string
  name: string
  email: string
  phone?: string
  territory?: string
  commissionRate?: number
  color?: string | null
  orders: Array<{ id: string; orderNumber: string; totalAmount: number; status: string; createdAt: string }>
}

const REP_COLORS = [
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

// Map expects 2-digit FIPS (01, 06, 36). Accept FIPS (1, 6, 01, 06) or abbreviations (CA, NY).
function toFips(segment: string): string {
  const s = String(segment).trim()
  if (!s) return ''
  const upper = s.toUpperCase()
  if (STATE_ABBR_TO_FIPS[upper]) return STATE_ABBR_TO_FIPS[upper]
  if (/^\d{1,2}$/.test(s)) return s.padStart(2, '0')
  return s.padStart(2, '0')
}

function parseTerritory(territory: string | undefined): string[] {
  if (!territory?.trim()) return []
  return territory
    .split(',')
    .map((s) => toFips(s))
    .filter(Boolean)
}

function serializeTerritory(stateIds: string[]): string {
  return stateIds.join(',')
}

function getRepColor(rep: SalesRep, index: number): string {
  if (rep.color && /^#[0-9A-Fa-f]{6}$/.test(rep.color)) return rep.color
  return REP_COLORS[index % REP_COLORS.length]
}

export default function SalesRepsPage() {
  const [salesReps, setSalesReps] = useState<SalesRep[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRepId, setSelectedRepId] = useState<string | null>(null)
  const [hoverStateId, setHoverStateId] = useState<string | null>(null)
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [colorPickerRepId, setColorPickerRepId] = useState<string | null>(null)
  const [pendingColor, setPendingColor] = useState<string>(REP_COLORS[0])

  useEffect(() => {
    fetchSalesReps()
  }, [])

  const fetchSalesReps = async () => {
    try {
      const res = await fetch('/api/sales-reps')
      if (res.ok) {
        const data = await res.json()
        setSalesReps(data)
      }
    } catch (e) {
      console.error('Error fetching sales reps:', e)
    } finally {
      setLoading(false)
    }
  }

  const stateToRepId = useMemo(() => {
    const map: Record<string, string> = {}
    salesReps.forEach((rep) => {
      parseTerritory(rep.territory).forEach((stateId) => {
        map[stateId] = rep.id
      })
    })
    return map
  }, [salesReps])

  const updateRepTerritory = async (repId: string, newStateIds: string[]) => {
    setSavingId(repId)
    try {
      const res = await fetch(`/api/sales-reps/${repId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ territory: serializeTerritory(newStateIds) })
      })
      if (res.ok) {
        const updated = await res.json()
        setSalesReps((prev) =>
          prev.map((r) => (r.id === repId ? { ...r, territory: updated.territory } : r))
        )
      }
    } catch (e) {
      console.error('Error updating territory:', e)
    } finally {
      setSavingId(null)
    }
  }

  const handleStateClick = (stateId: string) => {
    if (!selectedRepId) return
    const rep = salesReps.find((r) => r.id === selectedRepId)
    if (!rep) return
    const stateIds = parseTerritory(rep.territory)
    const has = stateIds.includes(stateId)
    const next = has ? stateIds.filter((id) => id !== stateId) : [...stateIds, stateId]
    updateRepTerritory(selectedRepId, next)
  }

  const updateRepColor = async (repId: string, hexColor: string) => {
    try {
      const res = await fetch(`/api/sales-reps/${repId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ color: hexColor })
      })
      if (res.ok) {
        const updated = await res.json()
        setSalesReps((prev) =>
          prev.map((r) => (r.id === repId ? { ...r, color: updated.color } : r))
        )
      }
    } catch (e) {
      console.error('Error updating color:', e)
    } finally {
      setColorPickerRepId(null)
    }
  }

  const openColorPicker = (rep: SalesRep, index: number, e: React.MouseEvent) => {
    e.stopPropagation()
    setColorPickerRepId(rep.id)
    setPendingColor(getRepColor(rep, index))
  }

  const confirmColor = () => {
    if (colorPickerRepId) {
      updateRepColor(colorPickerRepId, pendingColor)
    }
  }

  if (loading) {
    return (
      <div className="px-4 py-6 sm:px-0">
        <div className="flex justify-center">
          <Skeleton className="h-[400px] w-full max-w-2xl rounded-lg" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] min-h-[400px] w-full max-w-[100vw] overflow-hidden -m-8">
      <div className="flex-shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-6 py-6 border-1 border-white/10">
        <div>
          <h1 className="text-3xl font-bold text-white">Sales Reps & Regions</h1>
          <p className="mt-2 text-white/60 text-sm">
            Assign states to reps and set region colors on the map.
          </p>
        </div>
        <Button asChild className="self-start sm:self-auto">
          <Link href="/sales-reps/new" title="Add Sales Rep">
            <Plus className="h-5 w-5" aria-hidden="true" />
          </Link>
        </Button>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-4 p-4">
        <Card className="lg:col-span-1 self-start w-full max-h-[calc(100vh-14rem)] flex flex-col overflow-hidden">
          <CardContent className="p-4 flex flex-col min-h-0 overflow-hidden">
            <h2 className="text-sm font-medium text-white/80 mb-3 flex items-center gap-2">
              <User className="h-5 w-5" />
              Sales reps
            </h2>
            <p className="text-xs text-white/60 mb-2">
              Select a rep to view their territory. Click the circle to change color.
            </p>
            {colorPickerRepId && (
              <div className="mb-3 p-3 rounded-lg bg-white/10 border border-white/20">
                <p className="text-xs text-white/80 mb-2">
                  Choose color for {salesReps.find((r) => r.id === colorPickerRepId)?.name}
                </p>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {REP_COLORS.map((c) => (
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
                  <Button size="sm" variant="ghost" onClick={() => setColorPickerRepId(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
            <ul className="space-y-2 overflow-y-auto min-h-0">
              {salesReps.map((rep, i) => {
                const stateIds = parseTerritory(rep.territory)
                const color = getRepColor(rep, i)
                const isSelected = selectedRepId === rep.id
                const isSaving = savingId === rep.id
                return (
                  <li key={rep.id}>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedRepId(isSelected ? null : rep.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setSelectedRepId(isSelected ? null : rep.id)
                        }
                      }}
                      className={`w-full text-left flex items-center gap-2 rounded-lg px-3 py-2 transition-colors cursor-pointer ${
                        isSelected ? 'bg-white/15 ring-1 ring-white/30' : 'hover:bg-white/10'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={(e) => openColorPicker(rep, i, e)}
                        className="shrink-0 w-5 h-5 rounded-full border border-white/30 hover:border-white/60 hover:scale-110 transition-all focus:outline-none focus:ring-2 focus:ring-white/50"
                        style={{ backgroundColor: color }}
                        title="Change region color"
                        aria-label={`Change color for ${rep.name}`}
                      />
                      <span className="flex-1 truncate text-white font-medium">{rep.name}</span>
                      {isSaving && (
                        <span className="text-xs text-white/50">Saving…</span>
                      )}
                      {stateIds.length > 0 && (
                        <span className="text-xs text-white/50">{stateIds.length} states</span>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
            {salesReps.length === 0 && (
              <p className="text-sm text-white/60 py-4">
                No sales reps yet. Add one to start assigning regions.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 flex flex-col min-h-0 overflow-hidden border-0 shadow-none">
          <CardContent className="p-0 flex-1 min-h-0 relative">
            <div
              className="absolute inset-0 w-full h-full"
              onMouseMove={(e) => setTooltipPos({ x: e.clientX, y: e.clientY })}
              onMouseLeave={() => setTooltipPos(null)}
            >
              <ComposableMap
                projection="geoAlbersUsa"
                projectionConfig={{ scale: 800 }}
                className="w-full h-full"
              >
                <ZoomableGroup center={[-96, 38]} zoom={1}>
                  <Geographies geography={GEO_URL}>
                    {({ geographies }) =>
                      geographies.map((geo) => {
                        const stateId = String(geo.id).padStart(2, '0')
                        const repId = stateToRepId[stateId]
                        const rep = repId ? salesReps.find((r) => r.id === repId) : null
                        const repIndex = rep ? salesReps.findIndex((r) => r.id === rep.id) : 0
                        const color = rep ? getRepColor(rep, repIndex) : '#333333'
                        const isAssigned = !!rep
                        const isHover = hoverStateId === stateId
                        const canToggle = selectedRepId !== null
                        return (
                          <Geography
                            key={geo.rsmKey}
                            geography={geo}
                            fill={isHover ? (rep ? color : '#454545') : color}
                            stroke={isAssigned ? '#454545' : '#181818'}
                            strokeWidth={0.8}
                            style={{
                              default: { outline: 'none' },
                              hover: { outline: 'none', cursor: canToggle ? 'pointer' : 'default' },
                              pressed: { outline: 'none' }
                            }}
                            onMouseEnter={() => setHoverStateId(stateId)}
                            onMouseLeave={() => setHoverStateId(null)}
                            onClick={() => handleStateClick(stateId)}
                          />
                        )
                      })
                    }
                  </Geographies>
                </ZoomableGroup>
              </ComposableMap>
              {hoverStateId && tooltipPos && (
                <div
                  className="fixed pointer-events-none z-50 px-2 py-1.5 rounded bg-neutral-800/95 text-neutral-200 text-xs font-medium border border-neutral-600/80 shadow-lg flex items-center gap-2"
                  style={{
                    left: tooltipPos.x + 12,
                    top: tooltipPos.y + 12
                  }}
                >
                  <MapPin className="h-3.5 w-3.5 text-neutral-400" />
                  {STATE_NAMES[hoverStateId] ?? hoverStateId}
                  {stateToRepId[hoverStateId] && (
                    <span className="text-neutral-400">
                      → {salesReps.find((r) => r.id === stateToRepId[hoverStateId])?.name}
                    </span>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

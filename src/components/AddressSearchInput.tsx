'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MapPin, Loader2 } from 'lucide-react'

interface SearchResult {
  displayName: string
  latitude: number
  longitude: number
}

interface AddressSearchInputProps {
  id: string
  label: string
  value: string
  onChange: (address: string, latitude?: number, longitude?: number) => void
  placeholder?: string
  disabled?: boolean
  /** Show selected lat/long when set */
  selectedLat?: number | null
  selectedLng?: number | null
}

export function AddressSearchInput({
  id,
  label,
  value,
  onChange,
  placeholder = 'Search address...',
  disabled = false,
  selectedLat,
  selectedLng
}: AddressSearchInputProps) {
  const [query, setQuery] = useState(value)
  const [suggestions, setSuggestions] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setQuery(value)
  }, [value])

  const fetchSuggestions = useCallback(async (q: string) => {
    if (!q || q.length < 3) {
      setSuggestions([])
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/geocode/search?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      setSuggestions(Array.isArray(data) ? data : [])
      setSelectedIndex(-1)
    } catch {
      setSuggestions([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim()) {
      setSuggestions([])
      return
    }
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(query)
    }, 400)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, fetchSuggestions])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = useCallback((result: SearchResult) => {
    setQuery(result.displayName)
    onChange(result.displayName, result.latitude, result.longitude)
    setSuggestions([])
    setOpen(false)
  }, [onChange])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || suggestions.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((i) => (i < suggestions.length - 1 ? i + 1 : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((i) => (i > 0 ? i - 1 : suggestions.length - 1))
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault()
      handleSelect(suggestions[selectedIndex])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative mt-1">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40 pointer-events-none" />
        <Input
          id={id}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
            onChange(e.target.value)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="pl-9 pr-9"
          autoComplete="off"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40 animate-spin pointer-events-none" />
        )}
      </div>
      {open && suggestions.length > 0 && (
        <ul
          className="absolute z-50 mt-1 w-full max-h-48 overflow-auto rounded-md border border-white/20 bg-neutral-900 py-1 shadow-lg"
          role="listbox"
        >
          {suggestions.map((result, i) => (
            <li key={`${result.displayName}-${result.latitude}-${result.longitude}-${i}`} role="option">
              <button
                type="button"
                tabIndex={-1}
                aria-selected={i === selectedIndex}
                className={`w-full text-left px-3 py-2 text-sm text-white/90 hover:bg-white/10 cursor-pointer border-0 bg-transparent ${
                  i === selectedIndex ? 'bg-white/10' : ''
                }`}
                onMouseEnter={() => setSelectedIndex(i)}
                onPointerDown={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  handleSelect(result)
                }}
              >
                <span className="block truncate">{result.displayName}</span>
                <span className="block text-xs text-white/50 mt-0.5">
                  {result.latitude.toFixed(4)}°, {result.longitude.toFixed(4)}°
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {query && suggestions.length === 0 && !loading && query.length >= 3 && (
        <p className="mt-1 text-xs text-white/50">No results. Try a different search or enter manually.</p>
      )}
      {selectedLat != null && selectedLng != null && (
        <p className="mt-1.5 text-xs text-emerald-400/90">
          Lat: {Number(selectedLat).toFixed(6)}, Long: {Number(selectedLng).toFixed(6)}
        </p>
      )}
    </div>
  )
}

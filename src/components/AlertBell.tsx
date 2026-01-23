'use client'

import { useState, useEffect, useRef } from 'react'
import { Bell, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Alert {
  id: string
  type: string
  severity: string
  title: string
  message: string
  entityType: string | null
  entityId: string | null
  read: boolean
  resolved: boolean
  createdAt: string
}

export function AlertBell() {
  const router = useRouter()
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchAlerts()
    // Refresh alerts every 30 seconds
    const interval = setInterval(fetchAlerts, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showDropdown])

  const fetchAlerts = async () => {
    try {
      const response = await fetch('/api/alerts?resolved=false&limit=5')
      if (response.ok) {
        const data = await response.json()
        setAlerts(data)
        setUnreadCount(data.filter((a: Alert) => !a.read).length)
      }
    } catch (error) {
      console.error('Error fetching alerts:', error)
    }
  }

  const markAsRead = async (id: string) => {
    try {
      await fetch(`/api/alerts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ read: true }),
      })
      fetchAlerts()
    } catch (error) {
      console.error('Error marking alert as read:', error)
    }
  }

  const handleAlertClick = (alert: Alert) => {
    markAsRead(alert.id)
    setShowDropdown(false)
    
    if (alert.entityType && alert.entityId) {
      switch (alert.entityType) {
        case 'product':
          router.push(`/inventory/${alert.entityId}`)
          break
        case 'quote':
          router.push(`/quotes/${alert.entityId}`)
          break
        case 'order':
          router.push(`/orders/${alert.entityId}`)
          break
      }
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'text-red-400'
      case 'warning':
        return 'text-yellow-400'
      default:
        return 'text-blue-400'
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setShowDropdown(!showDropdown)}
        className="relative"
      >
        <Bell className="h-5 w-5 text-white" />
        {unreadCount > 0 && (
          <Badge 
            variant="destructive" 
            className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </Badge>
        )}
      </Button>

      {showDropdown && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-[#181818] border border-white/20 rounded-lg shadow-xl z-50 max-h-96 overflow-hidden">
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <h3 className="text-white font-semibold">Alerts</h3>
            <Link
              href="/alerts"
              onClick={() => setShowDropdown(false)}
              className="text-sm text-blue-400 hover:text-blue-300"
            >
              View All
            </Link>
          </div>
          <div className="overflow-y-auto max-h-80">
            {alerts.length === 0 ? (
              <div className="p-6 text-center text-white/60">
                <p>No active alerts</p>
              </div>
            ) : (
              <div className="divide-y divide-white/10">
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    onClick={() => handleAlertClick(alert)}
                    className={`p-4 hover:bg-white/5 cursor-pointer transition-colors ${
                      !alert.read ? 'bg-yellow-400/10' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <AlertTriangle className={`h-4 w-4 mt-1 flex-shrink-0 ${getSeverityColor(alert.severity)}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-white font-medium text-sm truncate">{alert.title}</p>
                          {!alert.read && (
                            <Badge variant="outline" className="bg-yellow-400/20 text-yellow-400 border-yellow-400/50 text-xs px-1.5 py-0">
                              New
                            </Badge>
                          )}
                        </div>
                        <p className="text-white/70 text-xs line-clamp-2">{alert.message}</p>
                        <p className="text-white/40 text-xs mt-1">
                          {new Date(alert.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

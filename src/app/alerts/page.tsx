'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertTriangle, PackageX, Clock, FileText, CheckCircle, X, RefreshCw } from 'lucide-react'
import { useRouter } from 'next/navigation'

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
  resolvedAt: string | null
}

export default function AlertsPage() {
  const router = useRouter()
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'unread' | 'resolved'>('all')
  const [severityFilter, setSeverityFilter] = useState<string>('all')
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    fetchAlerts()
  }, [filter, severityFilter])

  const fetchAlerts = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filter === 'unread') {
        params.append('resolved', 'false')
      } else if (filter === 'resolved') {
        params.append('resolved', 'true')
      }
      if (severityFilter !== 'all') {
        params.append('severity', severityFilter)
      }

      const response = await fetch(`/api/alerts?${params.toString()}`)
      if (response.ok) {
        const data = await response.json()
        setAlerts(data)
      }
    } catch (error) {
      console.error('Error fetching alerts:', error)
    } finally {
      setLoading(false)
    }
  }

  const runChecks = async () => {
    setRefreshing(true)
    try {
      await fetch('/api/alerts', { method: 'POST' })
      await fetchAlerts()
    } catch (error) {
      console.error('Error running alert checks:', error)
    } finally {
      setRefreshing(false)
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

  const resolveAlert = async (id: string) => {
    try {
      await fetch(`/api/alerts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolved: true }),
      })
      fetchAlerts()
    } catch (error) {
      console.error('Error resolving alert:', error)
    }
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="h-5 w-5 text-red-400" />
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-400" />
      default:
        return <AlertTriangle className="h-5 w-5 text-blue-400" />
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'out_of_stock':
      case 'low_stock':
        return <PackageX className="h-4 w-4" />
      case 'quote_expired':
        return <FileText className="h-4 w-4" />
      case 'pending_order':
        return <Clock className="h-4 w-4" />
      default:
        return <AlertTriangle className="h-4 w-4" />
    }
  }

  const getSeverityVariant = (severity: string): "default" | "secondary" | "destructive" | "outline" | "success" | "warning" => {
    switch (severity) {
      case 'critical':
        return 'destructive'
      case 'warning':
        return 'warning'
      default:
        return 'default'
    }
  }

  const handleEntityClick = (alert: Alert) => {
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

  const filteredAlerts = alerts.filter(alert => {
    if (filter === 'unread' && alert.read) return false
    if (filter === 'resolved' && !alert.resolved) return false
    if (filter === 'all' && alert.resolved) return false // By default, don't show resolved
    return true
  })

  const unreadCount = alerts.filter(a => !a.read && !a.resolved).length

  return (
    <div className="space-y-8 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Alerts</h1>
          <p className="text-white/60 mt-1">
            {unreadCount > 0 ? `${unreadCount} unread alert${unreadCount !== 1 ? 's' : ''}` : 'No unread alerts'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={runChecks}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Run Checks
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Active</SelectItem>
            <SelectItem value="unread">Unread Only</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
          </SelectContent>
        </Select>
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severities</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
            <SelectItem value="info">Info</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Alerts List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : filteredAlerts.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-4" />
            <p className="text-white text-lg font-medium">No alerts found</p>
            <p className="text-white/60 mt-2">
              {filter === 'resolved' 
                ? 'No resolved alerts' 
                : 'All clear! No active alerts at this time.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredAlerts.map((alert) => (
            <Card 
              key={alert.id}
              className={`cursor-pointer hover:bg-white/5 transition-colors ${
                !alert.read ? 'border-l-4 border-l-yellow-400' : ''
              }`}
              onClick={() => handleEntityClick(alert)}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="mt-1">
                      {getSeverityIcon(alert.severity)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-white">{alert.title}</h3>
                        <Badge variant={getSeverityVariant(alert.severity)}>
                          {alert.severity}
                        </Badge>
                        {getTypeIcon(alert.type)}
                        {!alert.read && (
                          <Badge variant="outline" className="bg-yellow-400/20 text-yellow-400 border-yellow-400/50">
                            New
                          </Badge>
                        )}
                        {alert.resolved && (
                          <Badge variant="success">Resolved</Badge>
                        )}
                      </div>
                      <p className="text-white/80 mb-2">{alert.message}</p>
                      <p className="text-white/40 text-sm">
                        {new Date(alert.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    {!alert.read && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => markAsRead(alert.id)}
                      >
                        Mark Read
                      </Button>
                    )}
                    {!alert.resolved && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => resolveAlert(alert.id)}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Resolve
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

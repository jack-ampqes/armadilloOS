'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

interface QuoteItem {
  id: string
  productName: string
  sku: string | null
  quantity: number
  unitPrice: number
  totalPrice: number
}

interface Quote {
  id: string
  quoteNumber: string
  status: string
  customerName: string
  customerEmail: string | null
  customerAddress: string | null
  customerCity: string | null
  customerState: string | null
  subtotal: number
  discountType: string | null
  discountValue: number | null
  discountAmount: number
  total: number
  validUntil: string | null
  createdAt: string
  notes: string | null
  quoteItems: QuoteItem[]
  quickbooksEstimateId?: string | null
}

export default function QuotesPage() {
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)

  useEffect(() => {
    loadQuotes()
  }, [])

  // Auto-dismiss sync toast after 4 seconds
  useEffect(() => {
    if (!syncMessage) return
    const t = setTimeout(() => setSyncMessage(null), 4000)
    return () => clearTimeout(t)
  }, [syncMessage])

  const fetchQuotes = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/quotes')
      
      if (response.ok) {
        const data = await response.json()
        setQuotes(Array.isArray(data) ? data : [])
      } else {
        const errorData = await response.json().catch(() => ({}))
        setError(errorData.error || 'Failed to load quotes')
        setQuotes([])
      }
    } catch (error) {
      console.error('Error fetching quotes:', error)
      setError('Failed to connect to server')
      setQuotes([])
    } finally {
      setLoading(false)
    }
  }

  /** Sync from QuickBooks then fetch quotes. Used on page load and when user clicks Sync. */
  const loadQuotes = async () => {
    setLoading(true)
    setError(null)
    setSyncMessage(null)
    try {
      const res = await fetch('/api/quotes/sync-from-quickbooks', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.ok && (data.created > 0 || data.updated > 0)) {
        setSyncMessage(`Synced: ${data.created ?? 0} created, ${data.updated ?? 0} updated.`)
      }
    } catch {
      // QB may not be connected; continue to show local quotes
    }
    await fetchQuotes()
  }

  /** Parse estimate number into (main, suffix) for sorting; bigger numbers first. */
  const parseQuoteNumber = (s: string): { main: number; suffix: number } | null => {
    const m = s.match(/^(\d+)(?:-(\d+))?/)
    if (!m) return null
    return { main: parseInt(m[1], 10), suffix: m[2] ? parseInt(m[2], 10) : 0 }
  }

  const filteredQuotes = quotes
    .filter(quote =>
      quote.quoteNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      quote.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      quote.status.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (quote.customerEmail?.toLowerCase().includes(searchTerm.toLowerCase()))
    )
    .sort((a, b) => {
      const pa = parseQuoteNumber(a.quoteNumber)
      const pb = parseQuoteNumber(b.quoteNumber)
      if (pa && pb) {
        if (pa.main !== pb.main) return pb.main - pa.main
        if (pa.suffix !== pb.suffix) return pb.suffix - pa.suffix
      }
      // Fallback: newest created first (createdAt is always returned from API)
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })

  const getStatusVariant = (status: string): "default" | "secondary" | "outline" | "success" | "warning" | "destructive" => {
    switch (status) {
      case 'ACCEPTED':
        return 'success'
      case 'DRAFT':
        return 'default'
      case 'SENT':
        return 'warning'
      case 'REJECTED':
      case 'EXPIRED':
        return 'destructive'
      default:
        return 'secondary'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  const isExpired = (validUntil: string | null) => {
    if (!validUntil) return false
    return new Date(validUntil) < new Date()
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="loader" />
      </div>
    )
  }

  return (
    <>
    <div className="space-y-8 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">
            Quotes
          </h1>
        </div>
        <div className="flex items-center gap-3 self-start sm:self-auto">
          <Button
            variant="outline"
            size="icon"
            onClick={loadQuotes}
            disabled={loading}
            title="Sync from QuickBooks and refresh"
            className="group"
          >
            <RefreshCw className={`h-5 w-5 transition-transform duration-300 ${loading ? 'animate-spin' : 'group-hover:rotate-180'}`} />
          </Button>
          <Button asChild>
            <Link href="/quotes/new" title="New Quote" className="gap-2">
              <Plus size={18} aria-hidden="true" />
              New Quote
            </Link>
          </Button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <Card className="border-red-500/50 bg-red-500/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <p className="text-red-400 font-medium">Error loading quotes</p>
                <p className="text-red-300/80 text-sm mt-1">{error}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => fetchQuotes()}>
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search Bar */}
      <div className="relative">
        <Input
          type="text"
          placeholder="Search quotes by number, customer, or status..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full"
        />
      </div>

      {/* Quotes Grid */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="grid gap-4"
      >
        {filteredQuotes.map((quote, index) => (
          <motion.div
            key={quote.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * index }}
          >
            <Link href={`/quotes/${quote.id}`}>
              <Card className="group cursor-pointer hover:bg-white/5 transition-colors">
                <CardContent className="p-6">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    {/* Quote Info */}
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="text-xl font-bold text-white">
                          {quote.quoteNumber}
                        </h3>
                        <Badge variant={getStatusVariant(quote.status)}>
                          {quote.status}
                        </Badge>
                        {quote.validUntil && isExpired(quote.validUntil) && quote.status !== 'EXPIRED' && (
                          <Badge variant="destructive" className="text-xs">
                            Expired
                          </Badge>
                        )}
                      </div>
                      
                      <div className="space-y-1">
                        <p className="text-white font-medium">{quote.customerName}</p>
                        {quote.customerEmail && (
                          <p className="text-white/60 text-sm">{quote.customerEmail}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-white/60">
                          {quote.quoteItems.length} item{quote.quoteItems.length !== 1 ? 's' : ''}
                        </span>
                        <span className="text-white/40">•</span>
                        <span className="text-white/60">
                          Created: {formatDate(quote.createdAt)}
                        </span>
                        {quote.validUntil && (
                          <>
                            <span className="text-white/40">•</span>
                            <span className={`${isExpired(quote.validUntil) ? 'text-red-400' : 'text-white/60'}`}>
                              Valid until: {formatDate(quote.validUntil)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Amount */}
                    <div className="text-right">
                      {quote.discountAmount > 0 && (
                        <p className="text-sm text-white/40 line-through">
                          ${quote.subtotal.toFixed(2)}
                        </p>
                      )}
                      <p className="text-sm text-white/60">Total</p>
                      <p className="text-2xl font-bold text-white">
                        ${quote.total.toFixed(2)}
                      </p>
                      {quote.discountAmount > 0 && (
                        <p className="text-sm text-green-400">
                          -{quote.discountType === 'percentage' ? `${quote.discountValue}%` : `$${quote.discountAmount.toFixed(2)}`} discount
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </motion.div>
        ))}
      </motion.div>

      {filteredQuotes.length === 0 && !error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <Card className="text-center py-16 border-none">
            <CardContent>
              <img src="/shrug.png" alt="armadillo" className="w-75 h-75 mx-auto mb-6" />
              <h3 className="text-2xl font-bold text-white mb-2">No quotes found</h3>
              <Button asChild>
                <Link href="/quotes/new" title="Create Quote">
                  <Plus className="w-5 h-5 mr-2" />
                  New Quote
                </Link>
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>

    {/* Sync toast — bottom-right, auto-dismiss */}
    <AnimatePresence>
      {syncMessage && (
        <motion.div
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 24 }}
          transition={{ type: 'tween', duration: 0.2 }}
          className="fixed bottom-6 right-6 z-50 max-w-sm rounded-lg border px-4 py-3 shadow-lg"
          style={{
            backgroundColor: 'hsl(var(--background))',
            borderColor: syncMessage.startsWith('Synced') ? 'rgba(74, 222, 128, 0.5)' : 'rgba(251, 191, 36, 0.5)',
          }}
        >
          <p className={syncMessage.startsWith('Synced') ? 'text-green-400 text-sm font-medium' : 'text-amber-400 text-sm font-medium'}>
            {syncMessage}
          </p>
        </motion.div>
      )}
    </AnimatePresence>
    </>
  )
}

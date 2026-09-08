'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { ArrowLeft, RefreshCw, AlertTriangle, Check, X, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'

interface PlanRow {
  sku: string
  confidence: 'exact' | 'proposed'
  reason: string
  armabaseQuantity: number | null
  shopifyQuantity: number
  delta: number | null
  productTitle: string
  variantTitle: string
  variantId: number
  variantSku: string
  tracked: boolean
  blockedReason?: string
}

interface SyncPlan {
  summary: {
    armabaseSkus: number
    shopifyVariants: number
    matched: number
    matchedExact: number
    matchedProposed: number
    readyToPush: number
    wouldChange: number
    blocked: number
    unmatchedSkus: number
    unmatchedVariants: number
  }
  plan: PlanRow[]
  unmatched: Array<{ sku: string; reason: string }>
  unmatchedVariants: Array<{ productTitle: string; variantTitle: string; quantity: number }>
}

/** A push that moves stock by more than this is worth a second look. */
const LARGE_DELTA = 100

export default function ShopifySyncPage() {
  const [plan, setPlan] = useState<SyncPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [writeSkus, setWriteSkus] = useState(true)
  const [applying, setApplying] = useState(false)
  const [result, setResult] = useState<any>(null)

  const loadPlan = async () => {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const response = await fetch('/api/shopify/inventory/sync')
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.details || data.error || 'Failed to load sync plan')
      }
      setPlan(data)
      // Nothing is selected by default - every push is an explicit choice.
      setSelected(new Set())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sync plan')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPlan()
  }, [])

  const pushable = useMemo(
    () => (plan?.plan || []).filter((row) => !row.blockedReason && row.delta !== 0),
    [plan]
  )

  const toggle = (sku: string) => {
    setSelected((previous) => {
      const next = new Set(previous)
      if (next.has(sku)) {
        next.delete(sku)
      } else {
        next.add(sku)
      }
      return next
    })
  }

  const apply = async () => {
    if (selected.size === 0) return
    const confirmed = window.confirm(
      `Push Armabase quantities to Shopify for ${selected.size} item${selected.size === 1 ? '' : 's'}?\n\n` +
        'This overwrites the stock level shown on the live storefront.'
    )
    if (!confirmed) return

    setApplying(true)
    try {
      const response = await fetch('/api/shopify/inventory/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skus: [...selected], writeSkus }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.details || data.error || 'Sync failed')
      }
      setResult(data)
      await loadPlan()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed')
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/inventory">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Inventory
          </Button>
        </Link>
        <h1 className="text-2xl font-semibold">Shopify inventory sync</h1>
        <Button variant="outline" size="sm" className="ml-auto" onClick={loadPlan} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Pushes Armabase stock levels into Shopify so the storefront shows Armabase&apos;s numbers.
        Nothing is sent to Shopify until you select rows and choose Push.
      </p>

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {result && (
        <Card className="border-green-600">
          <CardContent className="pt-6 text-sm space-y-1">
            <div className="font-medium">
              Pushed {result.pushed} of {result.requested} to Shopify
              {result.failed > 0 && ` · ${result.failed} failed`}
            </div>
            {result.results
              ?.filter((entry: any) => !entry.ok)
              .map((entry: any) => (
                <div key={entry.sku} className="text-destructive">
                  {entry.sku}: {entry.message}
                </div>
              ))}
          </CardContent>
        </Card>
      )}

      {loading && <Skeleton className="h-64 w-full" />}

      {plan && !loading && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <SummaryCard label="Armabase SKUs" value={plan.summary.armabaseSkus} />
            <SummaryCard label="Shopify variants" value={plan.summary.shopifyVariants} />
            <SummaryCard label="Matched" value={plan.summary.matched} />
            <SummaryCard label="Would change" value={plan.summary.wouldChange} />
            <SummaryCard label="Unmatched SKUs" value={plan.summary.unmatchedSkus} />
          </div>

          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelected(new Set(pushable.map((row) => row.sku)))}
                >
                  Select all {pushable.length} changes
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setSelected(
                      new Set(
                        pushable
                          .filter((row) => row.confidence === 'exact')
                          .map((row) => row.sku)
                      )
                    )
                  }
                >
                  Select SKU-matched only
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
                  Clear
                </Button>

                <label className="flex items-center gap-2 text-sm ml-auto">
                  <input
                    type="checkbox"
                    checked={writeSkus}
                    onChange={(event) => setWriteSkus(event.target.checked)}
                  />
                  Also write the Armabase SKU onto the Shopify variant
                </label>

                <Button onClick={apply} disabled={selected.size === 0 || applying}>
                  <Upload className="h-4 w-4 mr-1" />
                  {applying ? 'Pushing…' : `Push ${selected.size} to Shopify`}
                </Button>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10" />
                    <TableHead>SKU</TableHead>
                    <TableHead>Shopify variant</TableHead>
                    <TableHead>Match</TableHead>
                    <TableHead className="text-right">Armabase</TableHead>
                    <TableHead className="text-right">Shopify</TableHead>
                    <TableHead className="text-right">Change</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plan.plan.map((row) => {
                    const blocked = Boolean(row.blockedReason)
                    const unchanged = row.delta === 0
                    const large = row.delta !== null && Math.abs(row.delta) >= LARGE_DELTA

                    return (
                      <TableRow key={row.sku} className={blocked ? 'opacity-50' : ''}>
                        <TableCell>
                          <input
                            type="checkbox"
                            disabled={blocked || unchanged}
                            checked={selected.has(row.sku)}
                            onChange={() => toggle(row.sku)}
                          />
                        </TableCell>
                        <TableCell className="font-mono text-xs">{row.sku}</TableCell>
                        <TableCell className="text-sm">
                          {row.productTitle}
                          <span className="text-muted-foreground"> · {row.variantTitle}</span>
                        </TableCell>
                        <TableCell>
                          {row.confidence === 'exact' ? (
                            <Badge variant="secondary" title={row.reason}>
                              SKU match
                            </Badge>
                          ) : (
                            <Badge variant="outline" title={row.reason}>
                              Proposed
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.armabaseQuantity ?? '—'}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{row.shopifyQuantity}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {blocked ? (
                            <span className="text-xs text-muted-foreground">{row.blockedReason}</span>
                          ) : unchanged ? (
                            <span className="text-muted-foreground inline-flex items-center gap-1">
                              <Check className="h-3 w-3" /> in sync
                            </span>
                          ) : (
                            <span
                              className={large ? 'text-amber-600 inline-flex items-center gap-1' : ''}
                            >
                              {large && <AlertTriangle className="h-3 w-3" />}
                              {row.delta! > 0 ? '+' : ''}
                              {row.delta}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardContent className="pt-6">
                <h2 className="font-medium mb-3 flex items-center gap-2">
                  <X className="h-4 w-4" />
                  Armabase SKUs with no Shopify variant ({plan.unmatched.length})
                </h2>
                <div className="space-y-1 text-sm">
                  {plan.unmatched.map((row) => (
                    <div key={row.sku} className="flex gap-2">
                      <span className="font-mono text-xs w-28 shrink-0">{row.sku}</span>
                      <span className="text-muted-foreground text-xs">{row.reason}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <h2 className="font-medium mb-3 flex items-center gap-2">
                  <X className="h-4 w-4" />
                  Shopify variants not in Armabase ({plan.unmatchedVariants.length})
                </h2>
                <div className="space-y-1 text-sm">
                  {plan.unmatchedVariants.map((variant, index) => (
                    <div key={index} className="text-xs text-muted-foreground">
                      {variant.productTitle} · {variant.variantTitle}
                      <span className="tabular-nums"> ({variant.quantity})</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  )
}

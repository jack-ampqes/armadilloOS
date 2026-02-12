'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, Package, Truck, Clock, CheckCircle, ChevronRight, ChevronDown, Plus, ExternalLink, RefreshCw, X, Trash2, Upload, Loader2, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useImageColors, getColorVariants } from '@/lib/useImageColors'
import { getEffectiveTrackingUrl } from '@/lib/tracking'
import { OrderTrackingTimeline } from '@/components/OrderTrackingTimeline'
import type { TrackingEvent } from '@/lib/tracking'

interface ManufacturerOrderItem {
  id: string
  sku: string
  product_name: string
  quantity_ordered: number
  quantity_received: number
  unit_cost: number
  total_cost: number
  manufacturer_sku?: string
  notes?: string
}

interface ManufacturerOrder {
  id: string
  order_number: string
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled'
  order_date: string
  expected_delivery?: string
  actual_delivery?: string
  tracking_number?: string
  tracking_url?: string
  carrier?: string
  total_amount: number
  items: ManufacturerOrderItem[]
  inventory_applied_at?: string | null
}

interface Manufacturer {
  id: string
  name: string
  contact_name?: string
  contact_email?: string
  contact_phone?: string
  website?: string
  lead_time?: string
  is_active: boolean
  orders: ManufacturerOrder[]
}

interface InventoryProduct {
  sku: string
  name: string
  price: number
}

interface NewOrderItem {
  sku: string
  product_name: string
  quantity: number
  unit_cost: number
}

// Manufacturer logo mapping - add new manufacturers here
const manufacturerLogos: Record<string, string> = {
  'PPE MAX': '/ppemaxLOGO.png',
  'PPEMAX': '/ppemaxLOGO.png',
  'PPE Max': '/ppemaxLOGO.png',
  // Add more manufacturers as needed
}

const getManufacturerLogo = (name: string): string | null => {
  // Check exact match first
  if (manufacturerLogos[name]) return manufacturerLogos[name]
  // Check case-insensitive match
  const lowerName = name.toLowerCase()
  for (const [key, value] of Object.entries(manufacturerLogos)) {
    if (key.toLowerCase() === lowerName) return value
  }
  return null
}

export default function ManufacturerOrdersPage() {
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([])
  const [selectedManufacturer, setSelectedManufacturer] = useState<Manufacturer | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  
  // Add manufacturer modal state
  const [showAddModal, setShowAddModal] = useState(false)
  const [newManufacturer, setNewManufacturer] = useState({
    name: '',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    website: '',
    lead_time: ''
  })
  const [saving, setSaving] = useState(false)
  
  // New order modal state
  const [showNewOrderModal, setShowNewOrderModal] = useState(false)
  const [inventoryProducts, setInventoryProducts] = useState<InventoryProduct[]>([])
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [newOrder, setNewOrder] = useState({
    expected_delivery: '',
    po_number: '',
    notes: '',
    tracking_number: '',
    carrier: '',
    ship_date: ''
  })
  const [orderItems, setOrderItems] = useState<NewOrderItem[]>([])
  const [savingOrder, setSavingOrder] = useState(false)
  
  // Document import state
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  
  // Product search dropdown state
  const [openProductDropdown, setOpenProductDropdown] = useState<number | null>(null)
  const [productSearchQuery, setProductSearchQuery] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Tracking details (fetched from API for orders with tracking numbers)
  const [trackingDetails, setTrackingDetails] = useState<Record<string, { events: TrackingEvent[]; origin?: string; destination?: string; status?: string; loading?: boolean }>>({})

  // Loading state for "Add to inventory" button per order
  const [applyingOrderId, setApplyingOrderId] = useState<string | null>(null)

  // Dynamic color theming based on manufacturer logo
  const selectedLogoUrl = selectedManufacturer ? getManufacturerLogo(selectedManufacturer.name) : null
  const { dominant: brandColor, vibrant: vibrantColor } = useImageColors(selectedLogoUrl)
  
  // Use vibrant color if available, fallback to dominant
  const themeColor = vibrantColor || brandColor
  const colorVariants = useMemo(() => 
    themeColor ? getColorVariants(themeColor) : null
  , [themeColor])

  // Filtered products for searchable dropdown
  const filteredProducts = useMemo(() => {
    if (!productSearchQuery.trim()) return inventoryProducts
    const query = productSearchQuery.toLowerCase()
    return inventoryProducts.filter(p => 
      p.name.toLowerCase().includes(query) || 
      p.sku.toLowerCase().includes(query)
    )
  }, [inventoryProducts, productSearchQuery])

  // Click outside handler for product dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenProductDropdown(null)
        setProductSearchQuery('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    fetchManufacturers()
  }, [])

  // Fetch tracking for all orders with tracking numbers when manufacturer is selected
  useEffect(() => {
    const orders = selectedManufacturer?.orders || []
    const withTracking = orders.filter((o) => o.tracking_number)
    if (withTracking.length === 0) return
    withTracking.forEach((order) => fetchTracking(order))
  }, [selectedManufacturer?.id, selectedManufacturer?.orders])

  const applyOrderToInventory = async (order: ManufacturerOrder) => {
    setApplyingOrderId(order.id)
    try {
      const res = await fetch(`/api/manufacturer-orders/${order.id}/apply-to-inventory`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.applied && selectedManufacturer) {
        const updated = await fetch(`/api/manufacturers/${selectedManufacturer.id}`)
        if (updated.ok) {
          const manufacturer = await updated.json()
          setSelectedManufacturer(manufacturer)
        }
        fetchManufacturers(true)
      } else if (!res.ok) {
        alert(data.error || 'Failed to add to inventory')
      } else if (data.applied === false && data.message) {
        alert(data.message)
      }
    } catch {
      alert('Failed to add to inventory')
    } finally {
      setApplyingOrderId(null)
    }
  }

  const fetchManufacturers = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }
    
    try {
      const response = await fetch('/api/manufacturers?includeOrders=true')
      const data = await response.json()
      
      if (response.ok) {
        setManufacturers(Array.isArray(data) ? data : [])
      } else {
        console.error('Failed to fetch manufacturers:', data)
        // Still set empty array so page renders
        setManufacturers([])
      }
    } catch (error) {
      console.error('Error fetching manufacturers:', error)
      setManufacturers([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleAddManufacturer = async () => {
    if (!newManufacturer.name.trim()) return
    
    setSaving(true)
    try {
      const response = await fetch('/api/manufacturers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newManufacturer)
      })
      
      if (response.ok) {
        setShowAddModal(false)
        setNewManufacturer({
          name: '',
          contact_name: '',
          contact_email: '',
          contact_phone: '',
          website: '',
          lead_time: ''
        })
        fetchManufacturers(true)
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to add manufacturer')
      }
    } catch (error) {
      console.error('Error adding manufacturer:', error)
      alert('Failed to add manufacturer')
    } finally {
      setSaving(false)
    }
  }

  const fetchInventoryProducts = async () => {
    setLoadingProducts(true)
    try {
      const response = await fetch('/api/inventory')
      if (response.ok) {
        const data = await response.json()
        const products = (data.inventory || []).map((item: any) => ({
          sku: item.sku,
          name: item.product?.name || item.name || item.sku,
          price: item.product?.price || item.price || 0
        }))
        setInventoryProducts(products)
      }
    } catch (error) {
      console.error('Error fetching inventory:', error)
    } finally {
      setLoadingProducts(false)
    }
  }

  const openNewOrderModal = () => {
    setShowNewOrderModal(true)
    setNewOrder({ 
      expected_delivery: '', 
      po_number: '', 
      notes: '',
      tracking_number: '',
      carrier: '',
      ship_date: ''
    })
    setOrderItems([])
    setImportError(null)
    fetchInventoryProducts()
  }

  const processImportFile = async (file: File) => {
    setImporting(true)
    setImportError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', 'auto')

      const response = await fetch('/api/parse-document', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to parse document')
      }

      if (result.success && result.data) {
        const data = result.data

        // Update order fields from parsed data
        setNewOrder(prev => ({
          ...prev,
          tracking_number: data.tracking_number || prev.tracking_number,
          carrier: data.carrier || prev.carrier,
          ship_date: data.ship_date || prev.ship_date,
          expected_delivery: data.expected_delivery || prev.expected_delivery,
          po_number: data.po_number || prev.po_number,
          notes: data.ship_to_address 
            ? `Ship to: ${data.ship_to_name || ''} ${data.ship_to_address}\n${prev.notes}`.trim()
            : prev.notes
        }))

        // If items were extracted, add them to the order
        if (data.items && Array.isArray(data.items) && data.items.length > 0) {
          const newItems: NewOrderItem[] = data.items.map((item: any) => {
            // Try to match SKU with inventory
            const matchedProduct = inventoryProducts.find(p => 
              p.sku.toLowerCase() === (item.sku || '').toLowerCase() ||
              p.name.toLowerCase().includes((item.name || '').toLowerCase())
            )

            return {
              sku: matchedProduct?.sku || item.sku || '',
              product_name: matchedProduct?.name || item.name || item.description || '',
              quantity: parseInt(item.quantity) || 1,
              unit_cost: parseFloat(item.unit_cost) || matchedProduct?.price || 0
            }
          })

          setOrderItems(prev => [...prev, ...newItems])
        }

        // Show what was extracted
        console.log('Extracted data:', data)
      }
    } catch (error: any) {
      console.error('Import error:', error)
      setImportError(error.message || 'Failed to import document')
    } finally {
      setImporting(false)
    }
  }

  const handleDocumentImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    await processImportFile(file)
    // Reset file input
    e.target.value = ''
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const file = e.dataTransfer.files?.[0]
    if (!file) return

    // Validate file type
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'application/pdf']
    if (!validTypes.includes(file.type)) {
      setImportError('Please drop an image or PDF file')
      return
    }

    await processImportFile(file)
  }

  const addOrderItem = () => {
    setOrderItems([...orderItems, { sku: '', product_name: '', quantity: 1, unit_cost: 0 }])
  }

  const updateOrderItem = (index: number, field: keyof NewOrderItem, value: string | number) => {
    const updated = [...orderItems]
    if (field === 'sku') {
      const product = inventoryProducts.find(p => p.sku === value)
      updated[index] = {
        ...updated[index],
        sku: value as string,
        product_name: product?.name || '',
        unit_cost: product?.price || 0
      }
    } else {
      updated[index] = { ...updated[index], [field]: value }
    }
    setOrderItems(updated)
  }

  const removeOrderItem = (index: number) => {
    setOrderItems(orderItems.filter((_, i) => i !== index))
  }

  const calculateOrderTotal = () => {
    return orderItems.reduce((sum, item) => sum + (item.quantity * item.unit_cost), 0)
  }

  const handleCreateOrder = async () => {
    if (!selectedManufacturer || orderItems.length === 0) {
      alert('Please add at least one item to the order')
      return
    }

    // Validate all items have SKU and quantity
    const invalidItems = orderItems.filter(item => !item.sku || item.quantity <= 0)
    if (invalidItems.length > 0) {
      alert('Please fill in all item details (SKU and quantity)')
      return
    }

    setSavingOrder(true)
    try {
      const trackingUrl = getEffectiveTrackingUrl(
        null,
        newOrder.carrier,
        newOrder.tracking_number
      )
      const orderData = {
        manufacturer_id: selectedManufacturer.id,
        expected_delivery: newOrder.expected_delivery || null,
        po_number: newOrder.po_number || null,
        notes: newOrder.notes || null,
        tracking_number: newOrder.tracking_number || null,
        tracking_url: trackingUrl || null,
        carrier: newOrder.carrier || null,
        total_amount: calculateOrderTotal(),
        // If we have ship_date, set status to 'shipped'
        status: newOrder.tracking_number ? 'shipped' : 'pending',
        items: orderItems.map(item => ({
          sku: item.sku,
          product_name: item.product_name,
          quantity_ordered: item.quantity,
          unit_cost: item.unit_cost,
          total_cost: item.quantity * item.unit_cost
        }))
      }

      const response = await fetch('/api/manufacturer-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
      })

      if (response.ok) {
        setShowNewOrderModal(false)
        // Refresh the manufacturer data to show the new order
        const updatedResponse = await fetch(`/api/manufacturers/${selectedManufacturer.id}`)
        if (updatedResponse.ok) {
          const updatedManufacturer = await updatedResponse.json()
          setSelectedManufacturer(updatedManufacturer)
        }
        fetchManufacturers(true)
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to create order')
      }
    } catch (error) {
      console.error('Error creating order:', error)
      alert('Failed to create order')
    } finally {
      setSavingOrder(false)
    }
  }

  const fetchTracking = async (order: ManufacturerOrder) => {
    if (!order.tracking_number) return
    setTrackingDetails(prev => ({
      ...prev,
      [order.id]: { ...prev[order.id], loading: true, events: prev[order.id]?.events || [] }
    }))
    try {
      const res = await fetch('/api/tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trackingNumber: order.tracking_number,
          carrier: order.carrier,
          trackingUrl: order.tracking_url
        })
      })
      const data = await res.json()
      if (res.ok) {
        setTrackingDetails(prev => ({
          ...prev,
          [order.id]: {
            events: data.events || [],
            origin: data.origin,
            destination: data.destination,
            status: data.status,
            loading: false
          }
        }))
      } else {
        setTrackingDetails(prev => ({
          ...prev,
          [order.id]: { events: [], loading: false }
        }))
      }
    } catch {
      setTrackingDetails(prev => ({
        ...prev,
        [order.id]: { events: [], loading: false }
      }))
    }
  }

  type DisplayStatus = 'ordered' | 'shipped' | 'received' | 'cancelled'

  const getDisplayStatus = (order: ManufacturerOrder): DisplayStatus => {
    if (order.status === 'cancelled') return 'cancelled'
    const trackingStatus = trackingDetails[order.id]?.status?.toLowerCase()
    // When we have FedEx tracking data, use it exclusively - only show "received" when FedEx says delivered
    if (trackingStatus) {
      if (trackingStatus === 'delivered') return 'received'
      if (trackingStatus === 'in_transit' || trackingStatus === 'out_for_delivery') return 'shipped'
      return 'ordered'
    }
    // Orders with tracking number but no tracking data yet: don't assume received from order.status
    if (order.tracking_number) return order.status === 'shipped' ? 'shipped' : 'ordered'
    // No tracking number - use order status (e.g. non-FedEx carrier)
    if (order.status === 'delivered') return 'received'
    if (order.status === 'shipped') return 'shipped'
    return 'ordered'
  }

  const getStatusIcon = (displayStatus: DisplayStatus) => {
    switch (displayStatus) {
      case 'ordered':
        return <Clock className="h-4 w-4" />
      case 'shipped':
        return <Truck className="h-4 w-4" />
      case 'received':
        return <CheckCircle className="h-4 w-4" />
      case 'cancelled':
        return <X className="h-4 w-4" />
    }
  }

  const getStatusVariant = (displayStatus: DisplayStatus): "default" | "secondary" | "outline" | "success" | "warning" | "destructive" => {
    switch (displayStatus) {
      case 'ordered':
        return 'warning'
      case 'shipped':
        return 'secondary'
      case 'received':
        return 'success'
      case 'cancelled':
        return 'destructive'
    }
  }

  const getIncomingOrders = (orders: ManufacturerOrder[]) => {
    return orders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled')
  }

  const getPastOrders = (orders: ManufacturerOrder[]) => {
    return orders.filter(o => o.status === 'delivered' || o.status === 'cancelled')
  }

  const filteredManufacturers = manufacturers.filter(m =>
    m.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-white/60" />
      </div>
    )
  }

  // Manufacturer detail view
  if (selectedManufacturer) {
    const incomingOrders = getIncomingOrders(selectedManufacturer.orders || [])
    const pastOrders = getPastOrders(selectedManufacturer.orders || [])

    return (
      <div className="space-y-8 max-w-7xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setSelectedManufacturer(null)}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            {getManufacturerLogo(selectedManufacturer.name) ? (
              <div className="w-14 h-14 flex items-center justify-center overflow-hidden flex-shrink-0">
                <Image
                  src={getManufacturerLogo(selectedManufacturer.name)!}
                  alt={`${selectedManufacturer.name} logo`}
                  width={56}
                  height={56}
                  className="object-contain"
                />
              </div>
            ) : (
              <div className="w-14 h-14 rounded-lg bg-white/10 flex items-center justify-center">
                <Package className="h-7 w-7 text-white/60" />
              </div>
            )}
            <div>
              <h1 
                className="text-3xl font-bold"
                style={colorVariants ? { color: colorVariants.base } : { color: 'white' }}
              >
                {selectedManufacturer.name}
              </h1>
              <p className="text-white/60 mt-1">
                {selectedManufacturer.contact_email && (
                  <span>{selectedManufacturer.contact_email}</span>
                )}
                {selectedManufacturer.contact_phone && (
                  <span className="ml-4">{selectedManufacturer.contact_phone}</span>
                )}
              </p>
            </div>
          </div>
          <Button 
            onClick={openNewOrderModal}
            className="transition-opacity hover:opacity-70"
            style={colorVariants ? { 
              backgroundColor: colorVariants.base,
              color: colorVariants.text,
              borderColor: '#181818'
            } : undefined}
          >
            <Plus className="h-5 w-5 mr-2" />
            New Order
          </Button>
        </div>

        {/* New Order Modal */}
        {showNewOrderModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-2xl border border-white/10 max-h-[90vh] overflow-y-auto">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-white">New Order - {selectedManufacturer.name}</h2>
                  <Button variant="ghost" size="icon" onClick={() => setShowNewOrderModal(false)}>
                    <X className="h-5 w-5" />
                  </Button>
                </div>
                
                <div className="space-y-6">
                  {/* Import Document Section */}
                  <div 
                    className={`border-2 border-dashed rounded-lg p-4 transition-all duration-200 ${
                      isDragging ? 'scale-[1.02]' : ''
                    }`}
                    style={{ 
                      borderColor: isDragging 
                        ? (colorVariants?.base || '#808080') 
                        : (colorVariants?.border || 'rgba(255,255,255,0.2)'),
                      backgroundColor: isDragging 
                        ? (colorVariants?.light || 'rgba(59,130,246,0.1)') 
                        : 'transparent'
                    }}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-10 h-10 rounded-lg flex items-center justify-center transition-colors"
                          style={colorVariants ? { backgroundColor: colorVariants.light } : { backgroundColor: 'rgba(255,255,255,0.1)' }}
                        >
                          <Upload 
                            className={`h-5 w-5 transition-transform ${isDragging ? 'scale-110' : ''}`}
                            style={colorVariants ? { color: colorVariants.base } : { color: 'white' }}
                          />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">
                            {isDragging ? 'Drop to import' : 'Import Document'}
                          </p>
                          <p className="text-xs text-white/60">
                            {isDragging ? 'Release to analyze' : 'Drag & drop or click to upload'}
                          </p>
                        </div>
                      </div>
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept="image/*,.pdf,application/pdf"
                          onChange={handleDocumentImport}
                          className="hidden"
                          disabled={importing}
                        />
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="pointer-events-none flex items-center justify-center gap-2"
                          disabled={importing}
                        >
                          {importing ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <span>Analyzing...</span>
                            </>
                          ) : (
                            <>
                              <Upload className="h-4 w-4" />
                              <span>Upload</span>
                            </>
                          )}
                        </Button>
                      </label>
                    </div>
                    {importError && (
                      <p className="text-red-400 text-sm mt-2">{importError}</p>
                    )}
                  </div>

                  {/* Order Details */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="po_number">PO Number</Label>
                      <Input
                        id="po_number"
                        value={newOrder.po_number}
                        onChange={(e) => setNewOrder({ ...newOrder, po_number: e.target.value })}
                        placeholder="Purchase order #"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="expected_delivery">Expected Delivery</Label>
                      <Input
                        id="expected_delivery"
                        type="date"
                        value={newOrder.expected_delivery}
                        onChange={(e) => setNewOrder({ ...newOrder, expected_delivery: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                  </div>

                  {/* Shipping Details */}
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="tracking_number">Tracking Number</Label>
                      <Input
                        id="tracking_number"
                        value={newOrder.tracking_number}
                        onChange={(e) => setNewOrder({ ...newOrder, tracking_number: e.target.value })}
                        placeholder="1Z999AA10123456784"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="carrier">Carrier</Label>
                      <Select
                        value={newOrder.carrier}
                        onValueChange={(value) => setNewOrder({ ...newOrder, carrier: value })}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select carrier" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="UPS">UPS</SelectItem>
                          <SelectItem value="FedEx">FedEx</SelectItem>
                          <SelectItem value="USPS">USPS</SelectItem>
                          <SelectItem value="DHL">DHL</SelectItem>
                          <SelectItem value="Freight">Freight/LTL</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="ship_date">Ship Date</Label>
                      <Input
                        id="ship_date"
                        type="date"
                        value={newOrder.ship_date}
                        onChange={(e) => setNewOrder({ ...newOrder, ship_date: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                  </div>

                  {/* Order Items */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <Label>Order Items</Label>
                      <Button variant="outline" size="sm" onClick={addOrderItem}>
                        <Plus className="h-4 w-4 mr-1" />
                        Add Item
                      </Button>
                    </div>
                    
                    {loadingProducts ? (
                      <div className="text-center py-4 text-white/60">Loading products...</div>
                    ) : orderItems.length === 0 ? (
                      <div className="text-center py-8 border border-dashed border-white/20 rounded-lg">
                        <p className="text-white/60 mb-2">No items added yet</p>
                        <Button variant="outline" size="sm" onClick={addOrderItem}>
                          <Plus className="h-4 w-4 mr-1" />
                          Add First Item
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {orderItems.map((item, index) => (
                          <div key={index} className="flex items-start gap-3 p-3 bg-white/5 rounded-lg">
                            <div className="flex-1 relative" ref={openProductDropdown === index ? dropdownRef : null}>
                              <Label className="text-xs text-white/60">Product</Label>
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenProductDropdown(openProductDropdown === index ? null : index)
                                  setProductSearchQuery('')
                                }}
                                className="w-full mt-1 flex items-center justify-between px-3 py-2 text-sm bg-transparent border border-white/20 rounded-md text-left hover:border-white/40 transition-colors"
                              >
                                <span className={item.sku ? 'text-white' : 'text-white/50'}>
                                  {item.sku 
                                    ? `${inventoryProducts.find(p => p.sku === item.sku)?.name || item.product_name} (${item.sku})`
                                    : 'Select product'
                                  }
                                </span>
                                <ChevronDown className={`h-4 w-4 text-white/50 transition-transform ${openProductDropdown === index ? 'rotate-180' : ''}`} />
                              </button>
                              
                              {openProductDropdown === index && (
                                <div className="absolute z-50 w-full mt-1 bg-zinc-900 border border-white/20 rounded-md shadow-xl overflow-hidden">
                                  <div className="p-2 border-b border-white/10">
                                    <div className="relative">
                                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                                      <input
                                        type="text"
                                        placeholder="Search products..."
                                        value={productSearchQuery}
                                        onChange={(e) => setProductSearchQuery(e.target.value)}
                                        className="w-full pl-8 pr-3 py-2 text-sm bg-white/5 border border-white/10 rounded-md text-white placeholder:text-white/40 focus:outline-none focus:border-white/30"
                                        autoFocus
                                      />
                                    </div>
                                  </div>
                                  <div className="max-h-48 overflow-y-auto">
                                    {filteredProducts.length === 0 ? (
                                      <div className="px-3 py-4 text-sm text-white/50 text-center">
                                        No products found
                                      </div>
                                    ) : (
                                      filteredProducts.map((product) => (
                                        <button
                                          key={product.sku}
                                          type="button"
                                          onClick={() => {
                                            updateOrderItem(index, 'sku', product.sku)
                                            setOpenProductDropdown(null)
                                            setProductSearchQuery('')
                                          }}
                                          className={`w-full px-3 py-2 text-sm text-left hover:bg-white/10 transition-colors ${
                                            item.sku === product.sku ? 'bg-white/10 text-white' : 'text-white/80'
                                          }`}
                                        >
                                          <div className="font-medium truncate">{product.name}</div>
                                          <div className="text-xs text-white/50">{product.sku}</div>
                                        </button>
                                      ))
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="w-24">
                              <Label className="text-xs text-white/60">Qty</Label>
                              <Input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) => updateOrderItem(index, 'quantity', parseInt(e.target.value) || 1)}
                                className="mt-1"
                              />
                            </div>
                            <div className="w-28">
                              <Label className="text-xs text-white/60">Unit Cost</Label>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.unit_cost}
                                onChange={(e) => updateOrderItem(index, 'unit_cost', parseFloat(e.target.value) || 0)}
                                className="mt-1"
                              />
                            </div>
                            <div className="w-24 text-right">
                              <Label className="text-xs text-white/60">Total</Label>
                              <p className="mt-2 text-white font-medium">
                                ${(item.quantity * item.unit_cost).toFixed(2)}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="mt-5"
                              onClick={() => removeOrderItem(index)}
                            >
                              <Trash2 className="h-4 w-4 text-red-400" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Notes */}
                  <div>
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      value={newOrder.notes}
                      onChange={(e) => setNewOrder({ ...newOrder, notes: e.target.value })}
                      placeholder="Optional order notes..."
                      className="mt-1"
                      rows={3}
                    />
                  </div>

                  {/* Order Total */}
                  {orderItems.length > 0 && (
                    <div className="flex justify-between items-center pt-4 border-t border-white/10">
                      <span className="text-white/60">Order Total</span>
                      <span className="text-2xl font-bold text-white">${calculateOrderTotal().toFixed(2)}</span>
                    </div>
                  )}
                </div>
                
                <div className="flex justify-end gap-3 mt-6">
                  <Button variant="outline" onClick={() => setShowNewOrderModal(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleCreateOrder} 
                    disabled={savingOrder || orderItems.length === 0}
                  >
                    {savingOrder ? 'Creating...' : 'Create Order'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Manufacturer Info Card */}
        <Card 
          className="overflow-hidden"
          style={colorVariants ? { 
            borderColor: colorVariants.border,
            borderWidth: '1px'
          } : undefined}
        >
          {colorVariants && (
            <div 
              className="h-1" 
              style={{ backgroundColor: colorVariants.base }}
            />
          )}
          <CardContent className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div>
                <p className="text-sm text-white/60">Lead Time</p>
                <p 
                  className="text-lg font-medium"
                  style={colorVariants ? { color: colorVariants.base } : { color: 'white' }}
                >
                  {selectedManufacturer.lead_time || 'Not specified'}
                </p>
              </div>
              <div>
                <p className="text-sm text-white/60">Active Orders</p>
                <p 
                  className="text-lg font-medium"
                  style={colorVariants ? { color: colorVariants.base } : { color: 'white' }}
                >
                  {incomingOrders.length}
                </p>
              </div>
              <div>
                <p className="text-sm text-white/60">Total Orders</p>
                <p 
                  className="text-lg font-medium"
                  style={colorVariants ? { color: colorVariants.base } : { color: 'white' }}
                >
                  {(selectedManufacturer.orders || []).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Incoming Orders */}
        <div>
          <h2 
            className="text-xl font-semibold mb-4"
            style={colorVariants ? { color: colorVariants.base } : { color: 'white' }}
          >
            Incoming Orders
          </h2>
          {incomingOrders.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-white/60">No incoming orders</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {incomingOrders.map(order => (
                <Card 
                  key={order.id} 
                  className="hover:bg-white/5 transition-all duration-200"
                  style={colorVariants ? { 
                    borderColor: colorVariants.border,
                    borderWidth: '1px'
                  } : undefined}
                >
                  <CardContent className="p-6">
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                      <div className="space-y-3">
                        <div className="flex items-center gap-3 flex-wrap">
                          <h3 
                            className="text-lg font-bold"
                            style={colorVariants ? { color: colorVariants.base } : { color: 'white' }}
                          >
                            {order.order_number}
                          </h3>
                          <Badge variant={getStatusVariant(getDisplayStatus(order))} className="flex items-center gap-1">
                            {getStatusIcon(getDisplayStatus(order))}
                            {getDisplayStatus(order).charAt(0).toUpperCase() + getDisplayStatus(order).slice(1)}
                          </Badge>
                          {getDisplayStatus(order) === 'received' && !order.inventory_applied_at && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1.5"
                              disabled={applyingOrderId === order.id}
                              onClick={() => applyOrderToInventory(order)}
                              style={colorVariants ? { borderColor: colorVariants.border } : undefined}
                            >
                              {applyingOrderId === order.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Package className="h-3.5 w-3.5" />
                              )}
                              Add to inventory
                            </Button>
                          )}
                        </div>
                        
                        <div className="text-sm text-white/60 space-y-1">
                          <p>Ordered: {new Date(order.order_date).toLocaleDateString()}</p>
                          {order.expected_delivery && (
                            <p>Expected: {new Date(order.expected_delivery).toLocaleDateString()}</p>
                          )}
                        </div>

                        {order.tracking_number && (
                          <div className="flex items-center gap-2">
                            <Truck className="h-4 w-4 text-white/60" />
                            {(() => {
                              const url = getEffectiveTrackingUrl(order.tracking_url, order.carrier, order.tracking_number)
                              return url ? (
                                <a 
                                  href={url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 font-mono hover:opacity-80 transition-opacity"
                                  style={{ color: colorVariants?.base || '#60a5fa' }}
                                >
                                  {order.tracking_number}
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              ) : (
                                <span className="text-white font-mono">{order.tracking_number}</span>
                              )
                            })()}
                            {order.carrier && (
                              <span className="text-white/40 text-sm">({order.carrier})</span>
                            )}
                          </div>
                        )}
                        <OrderTrackingTimeline 
                          status={order.status} 
                          events={trackingDetails[order.id]?.events}
                          origin={trackingDetails[order.id]?.origin}
                          destination={trackingDetails[order.id]?.destination}
                          themeColor={colorVariants?.base}
                          className={order.tracking_number ? 'mt-3' : 'mt-2'} 
                        />

                        {order.items && order.items.length > 0 && (
                          <div className="pt-2">
                            <p className="text-xs text-white/40 mb-2">Items:</p>
                            <div className="space-y-1">
                              {order.items.map((item, idx) => (
                                <p key={idx} className="text-sm text-white/80">
                                  {item.quantity_ordered}x {item.product_name} <span className="text-white/40">({item.sku})</span>
                                  {item.quantity_received > 0 && item.quantity_received < item.quantity_ordered && (
                                    <span className="text-yellow-400 ml-2">({item.quantity_received} received)</span>
                                  )}
                                </p>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="text-right">
                        <p className="text-sm text-white/60">Total</p>
                        <p 
                          className="text-xl font-bold"
                          style={colorVariants ? { color: colorVariants.base } : { color: 'white' }}
                        >
                          ${Number(order.total_amount || 0).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Past Orders */}
        <div>
          <h2 
            className="text-xl font-semibold mb-4"
            style={colorVariants ? { color: colorVariants.base } : { color: 'white' }}
          >
            Past Orders
          </h2>
          {pastOrders.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-white/60">No past orders</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {pastOrders.map(order => (
                <Card 
                  key={order.id} 
                  className="hover:bg-white/5 transition-colors opacity-75"
                >
                  <CardContent className="p-6">
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                      <div className="space-y-3">
                        <div className="flex items-center gap-3 flex-wrap">
                          <h3 className="text-lg font-bold text-white">{order.order_number}</h3>
                          <Badge variant={getStatusVariant(getDisplayStatus(order))} className="flex items-center gap-1">
                            {getStatusIcon(getDisplayStatus(order))}
                            {getDisplayStatus(order) === 'received' ? 'Received' : 'Cancelled'}
                          </Badge>
                          {getDisplayStatus(order) === 'received' && !order.inventory_applied_at && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1.5"
                              disabled={applyingOrderId === order.id}
                              onClick={() => applyOrderToInventory(order)}
                              style={colorVariants ? { borderColor: colorVariants.border } : undefined}
                            >
                              {applyingOrderId === order.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Package className="h-3.5 w-3.5" />
                              )}
                              Add to inventory
                            </Button>
                          )}
                        </div>
                        
                        <div className="text-sm text-white/60 space-y-1">
                          <p>Ordered: {new Date(order.order_date).toLocaleDateString()}</p>
                          {order.actual_delivery && (
                            <p>Delivered: {new Date(order.actual_delivery).toLocaleDateString()}</p>
                          )}
                        </div>

                        {order.tracking_number && (
                          <div className="flex items-center gap-2 text-white/60">
                            <Truck className="h-4 w-4" />
                            {(() => {
                              const url = getEffectiveTrackingUrl(order.tracking_url, order.carrier, order.tracking_number)
                              return url ? (
                                <a 
                                  href={url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 font-mono text-sm hover:opacity-80 transition-opacity"
                                  style={{ color: colorVariants?.base || '#60a5fa' }}
                                >
                                  {order.tracking_number}
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              ) : (
                                <span className="font-mono text-sm">{order.tracking_number}</span>
                              )
                            })()}
                            {order.carrier && (
                              <span className="text-white/40 text-sm">({order.carrier})</span>
                            )}
                          </div>
                        )}
                        <OrderTrackingTimeline 
                          status={order.status} 
                          events={trackingDetails[order.id]?.events}
                          origin={trackingDetails[order.id]?.origin}
                          destination={trackingDetails[order.id]?.destination}
                          themeColor={colorVariants?.base}
                          className={order.tracking_number ? 'mt-3' : 'mt-2'} 
                        />

                        {order.items && order.items.length > 0 && (
                          <div className="pt-2">
                            <p className="text-xs text-white/40 mb-2">Items:</p>
                            <div className="space-y-1">
                              {order.items.map((item, idx) => (
                                <p key={idx} className="text-sm text-white/80">
                                  {item.quantity_ordered}x {item.product_name} <span className="text-white/40">({item.sku})</span>
                                </p>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="text-right">
                        <p className="text-sm text-white/60">Total</p>
                        <p className="text-xl font-bold text-white">${Number(order.total_amount || 0).toLocaleString()}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // Manufacturer list view
  return (
    <div className="space-y-8 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            asChild
          >
            <Link href="/inventory">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-white">Manufacturer Orders</h1>
            <p className="text-white/60 mt-1">Manage inventory orders from manufacturers</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            size="icon"
            onClick={() => fetchManufacturers(true)}
            disabled={refreshing}
            title="Refresh"
          >
            <RefreshCw className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={() => setShowAddModal(true)}>
            <Plus className="h-5 w-5 mr-2" />
            Add Manufacturer
          </Button>
        </div>
      </div>

      {/* Search */}
      <Input
        type="text"
        placeholder="Search manufacturers..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="max-w-md"
      />

      {/* Manufacturers List */}
      <div className="grid gap-4">
        {filteredManufacturers.map(manufacturer => {
          const incomingCount = getIncomingOrders(manufacturer.orders || []).length
          const totalValue = (manufacturer.orders || [])
            .filter(o => o.status !== 'delivered' && o.status !== 'cancelled')
            .reduce((sum, o) => sum + Number(o.total_amount || 0), 0)

          return (
            <Card 
              key={manufacturer.id} 
              className="cursor-pointer hover:bg-white/5 transition-colors group"
              onClick={() => setSelectedManufacturer(manufacturer)}
            >
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {getManufacturerLogo(manufacturer.name) ? (
                      <div className="w-12 h-12 flex items-center justify-center overflow-hidden flex-shrink-0">
                        <Image
                          src={getManufacturerLogo(manufacturer.name)!}
                          alt={`${manufacturer.name} logo`}
                          width={48}
                          height={48}
                          className="object-contain"
                        />
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                        <Package className="h-6 w-6 text-white/60" />
                      </div>
                    )}
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <h3 className="text-xl font-bold text-white">{manufacturer.name}</h3>
                        {incomingCount > 0 && (
                          <Badge variant="default">{incomingCount} incoming</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-white/60">
                        {manufacturer.lead_time && (
                          <span>Lead time: {manufacturer.lead_time}</span>
                        )}
                        <span>{(manufacturer.orders || []).length} total orders</span>
                        {totalValue > 0 && (
                          <span className="text-white">${totalValue.toLocaleString()} pending</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-white/40 group-hover:text-white transition-colors" />
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {filteredManufacturers.length === 0 && !loading && (
        <Card className="text-center py-16">
          <CardContent>
            <div className="w-20 h-20 mx-auto mb-6 bg-white rounded-xl flex items-center justify-center">
              <Package className="w-10 h-10 text-black" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">No manufacturers found</h3>
            <p className="text-white/60 mb-6">Add your first manufacturer to track inventory orders.</p>
            <Button onClick={() => setShowAddModal(true)}>
              <Plus className="h-5 w-5 mr-2" />
              Add Manufacturer
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Add Manufacturer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-lg border border-white/10">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">Add Manufacturer</h2>
                <Button variant="ghost" size="icon" onClick={() => setShowAddModal(false)}>
                  <X className="h-5 w-5" />
                </Button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={newManufacturer.name}
                    onChange={(e) => setNewManufacturer({ ...newManufacturer, name: e.target.value })}
                    placeholder="Manufacturer name"
                    className="mt-1"
                  />
                </div>
                
                <div>
                  <Label htmlFor="contact_name">Contact Name</Label>
                  <Input
                    id="contact_name"
                    value={newManufacturer.contact_name}
                    onChange={(e) => setNewManufacturer({ ...newManufacturer, contact_name: e.target.value })}
                    placeholder="Contact person"
                    className="mt-1"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="contact_email">Email</Label>
                    <Input
                      id="contact_email"
                      type="email"
                      value={newManufacturer.contact_email}
                      onChange={(e) => setNewManufacturer({ ...newManufacturer, contact_email: e.target.value })}
                      placeholder="email@example.com"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="contact_phone">Phone</Label>
                    <Input
                      id="contact_phone"
                      value={newManufacturer.contact_phone}
                      onChange={(e) => setNewManufacturer({ ...newManufacturer, contact_phone: e.target.value })}
                      placeholder="(555) 123-4567"
                      className="mt-1"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="website">Website</Label>
                    <Input
                      id="website"
                      value={newManufacturer.website}
                      onChange={(e) => setNewManufacturer({ ...newManufacturer, website: e.target.value })}
                      placeholder="https://example.com"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="lead_time">Lead Time</Label>
                    <Input
                      id="lead_time"
                      value={newManufacturer.lead_time}
                      onChange={(e) => setNewManufacturer({ ...newManufacturer, lead_time: e.target.value })}
                      placeholder="2-3 weeks"
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end gap-3 mt-6">
                <Button variant="outline" onClick={() => setShowAddModal(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleAddManufacturer} 
                  disabled={saving || !newManufacturer.name.trim()}
                >
                  {saving ? 'Adding...' : 'Add Manufacturer'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

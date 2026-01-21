'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Minus, Trash2, Package, Truck, User, FileText, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface Product {
  id: string
  name: string
  sku: string
  price: number
  source?: 'local' | 'shopify'
  shopifyData?: {
    variantId?: number
    productId?: number
  }
}

interface SalesRep {
  id: string
  name: string
  email: string
}

interface OrderItem {
  productId: string
  quantity: number
  unitPrice: number
  product: Product
}

interface ShippingAddress {
  firstName: string
  lastName: string
  company: string
  address1: string
  address2: string
  city: string
  state: string
  zip: string
  country: string
  phone: string
}

const emptyAddress: ShippingAddress = {
  firstName: '',
  lastName: '',
  company: '',
  address1: '',
  address2: '',
  city: '',
  state: '',
  zip: '',
  country: 'US',
  phone: '',
}

export default function NewOrderPage() {
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [salesReps, setSalesReps] = useState<SalesRep[]>([])
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingProducts, setLoadingProducts] = useState(true)
  
  // Customer info
  const [customerEmail, setCustomerEmail] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [selectedSalesRep, setSelectedSalesRep] = useState('')
  
  // Shipping address
  const [shippingAddress, setShippingAddress] = useState<ShippingAddress>(emptyAddress)
  
  // Order settings
  const [notes, setNotes] = useState('')
  const [tags, setTags] = useState('')
  const [completeOrder, setCompleteOrder] = useState(false)
  
  // Product search
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoadingProducts(true)
    try {
      // Fetch products from both local and Shopify
      const [localProductsRes, shopifyProductsRes, salesRepsRes] = await Promise.all([
        fetch('/api/products'),
        fetch('/api/products?source=shopify').catch(() => null),
        fetch('/api/sales-reps'),
      ])

      const allProducts: Product[] = []

      if (localProductsRes.ok) {
        const localData = await localProductsRes.json()
        if (Array.isArray(localData)) {
          allProducts.push(...localData.map((p: any) => ({
            ...p,
            source: 'local' as const,
          })))
        }
      }

      if (shopifyProductsRes?.ok) {
        const shopifyData = await shopifyProductsRes.json()
        if (Array.isArray(shopifyData)) {
          allProducts.push(...shopifyData.map((p: any) => ({
            id: p.id,
            name: p.name,
            sku: p.sku,
            price: p.price,
            source: 'shopify' as const,
            shopifyData: p.shopifyData,
          })))
        }
      }

      setProducts(allProducts)

      if (salesRepsRes.ok) {
        const salesRepsData = await salesRepsRes.json()
        setSalesReps(salesRepsData)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoadingProducts(false)
    }
  }

  const filteredProducts = products.filter(p => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      p.name.toLowerCase().includes(query) ||
      p.sku.toLowerCase().includes(query)
    )
  })

  const addOrderItem = (product: Product) => {
    const existingItem = orderItems.find(item => item.productId === product.id)
    if (existingItem) {
      setOrderItems(orderItems.map(item =>
        item.productId === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ))
    } else {
      setOrderItems([...orderItems, {
        productId: product.id,
        quantity: 1,
        unitPrice: product.price,
        product
      }])
    }
    setSearchQuery('')
  }

  const updateQuantity = (productId: string, delta: number) => {
    setOrderItems(orderItems.map(item => {
      if (item.productId !== productId) return item
      const newQuantity = item.quantity + delta
      return newQuantity > 0 ? { ...item, quantity: newQuantity } : item
    }).filter(item => item.quantity > 0))
  }

  const removeItem = (productId: string) => {
    setOrderItems(orderItems.filter(item => item.productId !== productId))
  }

  const updateShippingAddress = (field: keyof ShippingAddress, value: string) => {
    setShippingAddress(prev => ({ ...prev, [field]: value }))
  }

  const getTotalAmount = () => {
    return orderItems.reduce((total, item) => total + (item.unitPrice * item.quantity), 0)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (orderItems.length === 0) {
      alert('Please add at least one item to the order')
      return
    }

    if (!customerEmail && !shippingAddress.address1) {
      alert('Please provide customer email or shipping address')
      return
    }

    setLoading(true)
    try {
      const salesRep = salesReps.find(r => r.id === selectedSalesRep)
      
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderItems: orderItems.map(item => ({
            productId: item.productId,
            productName: item.product.name,
            sku: item.product.sku,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            shopifyVariantId: item.product.shopifyData?.variantId,
          })),
          customerEmail,
          customerPhone,
          shippingAddress: shippingAddress.address1 ? shippingAddress : undefined,
          notes,
          tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : undefined,
          salesRepName: salesRep?.name,
          completeOrder,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        if (data.orderType === 'completed') {
          alert(`Order ${data.order.orderNumber} created successfully!`)
        } else {
          alert(`Draft order ${data.draftOrder.name} created! ${data.draftOrder.invoiceUrl ? 'Invoice URL has been generated.' : ''}`)
        }
        router.push('/orders')
      } else {
        alert(`Error creating order: ${data.error || data.message}`)
      }
    } catch (error) {
      console.error('Error creating order:', error)
      alert('Failed to create order')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Header */}
      <div>
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="mb-4 text-white/60 hover:text-white"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Orders
        </Button>
        <h1 className="text-2xl font-bold text-white">Create New Order</h1>
        <p className="text-white/60 mt-1">Create a draft order in Shopify</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Order Items Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Order Items
            </CardTitle>
            <CardDescription>Add products to this order</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Product Search */}
            <div className="mb-6">
              <Label htmlFor="product-search">Search Products</Label>
              <div className="relative mt-1">
                <Input
                  id="product-search"
                  type="text"
                  placeholder="Search by name or SKU..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                
                {/* Search Results Dropdown */}
                {searchQuery && (
                  <div className="absolute z-10 w-full mt-1 bg-[#1a1a1a] border border-white/20 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {loadingProducts ? (
                      <div className="p-4 text-center text-white/60">Loading products...</div>
                    ) : filteredProducts.length === 0 ? (
                      <div className="p-4 text-center text-white/60">No products found</div>
                    ) : (
                      filteredProducts.slice(0, 10).map((product) => (
                        <button
                          key={product.id}
                          type="button"
                          onClick={() => addOrderItem(product)}
                          className="w-full px-4 py-3 text-left hover:bg-white/10 flex justify-between items-center border-b border-white/10 last:border-b-0"
                        >
                          <div>
                            <div className="font-medium text-white">{product.name}</div>
                            <div className="text-sm text-white/60 font-mono">{product.sku}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            {product.source === 'shopify' && (
                              <Badge variant="secondary" className="text-xs">Shopify</Badge>
                            )}
                            <span className="text-white/80">${product.price.toFixed(2)}</span>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Order Items List */}
            {orderItems.length === 0 ? (
              <div className="text-center py-8 text-white/40 border border-dashed border-white/20 rounded-lg">
                <Package className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>No items added yet</p>
                <p className="text-sm">Search for products above to add them</p>
              </div>
            ) : (
              <div className="space-y-3">
                {orderItems.map((item) => (
                  <div
                    key={item.productId}
                    className="flex items-center justify-between p-4 bg-white/5 rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="font-medium text-white">{item.product.name}</div>
                      <div className="text-sm text-white/60 font-mono">{item.product.sku}</div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className="text-white/60">
                        ${item.unitPrice.toFixed(2)} each
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => updateQuantity(item.productId, -1)}
                          className="h-8 w-8 p-0"
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="w-8 text-center text-white font-medium">
                          {item.quantity}
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => updateQuantity(item.productId, 1)}
                          className="h-8 w-8 p-0"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      <div className="w-24 text-right text-white font-medium">
                        ${(item.unitPrice * item.quantity).toFixed(2)}
                      </div>
                      
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeItem(item.productId)}
                        className="text-white/40 hover:text-red-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                
                {/* Total */}
                <div className="flex justify-end pt-4 border-t border-white/20">
                  <div className="text-right">
                    <span className="text-white/60 mr-4">Subtotal:</span>
                    <span className="text-xl font-bold text-white">
                      ${getTotalAmount().toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Customer Info Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Customer Information
            </CardTitle>
            <CardDescription>Contact details for the order</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <Label htmlFor="customerEmail">Email</Label>
                <Input
                  id="customerEmail"
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  className="mt-1"
                  placeholder="customer@example.com"
                />
              </div>
              
              <div>
                <Label htmlFor="customerPhone">Phone</Label>
                <Input
                  id="customerPhone"
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="mt-1"
                  placeholder="+1 555-123-4567"
                />
              </div>
              
              <div>
                <Label htmlFor="salesRep">Sales Representative</Label>
                <Select
                  value={selectedSalesRep || undefined}
                  onValueChange={setSelectedSalesRep}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select a sales rep (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {salesReps.map((rep) => (
                      <SelectItem key={rep.id} value={rep.id}>
                        {rep.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Shipping Address Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Shipping Address
            </CardTitle>
            <CardDescription>Where should this order be shipped?</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  value={shippingAddress.firstName}
                  onChange={(e) => updateShippingAddress('firstName', e.target.value)}
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={shippingAddress.lastName}
                  onChange={(e) => updateShippingAddress('lastName', e.target.value)}
                  className="mt-1"
                />
              </div>
              
              <div className="sm:col-span-2">
                <Label htmlFor="company">Company (optional)</Label>
                <Input
                  id="company"
                  value={shippingAddress.company}
                  onChange={(e) => updateShippingAddress('company', e.target.value)}
                  className="mt-1"
                />
              </div>
              
              <div className="sm:col-span-2">
                <Label htmlFor="address1">Address Line 1</Label>
                <Input
                  id="address1"
                  value={shippingAddress.address1}
                  onChange={(e) => updateShippingAddress('address1', e.target.value)}
                  className="mt-1"
                  placeholder="Street address"
                />
              </div>
              
              <div className="sm:col-span-2">
                <Label htmlFor="address2">Address Line 2 (optional)</Label>
                <Input
                  id="address2"
                  value={shippingAddress.address2}
                  onChange={(e) => updateShippingAddress('address2', e.target.value)}
                  className="mt-1"
                  placeholder="Apartment, suite, etc."
                />
              </div>
              
              <div>
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={shippingAddress.city}
                  onChange={(e) => updateShippingAddress('city', e.target.value)}
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="state">State / Province</Label>
                <Input
                  id="state"
                  value={shippingAddress.state}
                  onChange={(e) => updateShippingAddress('state', e.target.value)}
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="zip">ZIP / Postal Code</Label>
                <Input
                  id="zip"
                  value={shippingAddress.zip}
                  onChange={(e) => updateShippingAddress('zip', e.target.value)}
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="country">Country</Label>
                <Select
                  value={shippingAddress.country}
                  onValueChange={(value) => updateShippingAddress('country', value)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="US">United States</SelectItem>
                    <SelectItem value="CA">Canada</SelectItem>
                    <SelectItem value="MX">Mexico</SelectItem>
                    <SelectItem value="GB">United Kingdom</SelectItem>
                    <SelectItem value="AU">Australia</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="sm:col-span-2">
                <Label htmlFor="shippingPhone">Shipping Phone (optional)</Label>
                <Input
                  id="shippingPhone"
                  type="tel"
                  value={shippingAddress.phone}
                  onChange={(e) => updateShippingAddress('phone', e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Order Notes & Tags */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Additional Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="notes">Order Notes</Label>
                <Textarea
                  id="notes"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="mt-1"
                  placeholder="Any special instructions or internal notes..."
                />
              </div>
              
              <div>
                <Label htmlFor="tags">Tags (comma-separated)</Label>
                <Input
                  id="tags"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  className="mt-1"
                  placeholder="wholesale, priority, etc."
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Order Type Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Order Type</CardTitle>
            <CardDescription>Choose whether to create a draft or complete order</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setCompleteOrder(false)}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  !completeOrder
                    ? 'border-[#7FB446] bg-[#7FB446]/10'
                    : 'border-white/20 hover:border-white/40'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-medium text-white">Draft Order</div>
                    <div className="text-sm text-white/60 mt-1">
                      Creates a draft that can be edited before sending an invoice or completing
                    </div>
                  </div>
                  {!completeOrder && (
                    <Check className="h-5 w-5 text-[#7FB446]" />
                  )}
                </div>
              </button>
              
              <button
                type="button"
                onClick={() => setCompleteOrder(true)}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  completeOrder
                    ? 'border-[#7FB446] bg-[#7FB446]/10'
                    : 'border-white/20 hover:border-white/40'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-medium text-white">Complete Order</div>
                    <div className="text-sm text-white/60 mt-1">
                      Creates the order immediately (payment pending)
                    </div>
                  </div>
                  {completeOrder && (
                    <Check className="h-5 w-5 text-[#7FB446]" />
                  )}
                </div>
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Submit Buttons */}
        <div className="flex justify-end gap-3 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={loading || orderItems.length === 0}
            className="bg-[#7FB446] hover:bg-[#6a9a3a] text-white"
          >
            {loading ? 'Creating...' : completeOrder ? 'Create Order' : 'Create Draft Order'}
          </Button>
        </div>
      </form>
    </div>
  )
}

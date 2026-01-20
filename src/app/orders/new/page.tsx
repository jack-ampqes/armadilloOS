'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

interface Customer {
  id: string
  name: string
  email: string
}

interface SalesRep {
  id: string
  name: string
  email: string
}

interface Product {
  id: string
  name: string
  sku: string
  price: number
  inventory?: {
    quantity: number
  }
}

interface OrderItem {
  productId: string
  quantity: number
  unitPrice: number
  product: Product
}

export default function NewOrderPage() {
  const router = useRouter()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [salesReps, setSalesReps] = useState<SalesRep[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState('')
  const [selectedSalesRep, setSelectedSalesRep] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [customersRes, salesRepsRes, productsRes] = await Promise.all([
        fetch('/api/customers'),
        fetch('/api/sales-reps'),
        fetch('/api/products')
      ])

      if (customersRes.ok) {
        const customersData = await customersRes.json()
        setCustomers(customersData)
      }

      if (salesRepsRes.ok) {
        const salesRepsData = await salesRepsRes.json()
        setSalesReps(salesRepsData)
      }

      if (productsRes.ok) {
        const productsData = await productsRes.json()
        setProducts(productsData)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    }
  }

  const addOrderItem = (productId: string) => {
    const product = products.find(p => p.id === productId)
    if (!product) return

    const existingItem = orderItems.find(item => item.productId === productId)
    if (existingItem) {
      setOrderItems(orderItems.map(item =>
        item.productId === productId
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ))
    } else {
      setOrderItems([...orderItems, {
        productId,
        quantity: 1,
        unitPrice: product.price,
        product
      }])
    }
  }

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      setOrderItems(orderItems.filter(item => item.productId !== productId))
    } else {
      setOrderItems(orderItems.map(item =>
        item.productId === productId
          ? { ...item, quantity }
          : item
      ))
    }
  }

  const getTotalAmount = () => {
    return orderItems.reduce((total, item) => total + (item.unitPrice * item.quantity), 0)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCustomer || orderItems.length === 0) {
      alert('Please select a customer and add at least one item')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerId: selectedCustomer,
          salesRepId: selectedSalesRep || null,
          orderItems: orderItems.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          })),
          notes,
        }),
      })

      if (response.ok) {
        router.push('/orders')
      } else {
        const error = await response.json()
        alert(`Error creating order: ${error.error}`)
      }
    } catch (error) {
      console.error('Error creating order:', error)
      alert('Failed to create order')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-8 max-w-7xl">
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
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Order Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <Label htmlFor="customer">
                  Customer *
                </Label>
                <Select
                  value={selectedCustomer || undefined}
                  onValueChange={setSelectedCustomer}
                  required
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select a customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.name} ({customer.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="salesRep">
                  Sales Representative
                </Label>
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
                        {rep.name} ({rep.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="mt-6">
              <Label htmlFor="notes">
                Notes
              </Label>
              <Textarea
                id="notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1"
                placeholder="Any special instructions or notes..."
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Order Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <Label htmlFor="product" className="mb-2">
                Add Product
              </Label>
              <Select
                onValueChange={(value) => {
                  if (value) {
                    addOrderItem(value)
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a product to add" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name} ({product.sku}) - ${product.price.toFixed(2)}
                      {product.inventory && ` (Stock: ${product.inventory.quantity})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {orderItems.length > 0 && (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Unit Price</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orderItems.map((item) => (
                      <TableRow key={item.productId}>
                        <TableCell className="font-medium">
                          {item.product.name}
                        </TableCell>
                        <TableCell className="text-white/70 font-mono">
                          {item.product.sku}
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateQuantity(item.productId, parseInt(e.target.value) || 0)}
                            className="w-20"
                          />
                        </TableCell>
                        <TableCell className="text-white/70">
                          ${item.unitPrice.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-white/70">
                          ${(item.unitPrice * item.quantity).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => updateQuantity(item.productId, 0)}
                            className="text-white/60 hover:text-white"
                          >
                            Remove
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {orderItems.length > 0 && (
              <div className="mt-4 border-t border-white/20 pt-4">
                <div className="flex justify-end">
                  <div className="text-right">
                    <p className="text-lg font-semibold text-white">
                      Total: ${getTotalAmount().toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end space-x-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={loading || !selectedCustomer || orderItems.length === 0}
          >
            {loading ? 'Creating...' : 'Create Order'}
          </Button>
        </div>
      </form>
    </div>
  )
}


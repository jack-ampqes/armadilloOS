import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'monthly'

    // Fetch inventory data
    const { data: inventoryData, error: inventoryError } = await supabaseAdmin
      .schema('armadillo_inventory')
      .from('inventory')
      .select(`
        sku,
        quantity,
        min_stock,
        name,
        updated_at,
        product:products!inner (
          name,
          price,
          category
        )
      `)

    if (inventoryError) throw inventoryError

    // Calculate inventory value
    const inventoryValue = (inventoryData || []).reduce((sum, item) => {
      const product = Array.isArray(item.product) ? item.product[0] : item.product
      const price = parseFloat(product?.price || '0')
      const quantity = item.quantity || 0
      return sum + (price * quantity)
    }, 0)

    // Low stock items
    const lowStockItems = (inventoryData || []).filter(item => {
      const quantity = item.quantity || 0
      const minStock = item.min_stock || 0
      return quantity > 0 && quantity <= minStock
    })

    // Out of stock items
    const outOfStockItems = (inventoryData || []).filter(item => {
      return (item.quantity || 0) === 0
    })

    // Product performance (would need order history - simplified for now)
    const productPerformance = (inventoryData || []).map(item => {
      const product = Array.isArray(item.product) ? item.product[0] : item.product
      return {
        name: product?.name || item.name || item.sku,
        sku: item.sku,
        quantity: item.quantity || 0,
        minStock: item.min_stock || 0,
        value: (parseFloat(product?.price || '0') * (item.quantity || 0)),
        status: (item.quantity || 0) === 0 
          ? 'out_of_stock' 
          : (item.quantity || 0) <= (item.min_stock || 0) 
            ? 'low_stock' 
            : 'in_stock'
      }
    }).sort((a, b) => b.value - a.value)

    // Reorder recommendations
    const reorderRecommendations = lowStockItems
      .map(item => {
        const product = Array.isArray(item.product) ? item.product[0] : item.product
        return {
          sku: item.sku,
          name: product?.name || item.name || item.sku,
          currentStock: item.quantity || 0,
          minStock: item.min_stock || 0,
          recommendedOrder: Math.max((item.min_stock || 0) * 2 - (item.quantity || 0), (item.min_stock || 0)),
          category: product?.category || 'Uncategorized'
        }
      })
      .sort((a, b) => (a.currentStock / a.minStock) - (b.currentStock / b.minStock))

    // Inventory by category
    const inventoryByCategory: Record<string, { value: number; items: number }> = {}
    inventoryData?.forEach(item => {
      const product = Array.isArray(item.product) ? item.product[0] : item.product
      const category = product?.category || 'Uncategorized'
      const value = parseFloat(product?.price || '0') * (item.quantity || 0)
      
      if (!inventoryByCategory[category]) {
        inventoryByCategory[category] = { value: 0, items: 0 }
      }
      inventoryByCategory[category].value += value
      inventoryByCategory[category].items += 1
    })

    const categoryBreakdown = Object.entries(inventoryByCategory)
      .map(([name, data]) => ({ name, value: data.value, count: data.items }))
      .sort((a, b) => b.value - a.value)

    return NextResponse.json({
      summary: {
        totalValue: inventoryValue,
        totalItems: inventoryData?.length || 0,
        lowStockCount: lowStockItems.length,
        outOfStockCount: outOfStockItems.length,
      },
      productPerformance: productPerformance.slice(0, 20),
      reorderRecommendations: reorderRecommendations.slice(0, 20),
      categoryBreakdown,
      lowStockItems: lowStockItems.slice(0, 20).map(item => {
        const product = Array.isArray(item.product) ? item.product[0] : item.product
        return {
          sku: item.sku,
          name: product?.name || item.name || item.sku,
          quantity: item.quantity || 0,
          minStock: item.min_stock || 0,
        }
      }),
      outOfStockItems: outOfStockItems.slice(0, 20).map(item => {
        const product = Array.isArray(item.product) ? item.product[0] : item.product
        return {
          sku: item.sku,
          name: product?.name || item.name || item.sku,
        }
      }),
    })
  } catch (error) {
    console.error('Error generating inventory report:', error)
    return NextResponse.json(
      { error: 'Failed to generate inventory report' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

interface CSVRow {
  name?: string
  sku?: string
  category?: string
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { products } = body

    if (!Array.isArray(products) || products.length === 0) {
      return NextResponse.json(
        { error: 'Products array is required' },
        { status: 400 }
      )
    }

    // Prepare products for bulk insert
    const productsToInsert = products.map((product: any) => ({
      name: product.name || product.sku, // Use SKU as name if name is missing
      description: product.description || null,
      sku: product.sku,
      price: product.price || 0, // Default price to 0 if not provided
      category: product.category || null
    }))

    // Insert products using bulk RPC function
    const { data: bulkResults, error: bulkError } = await supabase.rpc('insert_products_bulk', {
      products_json: productsToInsert as any
    })

    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[]
    }

    if (bulkError) {
      results.failed = productsToInsert.length
      results.errors.push(`Bulk insert error: ${bulkError.message}`)
    } else if (bulkResults) {
      // Count successes and failures from the RPC results
      bulkResults.forEach((result: any) => {
        if (result.success) {
          results.success++
        } else {
          results.failed++
          if (result.error_message) {
            results.errors.push(`${result.sku}: ${result.error_message}`)
          }
        }
      })
    }

    return NextResponse.json({
      message: 'Import completed',
      results: {
        total: productsToInsert.length,
        success: results.success,
        failed: results.failed,
        errors: results.errors
      }
    })
  } catch (error) {
    console.error('Error importing products:', error)
    return NextResponse.json(
      { error: 'Failed to import products' },
      { status: 500 }
    )
  }
}


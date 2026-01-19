import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import QRCode from 'qrcode'
import JsBarcode from 'jsbarcode'
import { createCanvas } from 'canvas'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const sku = searchParams.get('sku')
  const format = searchParams.get('format') || 'dataURL' // 'dataURL' or 'svg'
  const type = searchParams.get('type') || 'qr' // 'qr' or 'barcode'

  try {
    if (sku) {
      // Generate single code for specific SKU using RPC
      const { data: productData, error } = await supabase.rpc('get_product_by_sku', {
        product_sku: sku
      })
      const product = productData?.[0] // RPC returns array, get first item

      if (error || !product) {
        return NextResponse.json({ error: 'Product not found' }, { status: 404 })
      }

      let codeImage: string
      
      if (type === 'barcode') {
        // Generate barcode using SKU as the value
        const canvas = createCanvas(300, 100)
        JsBarcode(canvas, sku, {
          format: 'CODE128',
          width: 2,
          height: 80,
          displayValue: true,
          fontSize: 16,
          margin: 10
        })
        
        if (format === 'svg') {
          // For SVG, we'd need to use a different approach, but for now return dataURL
          codeImage = canvas.toDataURL('image/png')
        } else {
          codeImage = canvas.toDataURL('image/png')
        }
      } else {
        // Generate QR code with URL to inventory scan page
        const qrData = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/inventory/scan?sku=${sku}`
        
        if (format === 'svg') {
          codeImage = await QRCode.toString(qrData, { type: 'svg', width: 300 })
        } else {
          codeImage = await QRCode.toDataURL(qrData, { width: 300, margin: 2 })
        }
      }

      return NextResponse.json({
        sku,
        productName: product.name,
        code: codeImage,
        qrCode: codeImage, // Keep for backward compatibility
        barcode: type === 'barcode' ? codeImage : undefined,
        format,
        type,
      })
    } else {
      // Get all products with codes using RPC
      const { data: products, error } = await supabase.rpc('get_products')

      if (error) {
        console.error('Supabase error:', error)
        return NextResponse.json(
          { 
            error: `Database error: ${error.message || 'Unknown error'}`,
            code: error.code,
            details: error.message,
            hint: error.hint,
            details_full: JSON.stringify(error, Object.getOwnPropertyNames(error))
          },
          { status: 500 }
        )
      }

      // If no products, return empty array
      if (!products || products.length === 0) {
        return NextResponse.json({ codes: [], qrCodes: [], total: 0 })
      }

      const codes = await Promise.all(
        products.map(async (product: any) => {
          if (type === 'barcode') {
            // Generate barcode using SKU
            const canvas = createCanvas(300, 100)
            JsBarcode(canvas, product.sku, {
              format: 'CODE128',
              width: 2,
              height: 80,
              displayValue: true,
              fontSize: 16,
              margin: 10
            })
            const barcode = canvas.toDataURL('image/png')
            
            return {
              sku: product.sku,
              name: product.name,
              code: barcode,
              qrCode: barcode, // Keep for backward compatibility
              barcode,
            }
          } else {
            // Generate QR code
            const qrData = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/inventory/scan?sku=${product.sku}`
            const code = await QRCode.toDataURL(qrData, { width: 300, margin: 2 })
            
            return {
              sku: product.sku,
              name: product.name,
              code,
              qrCode: code, // Keep for backward compatibility
            }
          }
        })
      )

      return NextResponse.json({ codes, qrCodes: codes, total: codes.length, type })
    }
  } catch (error: any) {
    console.error('Code generation error:', error)
    const errorMessage = error?.message || 'Unknown error'
    const errorStack = error?.stack || ''
    return NextResponse.json(
      { 
        error: 'Failed to generate codes',
        message: errorMessage,
        details: errorMessage,
        stack: process.env.NODE_ENV === 'development' ? errorStack : undefined
      },
      { status: 500 }
    )
  }
}


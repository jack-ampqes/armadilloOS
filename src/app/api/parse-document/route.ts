import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const documentType = formData.get('type') as string || 'auto'
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Check if API key is configured
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ 
        error: 'Gemini API key not configured',
        hint: 'Get a free API key at https://aistudio.google.com/app/apikey and add GEMINI_API_KEY to your .env.local'
      }, { status: 500 })
    }

    // Initialize the client with the API key
    const ai = new GoogleGenAI({ apiKey })

    // Convert file to base64
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const base64 = buffer.toString('base64')
    
    // Determine MIME type
    const mimeType = file.type || 'image/png'
    
    // Validate supported file types
    const supportedTypes = [
      'image/png', 
      'image/jpeg', 
      'image/jpg', 
      'image/webp', 
      'image/gif',
      'application/pdf'
    ]
    
    if (!supportedTypes.includes(mimeType)) {
      return NextResponse.json({ 
        error: `Unsupported file type: ${mimeType}`,
        hint: 'Please upload a PNG, JPG, WebP, GIF, or PDF file'
      }, { status: 400 })
    }

    // Build the prompt
    const prompt = `You are a document parsing assistant. Extract information from this document image and return it as structured JSON.

For shipping labels, tracking documents, or any shipping-related documents, extract:
- tracking_number: The tracking/shipment number
- carrier: The shipping carrier (UPS, FedEx, USPS, DHL, etc.)
- ship_date: Date shipped (format: YYYY-MM-DD if possible)
- expected_delivery: Expected delivery date if shown
- ship_from_name: Sender name
- ship_from_address: Full sender address
- ship_to_name: Recipient name  
- ship_to_address: Full recipient address
- weight: Package weight if shown
- service_type: Shipping service type (Ground, Express, etc.)

For purchase orders or order lists, extract:
- po_number: Purchase order number
- order_date: Order date (format: YYYY-MM-DD if possible)
- vendor_name: Vendor/supplier name
- items: Array of items, each with:
  - sku: Product SKU/item number if shown
  - name: Product name/description
  - quantity: Quantity ordered
  - unit_cost: Unit price if shown
  - total: Line total if shown
- subtotal: Order subtotal
- shipping_cost: Shipping cost if shown
- tax: Tax amount if shown
- total: Order total

For invoices, extract similar information to purchase orders plus:
- invoice_number: Invoice number
- due_date: Payment due date
- payment_terms: Payment terms if shown

${documentType === 'auto' 
  ? 'Analyze this document and extract all relevant information.' 
  : `This is a ${documentType.replace('_', ' ')}. Extract the relevant information.`}

Return ONLY valid JSON with the extracted fields. Use null for fields that aren't visible or can't be determined. Include a "document_type" field identifying what type of document this is.`

    // Use Gemini 2.0 Flash (free tier, fast, good at vision)
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: mimeType,
                data: base64
              }
            }
          ]
        }
      ]
    })

    const content = response.text || ''
    
    // Parse the JSON from the response
    // Gemini might wrap it in markdown code blocks
    let jsonStr = content
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim()
    }
    
    try {
      const extractedData = JSON.parse(jsonStr)
      return NextResponse.json({
        success: true,
        data: extractedData,
        raw_response: content
      })
    } catch (parseError) {
      // If JSON parsing fails, return the raw content
      return NextResponse.json({
        success: true,
        data: null,
        raw_response: content,
        parse_error: 'Could not parse response as JSON'
      })
    }
  } catch (error: any) {
    console.error('Error parsing document:', error)
    return NextResponse.json({
      error: 'Failed to parse document',
      details: error?.message || 'Unknown error'
    }, { status: 500 })
  }
}

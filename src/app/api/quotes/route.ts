import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { checkQuoteExpirationAlerts } from '@/lib/alerts'
import { getDefaultQuickBooksCredentials } from '@/lib/quickbooks-connection'
import { pushQuoteToQuickBooks } from '@/lib/quote-quickbooks'

const prisma = new PrismaClient()

// Generate a unique quote number
function generateQuoteNumber(): string {
  const prefix = 'Q'
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `${prefix}-${timestamp}-${random}`
}

// GET /api/quotes - Get all quotes
export async function GET() {
  try {
    const quotes = await prisma.quote.findMany({
      include: {
        quoteItems: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json(quotes)
  } catch (error) {
    console.error('Error fetching quotes:', error)
    return NextResponse.json(
      { error: 'Failed to fetch quotes' },
      { status: 500 }
    )
  }
}

// POST /api/quotes - Create a new quote
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const {
      customerName,
      customerEmail,
      customerPhone,
      customerAddress,
      customerCity,
      customerState,
      customerZip,
      customerCountry,
      quoteItems,
      discountType,
      discountValue,
      validUntil,
      notes,
      pushToQuickBooks,
    } = body

    if (!customerName) {
      return NextResponse.json(
        { error: 'Customer name is required' },
        { status: 400 }
      )
    }

    if (!quoteItems || quoteItems.length === 0) {
      return NextResponse.json(
        { error: 'At least one quote item is required' },
        { status: 400 }
      )
    }

    // Calculate subtotal
    const subtotal = quoteItems.reduce(
      (sum: number, item: { unitPrice: number; quantity: number }) => 
        sum + (item.unitPrice * item.quantity),
      0
    )

    // Calculate discount
    let discountAmount = 0
    if (discountType && discountValue > 0) {
      if (discountType === 'percentage') {
        discountAmount = subtotal * (discountValue / 100)
      } else {
        discountAmount = discountValue
      }
    }

    // Calculate total
    const total = subtotal - discountAmount

    // Generate quote number
    const quoteNumber = generateQuoteNumber()

    // Create the quote with items
    const quote = await prisma.quote.create({
      data: {
        quoteNumber,
        customerName,
        customerEmail,
        customerPhone,
        customerAddress,
        customerCity,
        customerState,
        customerZip,
        customerCountry,
        subtotal,
        discountType,
        discountValue,
        discountAmount,
        total,
        validUntil: validUntil ? new Date(validUntil) : null,
        notes,
        quoteItems: {
          create: quoteItems.map((item: {
            productId?: string | null
            productName: string
            sku?: string
            quantity: number
            unitPrice: number
          }) => ({
            productId: item.productId || null,
            productName: item.productName,
            sku: item.sku || null,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.unitPrice * item.quantity,
          })),
        },
      },
      include: {
        quoteItems: true,
      },
    })

    // Check for quote expiration alerts after creation
    try {
      await checkQuoteExpirationAlerts()
    } catch (alertError) {
      console.error('Error checking alerts after quote creation:', alertError)
      // Don't fail the request if alert check fails
    }

    // Optionally push to QuickBooks (save quote first; on QB error return warning)
    if (pushToQuickBooks && quote) {
      try {
        const creds = await getDefaultQuickBooksCredentials()
        const { quickbooksEstimateId } = await pushQuoteToQuickBooks(quote, creds)
        const now = new Date()
        const updated = await prisma.quote.update({
          where: { id: quote.id },
          data: { quickbooksEstimateId, quickbooksSyncedAt: now },
          include: { quoteItems: true },
        })
        return NextResponse.json(updated, { status: 201 })
      } catch (qbError) {
        console.error('QuickBooks push after quote create:', qbError)
        return NextResponse.json(
          { ...quote, warning: (qbError instanceof Error ? qbError.message : 'Could not push to QuickBooks') },
          { status: 201 }
        )
      }
    }

    return NextResponse.json(quote, { status: 201 })
  } catch (error) {
    console.error('Error creating quote:', error)
    return NextResponse.json(
      { error: 'Failed to create quote' },
      { status: 500 }
    )
  }
}

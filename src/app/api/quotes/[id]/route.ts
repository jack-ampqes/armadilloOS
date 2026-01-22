import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// GET /api/quotes/[id] - Get a single quote
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    const quote = await prisma.quote.findUnique({
      where: { id },
      include: {
        quoteItems: true,
      },
    })

    if (!quote) {
      return NextResponse.json(
        { error: 'Quote not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(quote)
  } catch (error) {
    console.error('Error fetching quote:', error)
    return NextResponse.json(
      { error: 'Failed to fetch quote' },
      { status: 500 }
    )
  }
}

// PATCH /api/quotes/[id] - Update a quote (e.g., status or full update)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    
    const { 
      status, 
      quoteItems,
      customerName,
      customerEmail,
      customerPhone,
      customerAddress,
      customerCity,
      customerState,
      customerZip,
      customerCountry,
      discountType,
      discountValue,
      validUntil,
      notes,
      ...otherUpdates 
    } = body

    // Validate status if provided
    const validStatuses = ['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED']
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status' },
        { status: 400 }
      )
    }

    // If quoteItems are provided, we need to recalculate totals
    let updateData: any = {
      ...(status && { status }),
      ...(customerName && { customerName }),
      ...(customerEmail !== undefined && { customerEmail }),
      ...(customerPhone !== undefined && { customerPhone }),
      ...(customerAddress !== undefined && { customerAddress }),
      ...(customerCity !== undefined && { customerCity }),
      ...(customerState !== undefined && { customerState }),
      ...(customerZip !== undefined && { customerZip }),
      ...(customerCountry !== undefined && { customerCountry }),
      ...(discountType !== undefined && { discountType }),
      ...(discountValue !== undefined && { discountValue }),
      ...(validUntil !== undefined && { validUntil: validUntil ? new Date(validUntil) : null }),
      ...(notes !== undefined && { notes }),
      ...otherUpdates,
    }

    // If quoteItems are provided, delete old items and create new ones
    if (quoteItems && Array.isArray(quoteItems)) {
      // Delete existing quote items
      await prisma.quoteItem.deleteMany({
        where: { quoteId: id },
      })

      // Calculate subtotal from new items
      const subtotal = quoteItems.reduce(
        (sum: number, item: { unitPrice: number; quantity: number }) => 
          sum + (item.unitPrice * item.quantity),
        0
      )

      // Calculate discount
      const finalDiscountType = discountType !== undefined ? discountType : null
      const finalDiscountValue = discountValue !== undefined ? discountValue : null
      let discountAmount = 0
      if (finalDiscountType && finalDiscountValue > 0) {
        if (finalDiscountType === 'percentage') {
          discountAmount = subtotal * (finalDiscountValue / 100)
        } else {
          discountAmount = finalDiscountValue
        }
      }

      // Calculate total
      const total = subtotal - discountAmount

      updateData.subtotal = subtotal
      updateData.discountAmount = discountAmount
      updateData.total = total

      // Create new quote items
      updateData.quoteItems = {
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
      }
    } else if (discountType !== undefined || discountValue !== undefined) {
      // If only discount changed, recalculate with existing items
      const existingQuote = await prisma.quote.findUnique({
        where: { id },
        include: { quoteItems: true },
      })

      if (existingQuote) {
        const subtotal = existingQuote.quoteItems.reduce(
          (sum, item) => sum + (item.unitPrice * item.quantity),
          0
        )

        const finalDiscountType = discountType !== undefined ? discountType : existingQuote.discountType
        const finalDiscountValue = discountValue !== undefined ? discountValue : existingQuote.discountValue
        let discountAmount = 0
        if (finalDiscountType && finalDiscountValue && finalDiscountValue > 0) {
          if (finalDiscountType === 'percentage') {
            discountAmount = subtotal * (finalDiscountValue / 100)
          } else {
            discountAmount = finalDiscountValue
          }
        }

        updateData.subtotal = subtotal
        updateData.discountAmount = discountAmount
        updateData.total = subtotal - discountAmount
      }
    }

    const quote = await prisma.quote.update({
      where: { id },
      data: updateData,
      include: {
        quoteItems: true,
      },
    })

    return NextResponse.json(quote)
  } catch (error) {
    console.error('Error updating quote:', error)
    return NextResponse.json(
      { error: 'Failed to update quote' },
      { status: 500 }
    )
  }
}

// DELETE /api/quotes/[id] - Delete a quote
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    await prisma.quote.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting quote:', error)
    return NextResponse.json(
      { error: 'Failed to delete quote' },
      { status: 500 }
    )
  }
}

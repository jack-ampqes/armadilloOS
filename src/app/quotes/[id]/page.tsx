'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Mail, Phone, MapPin, Calendar, FileText, Trash2, Send, Check, X, Download, Edit } from 'lucide-react'
import { Button } from '@/components/ui/button'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table'

interface QuoteItem {
  id: string
  productName: string
  sku: string | null
  quantity: number
  unitPrice: number
  totalPrice: number
}

interface Quote {
  id: string
  quoteNumber: string
  status: string
  customerName: string
  customerEmail: string | null
  customerPhone: string | null
  customerAddress: string | null
  customerCity: string | null
  customerState: string | null
  customerZip: string | null
  customerCountry: string | null
  subtotal: number
  discountType: string | null
  discountValue: number | null
  discountAmount: number
  total: number
  validUntil: string | null
  createdAt: string
  updatedAt: string
  notes: string | null
  quoteItems: QuoteItem[]
}

export default function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [quote, setQuote] = useState<Quote | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchQuote()
  }, [id])

  const fetchQuote = async () => {
    try {
      const response = await fetch(`/api/quotes/${id}`)
      if (response.ok) {
        const data = await response.json()
        setQuote(data)
      } else {
        setError('Quote not found')
      }
    } catch (error) {
      console.error('Error fetching quote:', error)
      setError('Failed to load quote')
    } finally {
      setLoading(false)
    }
  }

  const updateStatus = async (newStatus: string) => {
    if (!quote) return
    
    setUpdating(true)
    try {
      const response = await fetch(`/api/quotes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (response.ok) {
        const data = await response.json()
        setQuote(data)
      } else {
        alert('Failed to update status')
      }
    } catch (error) {
      console.error('Error updating quote:', error)
      alert('Failed to update status')
    } finally {
      setUpdating(false)
    }
  }

  const deleteQuote = async () => {
    if (!confirm('Are you sure you want to delete this quote?')) return
    
    try {
      const response = await fetch(`/api/quotes/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        router.push('/quotes')
      } else {
        alert('Failed to delete quote')
      }
    } catch (error) {
      console.error('Error deleting quote:', error)
      alert('Failed to delete quote')
    }
  }

  const getStatusVariant = (status: string): "default" | "secondary" | "outline" | "success" | "warning" | "destructive" => {
    switch (status) {
      case 'ACCEPTED':
        return 'success'
      case 'DRAFT':
        return 'default'
      case 'SENT':
        return 'warning'
      case 'REJECTED':
      case 'EXPIRED':
        return 'destructive'
      default:
        return 'secondary'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const isExpired = (validUntil: string | null) => {
    if (!validUntil) return false
    return new Date(validUntil) < new Date()
  }

  const getFullAddress = () => {
    if (!quote) return null
    const parts = [
      quote.customerAddress,
      quote.customerCity,
      quote.customerState,
      quote.customerZip,
      quote.customerCountry,
    ].filter(Boolean)
    return parts.length > 0 ? parts.join(', ') : null
  }

  const downloadPDF = () => {
    if (!quote) return

    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    
    // Colors
    const primaryColor: [number, number, number] = [30, 30, 30]
    const darkColor: [number, number, number] = [30, 30, 30]
    const grayColor: [number, number, number] = [100, 100, 100]
    
    // Header
    doc.setFillColor(...primaryColor)
    doc.rect(0, 0, pageWidth, 40, 'F')
    
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(24)
    doc.setFont('helvetica', 'bold')
    doc.addImage('/Armadillo_FullLogo_White.png', 'PNG', 10, 18, 50, 12)
    
    doc.setFontSize(12)
    doc.setFont('helvetica', 'normal')
    doc.text(quote.quoteNumber, pageWidth - 20, 20, { align: 'right' })
    doc.text(`Status: ${quote.status}`, pageWidth - 20, 28, { align: 'right' })
    
    // Company info
    let yPos = 55
    doc.setTextColor(...darkColor)
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text('Armadillo Safety Products', 20, yPos)
    
    // Quote details
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...grayColor)
    yPos += 10
    doc.text(`Date: ${formatDate(quote.createdAt)}`, 20, yPos)
    if (quote.validUntil) {
      yPos += 6
      doc.text(`Valid Until: ${formatDate(quote.validUntil)}`, 20, yPos)
    }
    
    // Ship From section
    yPos += 15
    doc.setTextColor(...darkColor)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('SHIP FROM:', 20, yPos)
    
    doc.setFont('helvetica', 'normal')
    yPos += 7
    doc.text('Jack Lyons', 20, yPos)
    yPos += 5
    doc.text('616 Church St NE', 20, yPos)
    yPos += 5
    doc.text('Decatur, AL 35601 USA', 20, yPos)
    
    // Customer info box
    yPos = 55
    doc.setTextColor(...darkColor)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('BILL TO:', pageWidth - 80, yPos)
    
    doc.setFont('helvetica', 'normal')
    yPos += 7
    doc.text(quote.customerName, pageWidth - 80, yPos)
    
    if (quote.customerEmail) {
      yPos += 5
      doc.setTextColor(...grayColor)
      doc.text(quote.customerEmail, pageWidth - 80, yPos)
    }
    if (quote.customerPhone) {
      yPos += 5
      doc.text(quote.customerPhone, pageWidth - 80, yPos)
    }
    if (getFullAddress()) {
      yPos += 5
      const addressLines = doc.splitTextToSize(getFullAddress()!, 60)
      doc.text(addressLines, pageWidth - 80, yPos)
    }
    
    // Items table
    const tableData = quote.quoteItems.map(item => [
      item.productName,
      item.sku || '-',
      item.quantity.toString(),
      `$${item.unitPrice.toFixed(2)}`,
      `$${item.totalPrice.toFixed(2)}`
    ])
    
    autoTable(doc, {
      startY: 100,
      head: [['Product', 'SKU', 'Qty', 'Unit Price', 'Total']],
      body: tableData,
      theme: 'striped',
      headStyles: {
        fillColor: primaryColor,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      columnStyles: {
        0: { cellWidth: 60 },
        1: { cellWidth: 35, font: 'courier' },
        2: { cellWidth: 20, halign: 'center' },
        3: { cellWidth: 30, halign: 'right' },
        4: { cellWidth: 30, halign: 'right' },
      },
      styles: {
        fontSize: 10,
        cellPadding: 5,
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245],
      },
    })
    
    // Get the final Y position after the table
    const finalY = (doc as any).lastAutoTable.finalY + 10
    
    // Totals section
    const totalsX = pageWidth - 70
    let totalsY = finalY
    
    doc.setFontSize(10)
    doc.setTextColor(...grayColor)
    doc.text('Subtotal:', totalsX, totalsY)
    doc.setTextColor(...darkColor)
    doc.text(`$${quote.subtotal.toFixed(2)}`, pageWidth - 20, totalsY, { align: 'right' })
    
    if (quote.discountAmount > 0) {
      totalsY += 7
      doc.setTextColor(34, 139, 34) // Green for discount
      const discountLabel = quote.discountType === 'percentage' 
        ? `Discount (${quote.discountValue}%):` 
        : 'Discount:'
      doc.text(discountLabel, totalsX, totalsY)
      doc.text(`-$${quote.discountAmount.toFixed(2)}`, pageWidth - 20, totalsY, { align: 'right' })
    }
    
    totalsY += 10
    doc.setDrawColor(...primaryColor)
    doc.setLineWidth(0.5)
    doc.line(totalsX - 10, totalsY - 3, pageWidth - 15, totalsY - 3)
    
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...darkColor)
    doc.text('Total:', totalsX, totalsY + 5)
    doc.setTextColor(...primaryColor)
    doc.text(`$${quote.total.toFixed(2)}`, pageWidth - 20, totalsY + 5, { align: 'right' })
    
    // Notes section
    if (quote.notes) {
      const notesY = totalsY + 25
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...darkColor)
      doc.text('Notes:', 20, notesY)
      
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...grayColor)
      const noteLines = doc.splitTextToSize(quote.notes, pageWidth - 40)
      doc.text(noteLines, 20, notesY + 7)
    }
    
    // Footer
    const footerY = doc.internal.pageSize.getHeight() - 20
    doc.setFontSize(9)
    doc.setTextColor(...grayColor)
    doc.text('Thank you for your business!', pageWidth / 2, footerY, { align: 'center' })
    doc.text('Armadillo Safety', pageWidth / 2, footerY + 5, { align: 'center' })
    
    // Save the PDF
    doc.save(`${quote.quoteNumber}.pdf`)
  }

  if (loading) {
    return (
      <div className="space-y-8 max-w-5xl">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (error || !quote) {
    return (
      <div className="space-y-8 max-w-5xl">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="text-white/60 hover:text-white"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Quotes
        </Button>
        <Card className="border-red-500/50 bg-red-500/10">
          <CardContent className="p-6 text-center">
            <p className="text-red-400 font-medium">{error || 'Quote not found'}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <Button
            variant="ghost"
            onClick={() => router.back()}
            className="mb-4 text-white/60 hover:text-white -ml-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Quotes
          </Button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">{quote.quoteNumber}</h1>
            <Badge variant={getStatusVariant(quote.status)}>
              {quote.status}
            </Badge>
            {quote.validUntil && isExpired(quote.validUntil) && quote.status !== 'EXPIRED' && (
              <Badge variant="destructive">Expired</Badge>
            )}
          </div>
          <p className="text-white/60 mt-1">
            Created on {formatDate(quote.createdAt)}
          </p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => router.push(`/quotes/${id}/edit`)}
            className="gap-2"
          >
            <Edit className="h-4 w-4" />
            Edit
          </Button>
          <Button
            variant="outline"
            onClick={downloadPDF}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Download PDF
          </Button>
          {quote.status === 'DRAFT' && (
            <Button
              variant="outline"
              onClick={() => updateStatus('SENT')}
              disabled={updating}
              className="gap-2"
            >
              <Send className="h-4 w-4" />
              Mark as Sent
            </Button>
          )}
          {quote.status === 'SENT' && (
            <>
              <Button
                variant="outline"
                onClick={() => updateStatus('ACCEPTED')}
                disabled={updating}
                className="gap-2 border-green-500/50 text-green-400 hover:bg-green-500/10"
              >
                <Check className="h-4 w-4" />
                Accept
              </Button>
              <Button
                variant="outline"
                onClick={() => updateStatus('REJECTED')}
                disabled={updating}
                className="gap-2 border-red-500/50 text-red-400 hover:bg-red-500/10"
              >
                <X className="h-4 w-4" />
                Reject
              </Button>
            </>
          )}
          <Button
            variant="outline"
            onClick={deleteQuote}
            className="gap-2 text-red-400 hover:bg-red-500/10"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      {/* Customer Info */}
      <Card>
        <CardHeader>
          <CardTitle>Customer Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-semibold text-white">{quote.customerName}</h3>
              <div className="mt-3 space-y-2">
                {quote.customerEmail && (
                  <div className="flex items-center gap-2 text-white/70">
                    <Mail className="h-4 w-4" />
                    <a href={`mailto:${quote.customerEmail}`} className="hover:text-white">
                      {quote.customerEmail}
                    </a>
                  </div>
                )}
                {quote.customerPhone && (
                  <div className="flex items-center gap-2 text-white/70">
                    <Phone className="h-4 w-4" />
                    <a href={`tel:${quote.customerPhone}`} className="hover:text-white">
                      {quote.customerPhone}
                    </a>
                  </div>
                )}
                {getFullAddress() && (
                  <div className="flex items-center gap-2 text-white/70">
                    <MapPin className="h-4 w-4 flex-shrink-0" />
                    <span>{getFullAddress()}</span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-white/70">
                <Calendar className="h-4 w-4" />
                <span>Created: {formatDate(quote.createdAt)}</span>
              </div>
              {quote.validUntil && (
                <div className={`flex items-center gap-2 ${isExpired(quote.validUntil) ? 'text-red-400' : 'text-white/70'}`}>
                  <Calendar className="h-4 w-4" />
                  <span>Valid until: {formatDate(quote.validUntil)}</span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quote Items */}
      <Card>
        <CardHeader>
          <CardTitle>Quote Items</CardTitle>
          <CardDescription>{quote.quoteItems.length} item{quote.quoteItems.length !== 1 ? 's' : ''}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quote.quoteItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.productName}</TableCell>
                  <TableCell className="font-mono text-white/60">{item.sku || '-'}</TableCell>
                  <TableCell className="text-right">${item.unitPrice.toFixed(2)}</TableCell>
                  <TableCell className="text-right">{item.quantity}</TableCell>
                  <TableCell className="text-right font-medium">${item.totalPrice.toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={4} className="text-right text-white/60">Subtotal</TableCell>
                <TableCell className="text-right">${quote.subtotal.toFixed(2)}</TableCell>
              </TableRow>
              {quote.discountAmount > 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-right text-green-400">
                    Discount ({quote.discountType === 'percentage' ? `${quote.discountValue}%` : 'Fixed'})
                  </TableCell>
                  <TableCell className="text-right text-green-400">-${quote.discountAmount.toFixed(2)}</TableCell>
                </TableRow>
              )}
              <TableRow>
                <TableCell colSpan={4} className="text-right font-bold text-lg">Total</TableCell>
                <TableCell className="text-right font-bold text-lg">${quote.total.toFixed(2)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>

      {/* Notes */}
      {quote.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-white/80 whitespace-pre-wrap">{quote.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

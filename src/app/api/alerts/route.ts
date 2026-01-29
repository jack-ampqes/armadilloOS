import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { runAllAlertChecks } from '@/lib/alerts'

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const resolved = searchParams.get('resolved')
    const type = searchParams.get('type')
    const severity = searchParams.get('severity')
    const limit = parseInt(searchParams.get('limit') || '50')

    const where: any = {}
    
    if (resolved === 'false' || resolved === null) {
      where.resolved = false
    } else if (resolved === 'true') {
      where.resolved = true
    }

    if (type) {
      where.type = type
    }

    if (severity) {
      where.severity = severity
    }

    const alerts = await prisma.alert.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    })

    return NextResponse.json(alerts)
  } catch (error) {
    console.error('Error fetching alerts:', error)
    // Return empty array so nav/layout don't break when DB is unavailable (e.g. production without DATABASE_URL)
    return NextResponse.json([])
  }
}

export async function POST(request: NextRequest) {
  try {
    // Run alert checks
    await runAllAlertChecks()
    
    return NextResponse.json({ success: true, message: 'Alert checks completed' })
  } catch (error) {
    console.error('Error running alert checks:', error)
    return NextResponse.json(
      { error: 'Failed to run alert checks' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, read, resolved } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Alert ID is required' },
        { status: 400 }
      )
    }

    const updateData: any = {}
    if (read !== undefined) {
      updateData.read = read
    }
    if (resolved !== undefined) {
      updateData.resolved = resolved
      if (resolved) {
        updateData.resolvedAt = new Date()
      } else {
        updateData.resolvedAt = null
      }
    }

    const alert = await prisma.alert.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json(alert)
  } catch (error) {
    console.error('Error updating alert:', error)
    return NextResponse.json(
      { error: 'Failed to update alert' },
      { status: 500 }
    )
  }
}

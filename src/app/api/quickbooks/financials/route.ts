import { NextRequest, NextResponse } from 'next/server'
import { getDefaultQuickBooksCredentials } from '@/lib/quickbooks-connection'
import { getProfitAndLoss, parseProfitAndLoss } from '@/lib/quickbooks'

export const runtime = 'nodejs'

type FinancialPeriod = 'thisMonth' | 'last3Months' | 'last6Months' | 'ytd' | 'lastYear' | 'allTime'

function getDateRange(period: FinancialPeriod): { startDate: string; endDate: string; label: string } {
  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]
  
  switch (period) {
    case 'thisMonth': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      return { startDate: start.toISOString().split('T')[0], endDate: todayStr, label: 'This Month' }
    }
    case 'last3Months': {
      const start = new Date(now.getFullYear(), now.getMonth() - 2, 1)
      return { startDate: start.toISOString().split('T')[0], endDate: todayStr, label: 'Last 3 Months' }
    }
    case 'last6Months': {
      const start = new Date(now.getFullYear(), now.getMonth() - 5, 1)
      return { startDate: start.toISOString().split('T')[0], endDate: todayStr, label: 'Last 6 Months' }
    }
    case 'ytd': {
      const start = new Date(now.getFullYear(), 0, 1)
      return { startDate: start.toISOString().split('T')[0], endDate: todayStr, label: 'Year to Date' }
    }
    case 'lastYear': {
      const start = new Date(now.getFullYear() - 1, 0, 1)
      const end = new Date(now.getFullYear() - 1, 11, 31)
      return { startDate: start.toISOString().split('T')[0], endDate: end.toISOString().split('T')[0], label: 'Last Year' }
    }
    case 'allTime':
    default: {
      // Don't pass dates to get all-time data
      return { startDate: '', endDate: todayStr, label: 'All Time' }
    }
  }
}

export async function GET(request: NextRequest) {
  const period = (request.nextUrl.searchParams.get('period') || 'thisMonth') as FinancialPeriod
  
  try {
    const creds = await getDefaultQuickBooksCredentials()
    const { startDate, endDate, label } = getDateRange(period)
    
    const plReport = await getProfitAndLoss(
      creds,
      startDate || undefined,
      endDate
    )
    const parsed = parseProfitAndLoss(plReport)
    
    return NextResponse.json({
      ok: true,
      period,
      label,
      startDate: startDate || null,
      endDate,
      ...parsed,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to fetch financials'
    return NextResponse.json(
      { ok: false, error: message },
      { status: message.includes('not configured') || message.includes('Reconnect') ? 401 : 502 }
    )
  }
}

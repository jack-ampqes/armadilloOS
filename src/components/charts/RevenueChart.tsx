'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface RevenueChartProps {
  data: Array<{
    date: string
    revenue: number
    orders?: number
  }>
  period?: 'daily' | 'weekly' | 'monthly'
}

export function RevenueChart({ data, period = 'daily' }: RevenueChartProps) {
  const formatDate = (date: string) => {
    const d = new Date(date)
    switch (period) {
      case 'daily':
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      case 'weekly':
        const weekNum = Math.ceil(d.getDate() / 7)
        return `Week ${weekNum}`
      case 'monthly':
        return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      default:
        return date
    }
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
        <XAxis 
          dataKey="date" 
          tickFormatter={formatDate}
          stroke="#ffffff60"
          style={{ fontSize: '12px' }}
        />
        <YAxis 
          tickFormatter={(value) => `$${value.toLocaleString()}`}
          stroke="#ffffff60"
          style={{ fontSize: '12px' }}
        />
        <Tooltip 
          contentStyle={{ 
            backgroundColor: '#181818', 
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '8px',
            color: '#ffffff'
          }}
          formatter={(value: number) => [`$${value.toLocaleString()}`, 'Revenue']}
          labelFormatter={(label) => `Date: ${formatDate(label)}`}
        />
        <Legend 
          wrapperStyle={{ color: '#ffffff80' }}
        />
        <Line 
          type="monotone" 
          dataKey="revenue" 
          stroke="#808080" 
          strokeWidth={2}
          dot={{ fill: '#808080', r: 4 }}
          name="Revenue"
        />
        {data[0]?.orders !== undefined && (
          <Line 
            type="monotone" 
            dataKey="orders" 
            stroke="#10b981" 
            strokeWidth={2}
            dot={{ fill: '#10b981', r: 4 }}
            name="Orders"
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  )
}

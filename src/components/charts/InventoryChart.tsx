'use client'

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface InventoryChartProps {
  data: Array<{
    date: string
    value: number
    quantity?: number
  }>
  period?: 'daily' | 'weekly' | 'monthly'
}

export function InventoryChart({ data, period = 'daily' }: InventoryChartProps) {
  const formatDate = (date: string) => {
    const d = new Date(date)
    switch (period) {
      case 'daily':
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      case 'weekly':
        return `Week ${Math.ceil(d.getDate() / 7)}`
      case 'monthly':
        return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      default:
        return date
    }
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <defs>
          <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#808080" stopOpacity={0.8}/>
            <stop offset="95%" stopColor="#808080" stopOpacity={0}/>
          </linearGradient>
        </defs>
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
          formatter={(value: number) => [`$${value.toLocaleString()}`, 'Inventory Value']}
          labelFormatter={(label) => `Date: ${formatDate(label)}`}
        />
        <Legend 
          wrapperStyle={{ color: '#ffffff80' }}
        />
        <Area 
          type="monotone" 
          dataKey="value" 
          stroke="#808080" 
          fillOpacity={1}
          fill="url(#colorValue)"
          name="Inventory Value"
        />
        {data[0]?.quantity !== undefined && (
          <Area 
            type="monotone" 
            dataKey="quantity" 
            stroke="#10b981" 
            fill="#10b981"
            fillOpacity={0.3}
            name="Total Quantity"
          />
        )}
      </AreaChart>
    </ResponsiveContainer>
  )
}

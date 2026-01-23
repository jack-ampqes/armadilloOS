'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'

interface StatusPieChartProps {
  data: Array<{
    name: string
    value: number
  }>
  colors?: string[]
}

// Custom tooltip component to ensure readable text
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div 
        style={{
          backgroundColor: '#181818',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '8px',
          padding: '8px 12px',
        }}
      >
        <p style={{ color: '#ffffff', margin: 0, fontSize: '14px' }}>
          {payload[0].name}: <span style={{ fontWeight: 'bold' }}>{payload[0].value}</span>
        </p>
      </div>
    )
  }
  return null
}

const DEFAULT_COLORS = ['#808080', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

// Status-specific color mapping
const STATUS_COLORS: Record<string, string> = {
  'partial': '#F0C42D', // Yellow from orders page warning badge
  'fulfilled': '#10b981',
  'unfulfilled': '#ef4444',
}

export function StatusPieChart({ data, colors = DEFAULT_COLORS }: StatusPieChartProps) {
  const getColorForStatus = (statusName: string, index: number): string => {
    // Check if there's a specific color for this status
    const normalizedStatus = statusName.toLowerCase()
    if (STATUS_COLORS[normalizedStatus]) {
      return STATUS_COLORS[normalizedStatus]
    }
    // Fall back to default color array
    return colors[index % colors.length]
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
          outerRadius={100}
          fill="#8884d8"
          dataKey="value"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={getColorForStatus(entry.name, index)} />
          ))}
        </Pie>
        <Tooltip 
          content={<CustomTooltip />}
          contentStyle={{ 
            backgroundColor: '#181818', 
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '8px',
          }}
          itemStyle={{ color: '#ffffff' }}
          labelStyle={{ color: '#ffffff' }}
        />
        <Legend 
          wrapperStyle={{ color: '#ffffff80' }}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}

'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface SalesBarChartProps {
  data: Array<{
    name: string
    value: number
    count?: number
  }>
  dataKey?: string
  name?: string
  color?: string
}

export function SalesBarChart({ 
  data, 
  dataKey = 'value', 
  name = 'Sales',
  color = '#808080' 
}: SalesBarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
        <XAxis 
          dataKey="name" 
          stroke="#ffffff60"
          style={{ fontSize: '12px' }}
          angle={-45}
          textAnchor="end"
          height={80}
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
          formatter={(value: number) => [`$${value.toLocaleString()}`, name]}
        />
        <Legend 
          wrapperStyle={{ color: '#ffffff80' }}
        />
        <Bar 
          dataKey={dataKey} 
          fill={color}
          radius={[4, 4, 0, 0]}
          name={name}
        />
        {data[0]?.count !== undefined && (
          <Bar 
            dataKey="count" 
            fill="#10b981"
            radius={[4, 4, 0, 0]}
            name="Count"
          />
        )}
      </BarChart>
    </ResponsiveContainer>
  )
}

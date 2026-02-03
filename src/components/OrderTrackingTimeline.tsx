'use client'

import { ClipboardCheck, Package, Truck, Home, Check } from 'lucide-react'

type OrderStatus = 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled'

const STAGES: { key: OrderStatus; label: string; icon: typeof ClipboardCheck }[] = [
  { key: 'confirmed', label: 'Order Confirmed', icon: ClipboardCheck },
  { key: 'shipped', label: 'Order Shipped', icon: Package },
  { key: 'shipped', label: 'Out for Delivery', icon: Truck },
  { key: 'delivered', label: 'Order Delivered', icon: Home },
]

function isStageComplete(status: OrderStatus, stageIndex: number): boolean {
  if (status === 'cancelled') return false
  switch (stageIndex) {
    case 0: return ['confirmed', 'shipped', 'delivered'].includes(status)
    case 1: return ['shipped', 'delivered'].includes(status)
    case 2: return ['shipped', 'delivered'].includes(status)
    case 3: return status === 'delivered'
    default: return false
  }
}

interface OrderTrackingTimelineProps {
  status: OrderStatus | string | undefined
  className?: string
}

export function OrderTrackingTimeline({ status: rawStatus, className = '' }: OrderTrackingTimelineProps) {
  const status = (typeof rawStatus === 'string' ? rawStatus.toLowerCase() : 'pending') as OrderStatus
  const validStatus: OrderStatus[] = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled']
  const normalizedStatus = validStatus.includes(status) ? status : 'pending'

  return (
    <div className={`w-full min-w-[60em] flex items-stretch gap-0 py-5 px-1 ${className}`}>
      {STAGES.map((stage, i) => {
        const completed = isStageComplete(normalizedStatus, i)
        const isLast = i === STAGES.length - 1
        const Icon = stage.icon

        return (
          <div key={i} className="flex flex-1 flex-col items-center min-w-[100px]">
            {/* Node and connecting line */}
            <div className="flex items-center w-full">
              <div
                className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center border-2 transition-colors ${
                  completed
                    ? 'bg-emerald-500 border-emerald-500 text-white'
                    : 'bg-transparent border-white/30 text-white/40'
                }`}
              >
                {completed ? (
                  <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                ) : (
                  <Icon className="h-3.5 w-3.5" />
                )}
              </div>
              {!isLast && (
                <div
                  className={`flex-1 h-0.5 mx-3 min-w-[48px] transition-colors ${
                    completed ? 'bg-emerald-500' : 'bg-white/20'
                  }`}
                />
              )}
            </div>
            {/* Label */}
            <div className="mt-3 flex flex-col items-center">
              <Icon className={`h-4 w-4 mb-1 ${completed ? 'text-emerald-400' : 'text-white/40'}`} />
              <p className={`text-xs font-medium leading-tight text-center ${completed ? 'text-white/90' : 'text-white/50'}`}>
                {stage.label}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

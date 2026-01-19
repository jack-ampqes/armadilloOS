import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-lg px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "bg-white text-[#181818] shadow hover:bg-white/80",
        secondary:
          "border-white/20 bg-white/10 text-white",
        destructive:
          "bg-red-600 text-white shadow hover:bg-red-500",
        outline: "bg-white text-[#181818] border border-white/20",
        success: "bg-green-600 text-white shadow hover:bg-green-500",
        warning: "bg-yellow-600 text-black shadow hover:bg-yellow-500",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }

'use client'

import { usePathname } from 'next/navigation'

export default function ConditionalMain({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  
  // No padding on login and signup pages
  if (pathname === '/login' || pathname === '/signup') {
    return <>{children}</>
  }
  
  return (
    <main className="lg:ml-[280px] pt-24 lg:pt-8 p-8">
      {children}
    </main>
  )
}

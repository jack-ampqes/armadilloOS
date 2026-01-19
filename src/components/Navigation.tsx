'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import Image from 'next/image'
import { 
  Home, 
  ShoppingCart, 
  CirclePile, 
  Handshake, 
  Tags, 
  Warehouse,
  Menu,
  QrCode,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useState } from 'react'

const navigation = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'Orders', href: '/orders', icon: ShoppingCart },
  { name: 'Inventory', href: '/inventory', icon: CirclePile },
  { name: 'Codes', href: '/inventory/codes', icon: QrCode },
  { name: 'Customers', href: '/customers', icon: Handshake },
  { name: 'Sales Reps', href: '/sales-reps', icon: Tags },
  { name: 'Distributors', href: '/distributors', icon: Warehouse },
]

export default function Navigation() {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <>
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-[#181818] border-b border-white/20 px-4 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 relative">
            <Image 
              src="/armadillo-logo.png" 
              alt="Armadillo Logo" 
              fill
              className="object-contain"
              style={{ filter: 'brightness(0) invert(1)' }}
            />
          </div>
          <h1 className="text-lg font-bold text-white">Armadillo Safety</h1>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          <Menu className="w-6 h-6 text-white" />
        </Button>
      </div>

      {/* Sidebar */}
      <aside className="fixed left-0 top-0 bottom-0 z-40 bg-[#181818] border-r border-white/20 pt-6 w-[280px] hidden lg:block">
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="px-6 mb-8 flex items-center">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 relative flex-shrink-0">
                <Image 
                  src="/armadillo-logo.png" 
                  alt="Armadillo Logo" 
                  fill
                  className="object-contain"
                  style={{ filter: 'brightness(0) invert(1)' }}
                />
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-5">
            {navigation.map((item, index) => {
              const isActive = pathname === item.href
              const Icon = item.icon
              return (
                <Link key={item.name} href={item.href} className="block mb-4">
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={cn(
                      'relative flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200',
                      isActive
                        ? 'border border-white text-white'
                        : 'text-white/70 hover:bg-white/10'
                    )}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    <span>{item.name}</span>
                  </motion.div>
                </Link>
              )
            })}
          </nav>

          {/* Footer */}
          <div className="p-6 border-t border-white/20">
            <div className="text-xs text-white/60 text-center">
              © 2026 Armadillo Safety
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Sidebar */}
      {mobileMenuOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="lg:hidden fixed inset-0 bg-[#181818] bg-opacity-50 z-30"
            onClick={() => setMobileMenuOpen(false)}
          />
          <motion.aside
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            transition={{ duration: 0.3 }}
            className="lg:hidden fixed left-0 top-0 bottom-0 z-40 bg-[#181818] border-r border-white/20 pt-20 w-[280px]"
          >
            <div className="flex flex-col h-full">
              {/* Navigation */}
              <nav className="flex-1 px-4 space-y-2">
                {navigation.map((item, index) => {
                  const isActive = pathname === item.href
                  const Icon = item.icon
                  return (
                    <Link key={item.name} href={item.href} onClick={() => setMobileMenuOpen(false)}>
                      <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className={cn(
                          'relative flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200',
                          isActive
                            ? 'bg-white text-black'
                            : 'text-white/70 hover:bg-white/10'
                        )}
                      >
                        <Icon className="w-5 h-5 flex-shrink-0" />
                        <span>{item.name}</span>
                      </motion.div>
                    </Link>
                  )
                })}
              </nav>

              {/* Footer */}
              <div className="p-6 border-t border-white/20">
                <div className="text-xs text-white/60 text-center">
                  © 2026 Armadillo Safety
                </div>
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </>
  )
}

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import {
  Home,
  CreditCard,
  TrendingUp,
  Settings,
  Menu,
  PieChart,
  Receipt,
  Target,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const sidebarItems = [
  {
    title: 'Inicio',
    href: '/dashboard',
    icon: Home,
  },
  {
    title: 'Transacciones',
    href: '/dashboard/transactions',
    icon: Receipt,
  },
  {
    title: 'Presupuesto',
    href: '/dashboard/budget',
    icon: Target,
  },
  {
    title: 'Análisis',
    href: '/dashboard/analytics',
    icon: PieChart,
  },
  {
    title: 'Tarjetas',
    href: '/dashboard/cards',
    icon: CreditCard,
  },
  {
    title: 'Tendencias',
    href: '/dashboard/trends',
    icon: TrendingUp,
  },
  {
    title: 'Configuración',
    href: '/dashboard/settings',
    icon: Settings,
  },
]

interface SidebarProps {
  className?: string
  isCollapsed?: boolean
  onToggleCollapse?: () => void
}

export function Sidebar({ className, isCollapsed = false, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname()

  return (
    <div className={cn('pb-12 h-full', className)}>
      <div className="space-y-4 py-4">
        <div className="px-3 py-2">
          <div className="flex items-center justify-end mb-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleCollapse}
              className="h-8 w-8 p-0 cursor-pointer"
            >
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </Button>
          </div>
          <div className="space-y-1">
            {sidebarItems.map((item) => (
              <Link key={item.href} href={item.href}>
                <Button
                  variant={pathname === item.href ? 'secondary' : 'ghost'}
                  className={cn(
                    'w-full justify-start cursor-pointer',
                    isCollapsed ? 'px-2' : 'justify-start'
                  )}
                  title={isCollapsed ? item.title : undefined}
                >
                  <item.icon className="h-4 w-4" />
                  {!isCollapsed && (
                    <span className="ml-2">{item.title}</span>
                  )}
                </Button>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export function MobileSidebar() {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          className="mr-2 px-0 text-base hover:bg-transparent focus-visible:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 md:hidden cursor-pointer"
        >
          <Menu className="h-6 w-6" />
          <span className="sr-only">Toggle Menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="pr-0">
        <Sidebar />
      </SheetContent>
    </Sheet>
  )
}

'use client'

import { useState, useEffect } from 'react'
import {
  Building2,
  Home,
  Users,
  DollarSign,
  FileText,
  Loader2,
  Menu,
  X
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'

import { useProperty } from '@/contexts/PropertyContext'
import { supabase } from '@/lib/supabase'

interface SidebarSection {
  title: string
  icon: React.ComponentType<{ className?: string }>
  items: Array<{
    id: number | string
    name: string
    subtitle?: string
    status?: string
    type?: string
  }>
}

interface DynamicSidebarProps {
  onCreateUnit?: () => void
  onCreateResident?: () => void
  onCreateExpense?: () => void
  onCreateContract?: () => void
  onTabChange?: (tab: 'units' | 'residents' | 'expenses' | 'contracts') => void
  activeTab?: 'units' | 'residents' | 'expenses' | 'contracts'
}

export function DynamicSidebar({
  onCreateUnit,
  onCreateResident,
  onCreateExpense,
  onCreateContract,
  onTabChange,
  activeTab = 'units'
}: DynamicSidebarProps) {
  const { selectedProperty, selectedPropertyId } = useProperty()
  const [sections, setSections] = useState<SidebarSection[]>([])
  const [loading, setLoading] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)

  useEffect(() => {
    if (selectedPropertyId) {
      fetchPropertyData()
    } else {
      setSections([])
    }
  }, [selectedPropertyId])

  const fetchPropertyData = async () => {
    if (!selectedPropertyId) return

    setLoading(true)
    try {
      const [unitsRes, residentsRes, expensesRes, contractsRes] = await Promise.all([
        supabase
          .from('units')
          .select('*, residents(name, email)')
          .eq('property_id', selectedPropertyId)
          .order('unit_number'),
        supabase
          .from('residents')
          .select('*, units(unit_number)')
          .eq('property_id', selectedPropertyId)
          .order('name'),
        supabase
          .from('expenses')
          .select('*')
          .eq('property_id', selectedPropertyId)
          .order('date', { ascending: false })
          .limit(10),
        supabase
          .from('contracts')
          .select(`
            *,
            unit:units(unit_number),
            tenant:residents(name)
          `)
          .eq('unit.property_id', selectedPropertyId)
          .order('created_at', { ascending: false })
          .limit(10)
      ])

      const newSections: SidebarSection[] = [
        {
          title: 'Unidades',
          icon: Home,
          items: (unitsRes.data || []).map(unit => ({
            id: unit.id,
            name: unit.unit_number,
            subtitle: unit.residents?.length ? `${unit.residents.length} residente(s)` : 'Vacante',
            status: unit.status,
            type: 'unit'
          })),
        },
        {
          title: 'Residentes',
          icon: Users,
          items: (residentsRes.data || []).map(resident => ({
            id: resident.id,
            name: resident.name,
            subtitle: `Unidad ${resident.units?.unit_number || 'Desconocida'}`,
            status: resident.role,
            type: 'resident'
          })),
        },
        {
          title: 'Gastos',
          icon: DollarSign,
          items: (expensesRes.data || []).map(expense => ({
            id: expense.id,
            name: expense.expense_type,
            subtitle: `$${expense.amount.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`,
            status: 'expense',
            type: 'expense'
          })),
        },
        {
          title: 'Contratos',
          icon: FileText,
          items: (contractsRes.data && contractsRes.data.length > 0)
            ? contractsRes.data.map(contract => ({
                id: contract.id,
                name: `${contract.tenant?.name || 'Sin Inquilino'} - Unidad ${contract.unit?.unit_number || 'N/A'}`,
                subtitle: `$${contract.initial_rent_amount.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`,
                status: contract.status,
                type: 'contract'
              }))
            : [{
                id: 'no-contracts',
                name: 'No hay contratos',
                subtitle: 'Crea tu primer contrato',
                status: 'none',
                type: 'contract'
              }],
        }
      ]

      setSections(newSections)
    } catch (error) {
      console.error('Error fetching property data:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed)
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active':
      case 'paid':
      case 'pagado':
      case 'owner':
        return 'default'
      case 'overdue':
      case 'expired':
      case 'vencido':
        return 'destructive'
      case 'pending':
      case 'vacant':
      case 'pendiente':
      case 'vacante':
      case 'tenant':
        return 'secondary'
      default:
        return 'outline'
    }
  }

  if (!selectedProperty) {
    return (
      <div className="w-80 border-r bg-muted/10 p-6">
        <div className="flex items-center justify-center h-full text-center">
          <div>
            <Building2 className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground">
              Selecciona una propiedad
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`${isCollapsed ? 'w-16' : 'w-80'} border-r bg-background transition-all duration-300 ease-in-out h-full`}>
      <div className="p-4 border-b">
        <div className="flex items-center justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleSidebar}
            className="h-8 w-8 p-0 flex-shrink-0"
          >
            {isCollapsed ? (
              <Menu className="h-4 w-4" />
            ) : (
              <X className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {!isCollapsed && (
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4 pb-6">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="ml-2">Cargando...</span>
              </div>
            ) : (
              sections.map((section) => (
                <div key={section.title} className="space-y-2">
                  <div
                    className={`flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors hover:bg-muted/50 ${
                      (section.title === 'Unidades' && activeTab === 'units') ||
                      (section.title === 'Residentes' && activeTab === 'residents') ||
                      (section.title === 'Gastos' && activeTab === 'expenses') ||
                      (section.title === 'Contratos' && activeTab === 'contracts')
                        ? 'bg-muted font-medium'
                        : ''
                    }`}
                    onClick={() => {
                      if (section.title === 'Unidades' && onTabChange) {
                        onTabChange('units')
                      } else if (section.title === 'Residentes' && onTabChange) {
                        onTabChange('residents')
                      } else if (section.title === 'Gastos' && onTabChange) {
                        onTabChange('expenses')
                      } else if (section.title === 'Contratos' && onTabChange) {
                        onTabChange('contracts')
                      }
                    }}
                  >
                    <section.icon className="h-4 w-4" />
                    <span className="font-medium">{section.title}</span>
                    <Badge variant="secondary" className="ml-auto">
                      {section.items.length}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      )}

      {isCollapsed && (
        <div className="flex-1 flex flex-col items-center py-4 space-y-2 pb-6">
          {sections.map((section) => (
            <div
              key={section.title}
              className={`w-12 h-12 flex items-center justify-center cursor-pointer rounded-md transition-colors hover:bg-muted/50 ${
                (section.title === 'Unidades' && activeTab === 'units') ||
                (section.title === 'Residentes' && activeTab === 'residents') ||
                (section.title === 'Gastos' && activeTab === 'expenses') ||
                (section.title === 'Contratos' && activeTab === 'contracts')
                  ? 'bg-muted'
                  : ''
              }`}
              title={section.title}
              onClick={() => {
                if (section.title === 'Unidades' && onTabChange) {
                  onTabChange('units')
                } else if (section.title === 'Residentes' && onTabChange) {
                  onTabChange('residents')
                } else if (section.title === 'Gastos' && onTabChange) {
                  onTabChange('expenses')
                } else if (section.title === 'Contratos' && onTabChange) {
                  onTabChange('contracts')
                }
              }}
            >
              <section.icon className="h-5 w-5" />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

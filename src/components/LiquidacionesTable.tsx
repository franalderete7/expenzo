'use client'

import { useState, useEffect } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Calculator, DollarSign, Building, User } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useProperty } from '@/contexts/PropertyContext'

interface LiquidacionItem {
  unit_id: number
  unit_number: string
  resident_name?: string
  resident_email?: string
  role?: 'owner' | 'tenant'
  expense_due?: number
  rent_due?: number
  allocation_id?: number
  expense_percentage?: number
}

export function LiquidacionesTable() {
  const { selectedProperty } = useProperty()
  const [data, setData] = useState<LiquidacionItem[]>([])
  const [loading, setLoading] = useState(false)
  const [calculating, setCalculating] = useState(false)
  const [openExpenseReceipt, setOpenExpenseReceipt] = useState<number | null>(null)
  const [openRentReceipt, setOpenRentReceipt] = useState<number | null>(null)

  // Filters
  const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString())
  const [filterMonth, setFilterMonth] = useState((new Date().getMonth() + 1).toString())

  const fetchLiquidaciones = async () => {
    if (!selectedProperty) return

    try {
      setLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        toast.error('No active session')
        return
      }

      const response = await fetch(
        `/api/liquidaciones?property_id=${selectedProperty.id}&year=${filterYear}&month=${filterMonth}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          }
        }
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Error fetching liquidaciones')
      }

      const result = await response.json()
      setData(result.data || [])
    } catch (error) {
      console.error('Error fetching liquidaciones:', error)
      toast.error(error instanceof Error ? error.message : 'Error fetching liquidaciones')
    } finally {
      setLoading(false)
    }
  }

  const handleCalculate = async () => {
    if (!selectedProperty) {
      toast.error('Selecciona una propiedad')
      return
    }

    try {
      setCalculating(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        toast.error('No active session')
        return
      }

      const response = await fetch('/api/liquidaciones/calculate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          property_id: selectedProperty.id,
          year: parseInt(filterYear),
          month: parseInt(filterMonth)
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Error calculando liquidaciones')
      }

      toast.success('Liquidaciones calculadas exitosamente')
      fetchLiquidaciones() // Refresh data
    } catch (error) {
      console.error('Error calculating liquidaciones:', error)
      toast.error(error instanceof Error ? error.message : 'Error calculando liquidaciones')
    } finally {
      setCalculating(false)
    }
  }

  const getRoleLabel = (role?: string) => {
    switch (role) {
      case 'owner':
        return 'Propietario'
      case 'tenant':
        return 'Inquilino'
      default:
        return '-'
    }
  }

  const getRoleBadgeVariant = (role?: string) => {
    switch (role) {
      case 'owner':
        return 'secondary'
      case 'tenant':
        return 'default'
      default:
        return 'outline'
    }
  }

  useEffect(() => {
    if (selectedProperty) {
      fetchLiquidaciones()
    }
  }, [selectedProperty, filterYear, filterMonth])

  if (!selectedProperty) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Selecciona una propiedad para ver las liquidaciones.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Liquidaciones</h2>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={async () => {
              try {
                const { data: { session } } = await supabase.auth.getSession()
                if (!session || !selectedProperty) return
                const res = await fetch('/api/liquidaciones/send-receipts', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                  },
                  body: JSON.stringify({
                    property_id: selectedProperty.id,
                    year: parseInt(filterYear),
                    month: parseInt(filterMonth)
                  })
                })
                if (!res.ok) {
                  const j = await res.json()
                  throw new Error(j.error || 'Error enviando recibos')
                }
                toast.success('Recibos enviados por email')
              } catch (e) {
                toast.error((e as Error).message)
              }
            }}
          >
            Enviar recibos por email
          </Button>
          <Button
            onClick={handleCalculate}
            disabled={calculating}
            className="flex items-center gap-2"
          >
            <Calculator className="h-4 w-4" />
            {calculating ? 'Calculando...' : 'Calcular Gastos'}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Año:</span>
          <Select value={filterYear} onValueChange={setFilterYear}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 5 }, (_, i) => {
                const year = new Date().getFullYear() - i
                return (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Mes:</span>
          <Select value={filterMonth} onValueChange={setFilterMonth}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 12 }, (_, i) => {
                const month = i + 1
                const monthName = new Date(0, i).toLocaleString('es-ES', { month: 'long' })
                return (
                  <SelectItem key={month} value={month.toString()}>
                    {monthName.charAt(0).toUpperCase() + monthName.slice(1)}
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <div className="flex items-center gap-2">
                  <Building className="h-4 w-4" />
                  Unidad
                </div>
              </TableHead>
              <TableHead>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Residente
                </div>
              </TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Gastos
                </div>
              </TableHead>
              <TableHead>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Alquiler
                </div>
              </TableHead>
              <TableHead>Recibo de gastos</TableHead>
              <TableHead>Recibo de alquiler</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                </TableCell>
              </TableRow>
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">No hay liquidaciones para este período</p>
                  <Button onClick={handleCalculate} disabled={calculating}>
                    <Calculator className="h-4 w-4 mr-2" />
                    Calcular Liquidaciones
                  </Button>
                </TableCell>
              </TableRow>
            ) : (
              data.map((item) => (
                <TableRow key={`${item.unit_id}-${item.resident_name || 'empty'}`}>
                  <TableCell className="font-medium">
                    Unidad {item.unit_number}
                    {item.expense_percentage && (
                      <div className="text-xs text-muted-foreground">
                        {item.expense_percentage}% de gastos
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {item.resident_name ? (
                      <div>
                        <div className="font-medium">{item.resident_name}</div>
                        {item.resident_email && (
                          <div className="text-sm text-muted-foreground">
                            {item.resident_email}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Sin residente</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {item.role ? (
                      <Badge variant={getRoleBadgeVariant(item.role)}>
                        {getRoleLabel(item.role)}
                      </Badge>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell className="font-medium text-green-600">
                    {item.expense_due ? (
                      `$${item.expense_due.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell className="font-medium text-blue-600">
                    {item.rent_due ? (
                      `$${item.rent_due.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell>
                    {item.expense_due ? (
                      <Button size="sm" variant="outline" onClick={() => setOpenExpenseReceipt(item.unit_id)}>Ver</Button>
                    ) : '-'}
                  </TableCell>
                  <TableCell>
                    {item.role === 'tenant' && item.rent_due ? (
                      <Button size="sm" variant="outline" onClick={() => setOpenRentReceipt(item.unit_id)}>Ver</Button>
                    ) : '-'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Expense Receipt Modal */}
      <Dialog open={openExpenseReceipt !== null} onOpenChange={(o) => !o && setOpenExpenseReceipt(null)}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Recibo de gastos</DialogTitle>
          </DialogHeader>
          {(() => {
            const row = data.find(d => d.unit_id === openExpenseReceipt)
            if (!row) return null
            const monthName = new Date(0, parseInt(filterMonth) - 1).toLocaleString('es-ES', { month: 'long' })
            return (
              <div className="space-y-4 p-2">
                <div className="text-sm text-muted-foreground">Periodo: {monthName} {filterYear}</div>
                <div className="border rounded p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold">Unidad {row.unit_number}</div>
                      <div className="text-sm">{row.resident_name || 'Sin residente'}</div>
                      {row.resident_email && <div className="text-xs text-muted-foreground">{row.resident_email}</div>}
                    </div>
                    <div className="text-right">
                      <div className="text-sm">% gastos: {row.expense_percentage ?? 0}%</div>
                      <div className="text-base font-semibold">Total: ${row.expense_due?.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })()}
        </DialogContent>
      </Dialog>

      {/* Rent Receipt Modal */}
      <Dialog open={openRentReceipt !== null} onOpenChange={(o) => !o && setOpenRentReceipt(null)}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Recibo de alquiler</DialogTitle>
          </DialogHeader>
          {(() => {
            const row = data.find(d => d.unit_id === openRentReceipt)
            if (!row) return null
            const monthName = new Date(0, parseInt(filterMonth) - 1).toLocaleString('es-ES', { month: 'long' })
            return (
              <div className="space-y-4 p-2">
                <div className="text-sm text-muted-foreground">Periodo: {monthName} {filterYear}</div>
                <div className="border rounded p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold">Unidad {row.unit_number}</div>
                      <div className="text-sm">{row.resident_name || 'Sin residente'}</div>
                      {row.resident_email && <div className="text-xs text-muted-foreground">{row.resident_email}</div>}
                    </div>
                    <div className="text-right">
                      <div className="text-base font-semibold">Total: ${row.rent_due?.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })()}
        </DialogContent>
      </Dialog>
    </div>
  )
}

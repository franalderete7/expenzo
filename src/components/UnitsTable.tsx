'use client'

import { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useProperty } from '@/contexts/PropertyContext'
import { Unit } from '@/types/entities'
import { supabase } from '@/lib/supabase'
import { Plus, Edit, Trash2, Home, ArrowUp, ArrowDown } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

interface UnitsTableRef {
  openCreateDialog: () => void
}

interface UnitFormData {
  unit_number: string
  status: 'occupied' | 'vacant'
  expense_percentage: number | undefined
  nis_number?: string
  catastro?: string
  water_account?: string
  gas_account?: string
  electricity_account?: string
}

type SortField = 'unit_number' | 'status' | 'expense_percentage' | 'created_at'
type SortDirection = 'asc' | 'desc'

const UnitsTableComponent = forwardRef<UnitsTableRef>((props, ref) => {
  const { selectedProperty } = useProperty()
  const router = useRouter()
  const [units, setUnits] = useState<Unit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sortField, setSortField] = useState<SortField>('unit_number')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null)

  // Form data
  const [formData, setFormData] = useState<UnitFormData>({
    unit_number: '',
    status: 'vacant',
    expense_percentage: undefined,
    nis_number: '',
    catastro: '',
    water_account: '',
    gas_account: '',
    electricity_account: ''
  })

  useImperativeHandle(ref, () => ({
    openCreateDialog: () => setCreateDialogOpen(true)
  }))

  const fetchUnits = useCallback(async () => {
    if (!selectedProperty) return

    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('units')
        .select(`
          *,
          residents (
            id,
            name,
            email,
            phone,
            role
          )
        `)
        .eq('property_id', selectedProperty.id)

      if (error) throw error
      setUnits(data || [])
    } catch (err) {
      console.error('Error fetching units:', err)
      setError(err instanceof Error ? err.message : 'Error fetching units')
      toast.error('Error loading units')
    } finally {
      setLoading(false)
    }
  }, [selectedProperty])

  useEffect(() => {
    fetchUnits()
  }, [fetchUnits])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const getSortIcon = (field: SortField) => {
    if (sortField === field) {
      return sortDirection === 'asc' ?
        <ArrowUp className="ml-2 h-4 w-4" /> :
        <ArrowDown className="ml-2 h-4 w-4" />
    }
    return <ArrowUp className="ml-2 h-4 w-4 text-muted-foreground opacity-50" />
  }

  // Client-side sorting
  const sortedUnits = [...units].sort((a, b) => {
    const aValue = a[sortField as keyof Unit]
    const bValue = b[sortField as keyof Unit]

    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortDirection === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue)
    }
    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue
    }
    return 0
  })

  const resetForm = () => {
    setFormData({
      unit_number: '',
      status: 'vacant',
      expense_percentage: undefined,
      nis_number: '',
      catastro: '',
      water_account: '',
      gas_account: '',
      electricity_account: ''
    })
  }

  const handleCreateUnit = async () => {
    if (!selectedProperty) return

    // Validate required fields
    if (!formData.unit_number.trim()) {
      toast.error('El número de unidad es requerido')
      return
    }
    if (formData.expense_percentage === undefined || formData.expense_percentage === null) {
      toast.error('El porcentaje de expensas es requerido')
      return
    }

    try {
      // Get the current session token
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        toast.error('No active session')
        return
      }

      // Use the API route with authentication
      const response = await fetch('/api/units', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          property_id: selectedProperty.id,
          unit_number: formData.unit_number,
          status: formData.status,
          expense_percentage: formData.expense_percentage,
          nis_number: formData.nis_number || null,
          catastro: formData.catastro || null,
          water_account: formData.water_account || null,
          gas_account: formData.gas_account || null,
          electricity_account: formData.electricity_account || null
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Error creating unit')
      }

      await response.json()

      toast.success('Unit created successfully')
      setCreateDialogOpen(false)
      resetForm()
      fetchUnits()
    } catch (err) {
      console.error('Error creating unit:', err)
      toast.error(err instanceof Error ? err.message : 'Error creating unit')
    }
  }

  const handleEditUnit = (unit: Unit) => {
    setEditingUnit(unit)
    setFormData({
      unit_number: unit.unit_number,
      status: unit.status,
      expense_percentage: unit.expense_percentage || undefined,
      nis_number: unit.nis_number || '',
      catastro: unit.catastro || '',
      water_account: unit.water_account || '',
      gas_account: unit.gas_account || '',
      electricity_account: unit.electricity_account || ''
    })
    setEditDialogOpen(true)
  }

  const handleUpdateUnit = async () => {
    if (!editingUnit) return

    // Validate required fields
    if (!formData.unit_number.trim()) {
      toast.error('El número de unidad es requerido')
      return
    }
    if (formData.expense_percentage === undefined || formData.expense_percentage === null) {
      toast.error('El porcentaje de expensas es requerido')
      return
    }

    try {
      // Get the current session token
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        toast.error('No active session')
        return
      }

      // Use the API route for updating units
      const response = await fetch(`/api/properties/${selectedProperty!.id}/units/${editingUnit.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          unit_number: formData.unit_number,
          status: formData.status,
          expense_percentage: formData.expense_percentage,
          nis_number: formData.nis_number || null,
          catastro: formData.catastro || null,
          water_account: formData.water_account || null,
          gas_account: formData.gas_account || null,
          electricity_account: formData.electricity_account || null
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Error updating unit')
      }

      await response.json()

      toast.success('Unit updated successfully')
      setEditDialogOpen(false)
      setEditingUnit(null)
      resetForm()
      fetchUnits()
    } catch (err) {
      console.error('Error updating unit:', err)
      toast.error(err instanceof Error ? err.message : 'Error updating unit')
    }
  }

  const handleDeleteUnit = async (unitId: number) => {
    try {
      // Get the current session token
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        toast.error('No active session')
        return
      }

      // Use the API route for deleting units
      const response = await fetch(`/api/properties/${selectedProperty!.id}/units/${unitId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        }
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Error deleting unit')
      }

      toast.success('Unit deleted successfully')
      fetchUnits()
    } catch (err) {
      console.error('Error deleting unit:', err)
      toast.error(err instanceof Error ? err.message : 'Error deleting unit')
    }
  }



  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'occupied':
        return 'default'
      case 'vacant':
        return 'secondary'
      default:
        return 'outline'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'occupied':
        return 'Ocupada'
      case 'vacant':
        return 'Vacante'
      default:
        return status
    }
  }

  if (!selectedProperty) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Selecciona una propiedad para ver las unidades.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Unidades</h3>
          <p className="text-sm text-muted-foreground">
            Gestiona las unidades de {selectedProperty.name}
          </p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              Nueva Unidad
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crear Nueva Unidad</DialogTitle>
              <DialogDescription>
                Agrega una nueva unidad a {selectedProperty.name}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="unit_number" className="text-right">
                  Número
                </Label>
                <Input
                  id="unit_number"
                  value={formData.unit_number}
                  onChange={(e) => setFormData({ ...formData, unit_number: e.target.value })}
                  className="col-span-3"
                  placeholder="Ej: 1A, 2B, 101"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="status" className="text-right">
                  Estado
                </Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: 'occupied' | 'vacant') =>
                    setFormData({ ...formData, status: value })
                  }
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Seleccionar estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vacant">Vacante</SelectItem>
                    <SelectItem value="occupied">Ocupada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="expense_percentage" className="text-right">
                  % Expensas
                </Label>
                <Input
                  id="expense_percentage"
                  type="number"
                  min="0"
                  max="100"
                  value={formData.expense_percentage ?? ''}
                  onChange={(e) => {
                    const value = e.target.value
                    setFormData({
                      ...formData,
                      expense_percentage: value === '' ? undefined : parseFloat(value) || 0
                    })
                  }}
                  className="col-span-3"
                  placeholder="Ej: 25.5"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="nis_number" className="text-right">
                  NIS
                </Label>
                <Input
                  id="nis_number"
                  value={formData.nis_number || ''}
                  onChange={(e) => setFormData({ ...formData, nis_number: e.target.value })}
                  className="col-span-3"
                  placeholder="Número de identificación del servicio"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="catastro" className="text-right">
                  Catastro
                </Label>
                <Input
                  id="catastro"
                  value={formData.catastro || ''}
                  onChange={(e) => setFormData({ ...formData, catastro: e.target.value })}
                  className="col-span-3"
                  placeholder="Número catastral"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="water_account" className="text-right">
                  Agua
                </Label>
                <Input
                  id="water_account"
                  value={formData.water_account || ''}
                  onChange={(e) => setFormData({ ...formData, water_account: e.target.value })}
                  className="col-span-3"
                  placeholder="Cuenta de agua"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="gas_account" className="text-right">
                  Gas
                </Label>
                <Input
                  id="gas_account"
                  value={formData.gas_account || ''}
                  onChange={(e) => setFormData({ ...formData, gas_account: e.target.value })}
                  className="col-span-3"
                  placeholder="Cuenta de gas"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="electricity_account" className="text-right">
                  Electricidad
                </Label>
                <Input
                  id="electricity_account"
                  value={formData.electricity_account || ''}
                  onChange={(e) => setFormData({ ...formData, electricity_account: e.target.value })}
                  className="col-span-3"
                  placeholder="Cuenta de electricidad"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreateUnit}>Crear Unidad</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('unit_number')}
              >
                <div className="flex items-center">
                  Número
                  {getSortIcon('unit_number')}
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('status')}
              >
                <div className="flex items-center">
                  Estado
                  {getSortIcon('status')}
                </div>
              </TableHead>
              <TableHead>Residente</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('expense_percentage')}
              >
                <div className="flex items-center">
                  % Expensas
                  {getSortIcon('expense_percentage')}
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('created_at')}
              >
                <div className="flex items-center">
                  Creado
                  {getSortIcon('created_at')}
                </div>
              </TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-destructive py-8">
                  <p>Error: {error}</p>
                  <Button variant="outline" onClick={fetchUnits} className="mt-2">
                    Reintentar
                  </Button>
                </TableCell>
              </TableRow>
            ) : units.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <Home className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">No hay unidades registradas</p>
                  <Button onClick={() => setCreateDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Crear Primera Unidad
                  </Button>
                </TableCell>
              </TableRow>
            ) : (
              sortedUnits.map((unit) => {
                const resident = unit.residents?.[0]
                const hasResident = resident && resident.name

                return (
                  <TableRow
                    key={unit.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => router.push(`/dashboard/units/${unit.id}`)}
                  >
                    <TableCell className="font-medium">{unit.unit_number}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(unit.status)}>
                        {getStatusText(unit.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {hasResident ? (
                        <div className="space-y-1">
                          <div className="font-medium">{resident.name}</div>
                          {resident.email && (
                            <div className="text-sm text-muted-foreground">{resident.email}</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Sin residente</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {hasResident ? (
                        <Badge
                          variant={resident.role === 'owner' ? 'secondary' : 'default'}
                          className="text-xs"
                        >
                          {resident.role === 'owner' ? 'Propietario' : 'Inquilino'}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>{unit.expense_percentage}%</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(unit.created_at).toLocaleDateString('es-ES')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditUnit(unit)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Eliminar Unidad</AlertDialogTitle>
                              <AlertDialogDescription>
                                ¿Estás seguro de que quieres eliminar la unidad {unit.unit_number}?
                                Esta acción no se puede deshacer.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteUnit(unit.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Eliminar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Unidad</DialogTitle>
            <DialogDescription>
              Modifica los datos de la unidad
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit_unit_number" className="text-right">
                Número
              </Label>
              <Input
                id="edit_unit_number"
                value={formData.unit_number}
                onChange={(e) => setFormData({ ...formData, unit_number: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit_status" className="text-right">
                Estado
              </Label>
              <Select
                value={formData.status}
                onValueChange={(value: 'occupied' | 'vacant') =>
                  setFormData({ ...formData, status: value })
                }
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Seleccionar estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vacant">Vacante</SelectItem>
                  <SelectItem value="occupied">Ocupada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit_expense_percentage" className="text-right">
                % Expensas
              </Label>
              <Input
                id="edit_expense_percentage"
                type="number"
                min="0"
                max="100"
                value={formData.expense_percentage ?? ''}
                onChange={(e) => {
                  const value = e.target.value
                  setFormData({
                    ...formData,
                    expense_percentage: value === '' ? undefined : parseFloat(value) || 0
                  })
                }}
                className="col-span-3"
                placeholder="Ej: 25.5"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit_nis_number" className="text-right">
                NIS
              </Label>
              <Input
                id="edit_nis_number"
                value={formData.nis_number || ''}
                onChange={(e) => setFormData({ ...formData, nis_number: e.target.value })}
                className="col-span-3"
                placeholder="Número de identificación del servicio"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit_catastro" className="text-right">
                Catastro
              </Label>
              <Input
                id="edit_catastro"
                value={formData.catastro || ''}
                onChange={(e) => setFormData({ ...formData, catastro: e.target.value })}
                className="col-span-3"
                placeholder="Número catastral"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit_water_account" className="text-right">
                Agua
              </Label>
              <Input
                id="edit_water_account"
                value={formData.water_account || ''}
                onChange={(e) => setFormData({ ...formData, water_account: e.target.value })}
                className="col-span-3"
                placeholder="Cuenta de agua"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit_gas_account" className="text-right">
                Gas
              </Label>
              <Input
                id="edit_gas_account"
                value={formData.gas_account || ''}
                onChange={(e) => setFormData({ ...formData, gas_account: e.target.value })}
                className="col-span-3"
                placeholder="Cuenta de gas"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit_electricity_account" className="text-right">
                Electricidad
              </Label>
              <Input
                id="edit_electricity_account"
                value={formData.electricity_account || ''}
                onChange={(e) => setFormData({ ...formData, electricity_account: e.target.value })}
                className="col-span-3"
                placeholder="Cuenta de electricidad"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdateUnit}>Guardar Cambios</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
})

UnitsTableComponent.displayName = 'UnitsTable'

export const UnitsTable = UnitsTableComponent

'use client'

import { useState, useEffect, forwardRef, useImperativeHandle } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'

import {
  ArrowUp,
  ArrowDown,
  Plus,
  Edit,
  Trash2,
  Loader2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useProperty } from '@/contexts/PropertyContext'
import { Resident, ResidentFormData, Unit } from '@/types/entities'

interface ResidentsTableRef {
  openCreateDialog: () => void
}

export const ResidentsTable = forwardRef<ResidentsTableRef>((props, ref) => {
  const { selectedProperty } = useProperty()
  const [residents, setResidents] = useState<Resident[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [loading, setLoading] = useState(false)
  const [sortField, setSortField] = useState<string>('name')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingResident, setEditingResident] = useState<Resident | null>(null)

  // Form state
  const [formData, setFormData] = useState<ResidentFormData>({
    property_id: selectedProperty?.id || 0,
    unit_id: undefined,
    name: '',
    email: '',
    phone: '',
    role: 'tenant'
  })

  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  useImperativeHandle(ref, () => ({
    openCreateDialog: () => setCreateDialogOpen(true)
  }))

  useEffect(() => {
    if (selectedProperty) {
      fetchResidents()
      fetchUnits()
    }
  }, [selectedProperty, currentPage])

  const fetchResidents = async () => {
    if (!selectedProperty) return

    setLoading(true)
    try {
      // Get the current session token
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        toast.error('No active session')
        return
      }

      const response = await fetch(
        `/api/residents?property_id=${selectedProperty.id}&page=${currentPage}&limit=10`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          }
        }
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Error fetching residents')
      }

      const data = await response.json()
      setResidents(data.residents || [])
      setTotalPages(data.pagination?.totalPages || 1)
      setTotalCount(data.pagination?.total || 0)
    } catch (error) {
      console.error('Error fetching residents:', error)
      toast.error('Error loading residents')
    } finally {
      setLoading(false)
    }
  }

  const fetchUnits = async () => {
    if (!selectedProperty) return

    try {
      const { data, error } = await supabase
        .from('units')
        .select('*')
        .eq('property_id', selectedProperty.id)
        .order('unit_number')

      if (error) throw error
      setUnits(data || [])
    } catch (error) {
      console.error('Error fetching units:', error)
      toast.error('Error loading units')
    }
  }

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}

    // Name validation
    if (!formData.name.trim()) {
      errors.name = 'El nombre es requerido'
    } else if (formData.name.trim().length < 2) {
      errors.name = 'El nombre debe tener al menos 2 caracteres'
    }

    // Email validation (optional but if provided, must be valid)
    if (formData.email && formData.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(formData.email)) {
        errors.email = 'El email no tiene un formato válido'
      }
    }

    // Phone validation (Argentine format: +54 followed by numbers)
    if (formData.phone && formData.phone.trim()) {
      const phoneRegex = /^\+54\d{10}$/
      if (!phoneRegex.test(formData.phone)) {
        errors.phone = 'El teléfono debe tener el formato +543871234567'
      }
    }

    // Role validation
    if (!formData.role) {
      errors.role = 'El rol es requerido'
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const resetForm = () => {
    setFormData({
      property_id: selectedProperty?.id || 0,
      unit_id: undefined,
      name: '',
      email: '',
      phone: '',
      role: 'tenant'
    })
    setFormErrors({})
  }

  const handleCreateResident = async () => {
    if (!selectedProperty) {
      toast.error('No property selected')
      return
    }

    if (!validateForm()) {
      return
    }

    try {
      // Get the current session token
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        toast.error('No active session')
        return
      }

      const response = await fetch('/api/residents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          property_id: selectedProperty.id,
          unit_id: formData.unit_id,
          name: formData.name.trim(),
          email: formData.email?.trim() || null,
          phone: formData.phone?.trim() || null,
          role: formData.role
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Error creating resident')
      }

      const data = await response.json()
      toast.success('Residente creado exitosamente')
      setCreateDialogOpen(false)
      resetForm()
      fetchResidents()
    } catch (error) {
      console.error('Error creating resident:', error)
      toast.error(error instanceof Error ? error.message : 'Error creating resident')
    }
  }

  const handleEditResident = (resident: Resident) => {
    setEditingResident(resident)
    setFormData({
      property_id: resident.property_id || selectedProperty?.id || undefined,
      unit_id: resident.unit_id || undefined,
      name: resident.name,
      email: resident.email || '',
      phone: resident.phone || '',
      role: resident.role
    })
    setFormErrors({})
    setEditDialogOpen(true)
  }

  const handleUpdateResident = async () => {
    if (!editingResident) return

    if (!validateForm()) {
      return
    }

    try {
      // Get the current session token
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        toast.error('No active session')
        return
      }

      const response = await fetch(`/api/residents/${editingResident.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          property_id: formData.property_id,
          unit_id: formData.unit_id,
          name: formData.name.trim(),
          email: formData.email?.trim() || null,
          phone: formData.phone?.trim() || null,
          role: formData.role
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Error updating resident')
      }

      const data = await response.json()
      toast.success('Residente actualizado exitosamente')
      setEditDialogOpen(false)
      setEditingResident(null)
      resetForm()
      fetchResidents()
    } catch (error) {
      console.error('Error updating resident:', error)
      toast.error(error instanceof Error ? error.message : 'Error updating resident')
    }
  }

  const handleDeleteResident = async (residentId: number) => {
    try {
      // Get the current session token
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        toast.error('No active session')
        return
      }

      const response = await fetch(`/api/residents/${residentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        }
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Error deleting resident')
      }

      toast.success('Residente eliminado exitosamente')
      fetchResidents()
    } catch (error) {
      console.error('Error deleting resident:', error)
      toast.error(error instanceof Error ? error.message : 'Error deleting resident')
    }
  }

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const getRoleBadgeVariant = (role: string) => {
    return role === 'owner' ? 'default' : 'secondary'
  }

  const getRoleLabel = (role: string) => {
    return role === 'owner' ? 'Propietario' : 'Inquilino'
  }

  const getSortIcon = (field: string) => {
    if (sortField === field) {
      return sortDirection === 'asc' ?
        <ArrowUp className="ml-2 h-4 w-4" /> :
        <ArrowDown className="ml-2 h-4 w-4" />
    }
    return <ArrowUp className="ml-2 h-4 w-4 text-muted-foreground opacity-50" />
  }

  // Client-side sorting
  const sortedResidents = [...residents].sort((a, b) => {
    const aValue = a[sortField as keyof Resident]
    const bValue = b[sortField as keyof Resident]

    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortDirection === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue)
    }
    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue
    }
    return 0
  })

  if (!selectedProperty) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Selecciona una propiedad para ver los residentes
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Residentes</h2>
          <p className="text-muted-foreground">
            Gestiona los residentes de {selectedProperty.name}
          </p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Residente
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Crear Nuevo Residente</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">Nombre *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="col-span-3"
                  placeholder="Ej: Juan Pérez"
                />
              </div>
              {formErrors.name && (
                <div className="col-start-2 col-span-3 text-sm text-destructive">
                  {formErrors.name}
                </div>
              )}

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="email" className="text-right">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="col-span-3"
                  placeholder="Ej: juan@email.com"
                />
              </div>
              {formErrors.email && (
                <div className="col-start-2 col-span-3 text-sm text-destructive">
                  {formErrors.email}
                </div>
              )}

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="phone" className="text-right">Teléfono</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="col-span-3"
                  placeholder="+543871234567"
                />
              </div>
              {formErrors.phone && (
                <div className="col-start-2 col-span-3 text-sm text-destructive">
                  {formErrors.phone}
                </div>
              )}

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="unit" className="text-right">Unidad</Label>
                <Select
                  value={formData.unit_id?.toString() || 'none'}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      unit_id: value === 'none' ? undefined : parseInt(value)
                    })
                  }
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Seleccionar unidad (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin unidad asignada</SelectItem>
                    {units.map((unit) => (
                      <SelectItem key={unit.id} value={unit.id.toString()}>
                        Unidad {unit.unit_number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="role" className="text-right">Rol *</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value: 'owner' | 'tenant') =>
                    setFormData({ ...formData, role: value })
                  }
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Seleccionar rol" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="owner">Propietario</SelectItem>
                    <SelectItem value="tenant">Inquilino</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {formErrors.role && (
                <div className="col-start-2 col-span-3 text-sm text-destructive">
                  {formErrors.role}
                </div>
              )}
            </div>
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => {
                  setCreateDialogOpen(false)
                  resetForm()
                }}
              >
                Cancelar
              </Button>
              <Button onClick={handleCreateResident}>
                Crear Residente
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('name')}
              >
                <div className="flex items-center">
                  Nombre
                  {getSortIcon('name')}
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('email')}
              >
                <div className="flex items-center">
                  Email
                  {getSortIcon('email')}
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('phone')}
              >
                <div className="flex items-center">
                  Teléfono
                  {getSortIcon('phone')}
                </div>
              </TableHead>
              <TableHead>Unidad</TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('role')}
              >
                <div className="flex items-center">
                  Rol
                  {getSortIcon('role')}
                </div>
              </TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                  <span className="ml-2">Cargando residentes...</span>
                </TableCell>
              </TableRow>
            ) : residents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No hay residentes registrados
                </TableCell>
              </TableRow>
            ) : (
              sortedResidents.map((resident) => (
                <TableRow key={resident.id}>
                  <TableCell className="font-medium">{resident.name}</TableCell>
                  <TableCell>{resident.email || '-'}</TableCell>
                  <TableCell>{resident.phone || '-'}</TableCell>
                  <TableCell>
                    {resident.units ? `Unidad ${resident.units.unit_number}` : 'Sin unidad'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getRoleBadgeVariant(resident.role)}>
                      {getRoleLabel(resident.role)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditResident(resident)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta acción eliminará permanentemente al residente &quot;{resident.name}&quot;.
                              Esta acción no se puede deshacer.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteResident(resident.id)}
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
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Mostrando {residents.length} de {totalCount} residentes
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </Button>
            <span className="text-sm">
              Página {currentPage} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              Siguiente
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Editar Residente</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-name" className="text-right">Nombre *</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="col-span-3"
              />
            </div>
            {formErrors.name && (
              <div className="col-start-2 col-span-3 text-sm text-destructive">
                {formErrors.name}
              </div>
            )}

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-email" className="text-right">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="col-span-3"
              />
            </div>
            {formErrors.email && (
              <div className="col-start-2 col-span-3 text-sm text-destructive">
                {formErrors.email}
              </div>
            )}

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-phone" className="text-right">Teléfono</Label>
              <Input
                id="edit-phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="col-span-3"
              />
            </div>
            {formErrors.phone && (
              <div className="col-start-2 col-span-3 text-sm text-destructive">
                {formErrors.phone}
              </div>
            )}

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-unit" className="text-right">Unidad</Label>
              <Select
                value={formData.unit_id?.toString() || 'none'}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    unit_id: value === 'none' ? undefined : parseInt(value)
                  })
                }
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Seleccionar unidad (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin unidad asignada</SelectItem>
                  {units.map((unit) => (
                    <SelectItem key={unit.id} value={unit.id.toString()}>
                      Unidad {unit.unit_number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-role" className="text-right">Rol *</Label>
              <Select
                value={formData.role}
                onValueChange={(value: 'owner' | 'tenant') =>
                  setFormData({ ...formData, role: value })
                }
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Seleccionar rol" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">Propietario</SelectItem>
                  <SelectItem value="tenant">Inquilino</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {formErrors.role && (
              <div className="col-start-2 col-span-3 text-sm text-destructive">
                {formErrors.role}
              </div>
            )}
          </div>
          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={() => {
                setEditDialogOpen(false)
                setEditingResident(null)
                resetForm()
              }}
            >
              Cancelar
            </Button>
            <Button onClick={handleUpdateResident}>
              Actualizar Residente
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
})

ResidentsTable.displayName = 'ResidentsTable'

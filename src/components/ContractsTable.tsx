'use client'

import { useState, useEffect, forwardRef, useImperativeHandle, useCallback } from 'react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowUp, ArrowDown, Plus, Edit, Trash2, DollarSign } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useProperty } from '@/contexts/PropertyContext'
import { Contract, ContractFormData } from '@/types/entities'
import { ContractDetailModal } from './ContractDetailModal'

interface ContractsTableRef {
  openCreateDialog: () => void
}

interface ContractWithJoins {
  unit_id: number
  tenant_id: number
  units: {
    id: number
    unit_number: string
  }
  residents: {
    id: number
    name: string
    email: string
  }
}

interface UnitResidentOption {
  unitId: number
  residentId: number
  unitNumber: string
  residentName: string
  residentEmail?: string
  displayText: string
}

interface ResidentWithUnit {
  id: number
  name: string
  email?: string
  unit_id: number
  units: {
    id: number
    unit_number: string
    property_id: number
  }
}

interface ActiveContractRow {
  tenant_id: number
  unit_id: number
  units: {
    id: number
    property_id: number
  }
}

type SortField = 'start_date' | 'end_date' | 'initial_rent_amount' | 'status' | 'created_at'
type SortDirection = 'asc' | 'desc'

export const ContractsTable = forwardRef<ContractsTableRef>((props, ref) => {
  const { selectedProperty } = useProperty()
  const [contracts, setContracts] = useState<Contract[]>([])
  const [unitResidentOptions, setUnitResidentOptions] = useState<UnitResidentOption[]>([])
  const [selectedUnitResident, setSelectedUnitResident] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingContract, setEditingContract] = useState<Contract | null>(null)
  const [contractDetailModalOpen, setContractDetailModalOpen] = useState(false)
  const [selectedContractId, setSelectedContractId] = useState<number | null>(null)

  // Form data
  const [formData, setFormData] = useState<ContractFormData>({
    unit_id: 0,
    tenant_id: 0,
    start_date: '',
    end_date: '',
    initial_rent_amount: undefined,
    deposit_amount: '',
    rent_increase_frequency: 'quarterly',
    status: 'active',
    currency: 'ARS',
    currency_deposit: 'ARS',
    description: '',
    icl_index_type: 'ICL' as 'ICL' | 'IPC' | 'Average'
  })

  useImperativeHandle(ref, () => ({
    openCreateDialog: () => setCreateDialogOpen(true)
  }))

  const fetchContracts = useCallback(async () => {
    if (!selectedProperty) return

    try {
      setLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        toast.error('No active session')
        return
      }

      const response = await fetch(`/api/contracts?property_id=${selectedProperty.id}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        }
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Error fetching contracts')
      }

      const { contracts: fetchedContracts } = await response.json()
      setContracts(fetchedContracts || [])
    } catch (error) {
      console.error('Error fetching contracts:', error)
      toast.error(error instanceof Error ? error.message : 'Error fetching contracts')
    } finally {
      setLoading(false)
    }
  }, [selectedProperty])

  const fetchUnitsAndResidents = useCallback(async () => {
    if (!selectedProperty) return

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      // 1) Fetch tenants with an assigned unit in this property
      const { data: residentsWithUnits, error: residentsError } = await supabase
        .from('residents')
        .select(`
          id,
          name,
          email,
          unit_id,
          units!inner (
            id,
            unit_number,
            property_id
          )
        `)
        .eq('property_id', selectedProperty.id)
        .eq('role', 'tenant')
        .not('unit_id', 'is', null)

      if (residentsError) throw residentsError

      // 2) Fetch active contracts in this property to exclude those tenants/units
      const { data: activeContracts, error: activeContractsError } = await supabase
        .from('contracts')
        .select(`
          tenant_id,
          unit_id,
          units!inner (
            id,
            property_id
          )
        `)
        .eq('status', 'active')
        .eq('units.property_id', selectedProperty.id)

      if (activeContractsError) throw activeContractsError

      const activeTenantIds = new Set((activeContracts as unknown as ActiveContractRow[] || []).map((c) => c.tenant_id))
      const activeUnitIds = new Set((activeContracts as unknown as ActiveContractRow[] || []).map((c) => c.unit_id))

      // 3) Filter to available pairs: tenant has unit assigned and neither tenant nor unit is in an active contract
      const available = ((residentsWithUnits as unknown as ResidentWithUnit[]) || []).filter((r) => {
        const unit = r.units
        return unit && !activeTenantIds.has(r.id) && !activeUnitIds.has(unit.id)
      })

      // 4) Build combined options sorted by resident name
      const options: UnitResidentOption[] = available
        .map((r) => ({
          unitId: r.units.id,
          residentId: r.id,
          unitNumber: r.units.unit_number,
          residentName: r.name,
          residentEmail: r.email,
          displayText: `${r.name} — Unidad ${r.units.unit_number}`
        }))
        .sort((a, b) => a.residentName.localeCompare(b.residentName))

      // If editing, ensure current (unit, tenant) pair is present even if already active
      if (editingContract && editingContract.unit_id && editingContract.tenant_id) {
        const exists = options.some(
          (o) => o.unitId === editingContract.unit_id && o.residentId === editingContract.tenant_id
        )
        if (!exists) {
          const displayText = `${editingContract.tenant?.name || `Inquilino ${editingContract.tenant_id}`} — Unidad ${editingContract.unit?.unit_number || editingContract.unit_id}`
          options.push({
            unitId: editingContract.unit_id,
            residentId: editingContract.tenant_id,
            unitNumber: editingContract.unit?.unit_number?.toString() || String(editingContract.unit_id),
            residentName: editingContract.tenant?.name || String(editingContract.tenant_id),
            residentEmail: editingContract.tenant?.email,
            displayText
          })
        }
      }

      setUnitResidentOptions(options)
    } catch (error) {
      console.error('Error fetching units/residents:', error)
    }
  }, [selectedProperty, editingContract])



  useEffect(() => {
    if (selectedProperty) {
      fetchContracts()
      fetchUnitsAndResidents()
    }
  }, [selectedProperty, editingContract])

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
  const sortedContracts = [...contracts].sort((a, b) => {
    const aValue = a[sortField as keyof Contract]
    const bValue = b[sortField as keyof Contract]

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
      unit_id: 0,
      tenant_id: 0,
      start_date: '',
      end_date: '',
      initial_rent_amount: undefined,
      deposit_amount: '',
      rent_increase_frequency: 'quarterly',
      status: 'active',
      currency: 'ARS',
      currency_deposit: 'ARS',
      description: '',
      icl_index_type: 'ICL' as 'ICL' | 'IPC' | 'Average'
    })
    setSelectedUnitResident('')
  }

  const handleCreateContract = async () => {
    if (!selectedProperty) {
      toast.error('Selecciona una propiedad para crear un contrato.')
      return
    }

    if (!selectedUnitResident) {
      toast.error('La unidad e inquilino son requeridos')
      return
    }

    // Parse the combined selection
    const [unitId, tenantId] = selectedUnitResident.split('-').map(Number)
    if (!unitId || !tenantId) {
      toast.error('Selección inválida')
      return
    }
    if (!formData.start_date) {
      toast.error('La fecha de inicio es requerida')
      return
    }
    if (!formData.end_date) {
      toast.error('La fecha de fin es requerida')
      return
    }
    if (!formData.initial_rent_amount || formData.initial_rent_amount <= 0) {
      toast.error('El monto inicial es requerido y debe ser mayor a 0')
      return
    }

    try {
      setLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        toast.error('No active session')
        return
      }

      const response = await fetch('/api/contracts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          property_id: selectedProperty.id,
          unit_id: unitId,
          tenant_id: tenantId,
          start_date: formData.start_date,
          end_date: formData.end_date,
          initial_rent_amount: formData.initial_rent_amount,
          deposit_amount: formData.deposit_amount ? parseFloat(formData.deposit_amount.toString()) : undefined,
          rent_increase_frequency: formData.rent_increase_frequency,
          status: formData.status,
          currency: formData.currency,
          currency_deposit: formData.currency_deposit,
          description: formData.description,
          icl_index_type: formData.icl_index_type
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Error creating contract')
      }

      toast.success('Contrato creado exitosamente.')
      setCreateDialogOpen(false)
      resetForm()
      fetchContracts()
    } catch (error) {
      console.error('Error creating contract:', error)
      toast.error(error instanceof Error ? error.message : 'Error creating contract')
    } finally {
      setLoading(false)
    }
  }

  const handleEditContract = (contract: Contract) => {
    setEditingContract(contract)
    setFormData({
      unit_id: contract.unit_id,
      tenant_id: contract.tenant_id,
      start_date: contract.start_date,
      end_date: contract.end_date,
      initial_rent_amount: contract.initial_rent_amount || undefined,
      deposit_amount: contract.deposit_amount?.toString() || '',
      rent_increase_frequency: contract.rent_increase_frequency,
      status: contract.status,
      currency: contract.currency || 'ARS',
      currency_deposit: contract.currency_deposit || 'ARS',
      description: contract.description || '',
      icl_index_type: contract.icl_index_type || 'ICL'
    })
    // Set the combined selection for editing
    setSelectedUnitResident(`${contract.unit_id}-${contract.tenant_id}`)
    setEditDialogOpen(true)
  }

  const handleUpdateContract = async () => {
    if (!editingContract) return

    if (!selectedUnitResident) {
      toast.error('La unidad e inquilino son requeridos')
      return
    }

    // Parse the combined selection
    const [unitId, tenantId] = selectedUnitResident.split('-').map(Number)
    if (!unitId || !tenantId) {
      toast.error('Selección inválida')
      return
    }
    if (!formData.start_date) {
      toast.error('La fecha de inicio es requerida')
      return
    }
    if (!formData.end_date) {
      toast.error('La fecha de fin es requerida')
      return
    }
    if (!formData.initial_rent_amount || formData.initial_rent_amount <= 0) {
      toast.error('El monto inicial es requerido y debe ser mayor a 0')
      return
    }

    try {
      setLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        toast.error('No active session')
        return
      }

      const response = await fetch(`/api/contracts/${editingContract.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          unit_id: unitId,
          tenant_id: tenantId,
          start_date: formData.start_date,
          end_date: formData.end_date,
          initial_rent_amount: formData.initial_rent_amount,
          deposit_amount: formData.deposit_amount ? parseFloat(formData.deposit_amount.toString()) : undefined,
          rent_increase_frequency: formData.rent_increase_frequency,
          status: formData.status,
          currency: formData.currency,
          currency_deposit: formData.currency_deposit,
          description: formData.description,
          icl_index_type: formData.icl_index_type
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Error updating contract')
      }

      toast.success('Contrato actualizado exitosamente.')
      setEditDialogOpen(false)
      resetForm()
      setEditingContract(null)
      fetchContracts()
    } catch (error) {
      console.error('Error updating contract:', error)
      toast.error(error instanceof Error ? error.message : 'Error updating contract')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteContract = async (contractId: number) => {
    try {
      setLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        toast.error('No active session')
        return
      }

      const response = await fetch(`/api/contracts/${contractId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        }
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Error deleting contract')
      }

      toast.success('Contrato eliminado exitosamente.')
      fetchContracts()
    } catch (error) {
      console.error('Error deleting contract:', error)
      toast.error(error instanceof Error ? error.message : 'Error deleting contract')
    } finally {
      setLoading(false)
    }
  }

  const handleViewContractDetail = (contractId: number) => {
    setSelectedContractId(contractId)
    setContractDetailModalOpen(true)
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'active':
        return 'default'
      case 'expired':
        return 'destructive'
      case 'renewed':
        return 'secondary'
      default:
        return 'outline'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active':
        return 'Activo'
      case 'expired':
        return 'Expirado'
      case 'renewed':
        return 'Renovado'
      default:
        return status
    }
  }

  const getFrequencyLabel = (frequency: string) => {
    switch (frequency) {
      case 'monthly':
        return 'Mensual'
      case 'quarterly':
        return 'Trimestral'
      case 'semi-annually':
        return 'Semestral'
      case 'annually':
        return 'Anual'
      default:
        return frequency
    }
  }

  if (!selectedProperty) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Selecciona una propiedad para ver los contratos.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Contratos</h2>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="mr-2 h-4 w-4" /> Crear Contrato
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Crear Nuevo Contrato</DialogTitle>
              <DialogDescription>
                Completa los detalles para crear un nuevo contrato de alquiler.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="unit_resident" className="text-right">Inquilino *</Label>
                <Select
                  value={selectedUnitResident}
                  onValueChange={(value) => setSelectedUnitResident(value)}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Seleccionar inquilino (con unidad asignada)" />
                  </SelectTrigger>
                  <SelectContent>
                    {unitResidentOptions.map((option) => (
                      <SelectItem key={`${option.unitId}-${option.residentId}`} value={`${option.unitId}-${option.residentId}`}>
                        {option.displayText}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="start_date" className="text-right">Fecha Inicio *</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  className="col-span-3"
                />
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="end_date" className="text-right">Fecha Fin *</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  className="col-span-3"
                />
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="initial_rent_amount" className="text-right">Monto Inicial *</Label>
                <Input
                  id="initial_rent_amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.initial_rent_amount || ''}
                  onChange={(e) => {
                    const value = e.target.value
                    setFormData({
                      ...formData,
                      initial_rent_amount: value === '' ? undefined : parseFloat(value) || undefined
                    })
                  }}
                  className="col-span-3"
                  placeholder="0.00"
                />
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="currency" className="text-right">Moneda Contrato</Label>
                <Select
                  value={formData.currency}
                  onValueChange={(value) => setFormData({ ...formData, currency: value })}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Seleccionar moneda" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ARS">ARS (Peso Argentino)</SelectItem>
                    <SelectItem value="USD">USD (Dólar Estadounidense)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="deposit_amount" className="text-right">Depósito</Label>
                <Input
                  id="deposit_amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.deposit_amount || ''}
                  onChange={(e) => {
                    const value = e.target.value
                    setFormData({
                      ...formData,
                      deposit_amount: value
                    })
                  }}
                  className="col-span-3"
                  placeholder="0.00"
                />
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="currency_deposit" className="text-right">Moneda Depósito</Label>
                <Select
                  value={formData.currency_deposit}
                  onValueChange={(value) => setFormData({ ...formData, currency_deposit: value })}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Seleccionar moneda depósito" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ARS">ARS (Peso Argentino)</SelectItem>
                    <SelectItem value="USD">USD (Dólar Estadounidense)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="rent_increase_frequency" className="text-right">Frecuencia Aumento</Label>
                <Select
                  value={formData.rent_increase_frequency}
                  onValueChange={(value: 'monthly' | 'quarterly' | 'semi-annually' | 'annually') =>
                    setFormData({ ...formData, rent_increase_frequency: value })
                  }
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Seleccionar frecuencia" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Mensual</SelectItem>
                    <SelectItem value="quarterly">Trimestral</SelectItem>
                    <SelectItem value="semi-annually">Semestral</SelectItem>
                    <SelectItem value="annually">Anual</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="status" className="text-right">Estado</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: 'active' | 'expired' | 'renewed') =>
                    setFormData({ ...formData, status: value })
                  }
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Seleccionar estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Activo</SelectItem>
                    <SelectItem value="expired">Expirado</SelectItem>
                    <SelectItem value="renewed">Renovado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="description" className="text-right">Descripción</Label>
                <Textarea
                  id="description"
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="col-span-3"
                  placeholder="Agrega notas adicionales sobre el contrato..."
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="icl_index_type" className="text-right">Índice</Label>
                <Select
                  value={formData.icl_index_type}
                  onValueChange={(value) => setFormData({ ...formData, icl_index_type: value })}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Seleccionar índice" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ICL">ICL (Índice de Contratos de Locación)</SelectItem>
                    <SelectItem value="IPC">IPC (Índice de Precios al Consumidor)</SelectItem>
                    <SelectItem value="Average">Promedio (ICL + IPC)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleCreateContract} disabled={loading}>
                {loading ? 'Creando...' : 'Crear Contrato'}
              </Button>
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
                onClick={() => handleSort('start_date')}
              >
                <div className="flex items-center">
                  Fecha Inicio
                  {getSortIcon('start_date')}
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('end_date')}
              >
                <div className="flex items-center">
                  Fecha Fin
                  {getSortIcon('end_date')}
                </div>
              </TableHead>
              <TableHead>Unidad</TableHead>
              <TableHead>Inquilino</TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('initial_rent_amount')}
              >
                <div className="flex items-center">
                  Monto Inicial
                  {getSortIcon('initial_rent_amount')}
                </div>
              </TableHead>
              <TableHead>Depósito</TableHead>
              <TableHead>Frecuencia</TableHead>
              <TableHead className="w-40">Progreso</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                </TableCell>
              </TableRow>
            ) : sortedContracts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">No hay contratos registrados</p>
                  <Button onClick={() => setCreateDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Crear Primer Contrato
                  </Button>
                </TableCell>
              </TableRow>
            ) : (
              sortedContracts.map((contract) => (
                <TableRow key={contract.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleViewContractDetail(contract.id)}>
                  <TableCell className="font-medium">
                    {contract.start_date}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {contract.end_date}
                  </TableCell>
                  <TableCell className="font-medium">
                    {contract.unit?.unit_number}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {contract.tenant?.name}
                    {contract.tenant?.email && (
                      <div className="text-xs text-muted-foreground">
                        {contract.tenant.email}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium text-green-600">
                    {contract.currency || 'ARS'} {contract.initial_rent_amount.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="font-medium text-blue-600">
                    {contract.deposit_amount ? `${contract.currency_deposit || contract.currency || 'ARS'} ${contract.deposit_amount.toLocaleString('es-ES', { minimumFractionDigits: 2 })}` : '-'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {getFrequencyLabel(contract.rent_increase_frequency)}
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const start = new Date(contract.start_date).getTime()
                      const end = new Date(contract.end_date).getTime()
                      const now = Date.now()
                      const clampedNow = Math.min(Math.max(now, start), end)
                      const total = Math.max(end - start, 1)
                      const progress = Math.round(((clampedNow - start) / total) * 100)
                      return (
                        <div className="w-full">
                          <div className="h-2 w-full bg-muted rounded">
                            <div className="h-2 bg-primary rounded" style={{ width: `${progress}%` }} />
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">{progress}%</div>
                        </div>
                      )
                    })()}
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); handleEditContract(contract) }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={(e) => e.stopPropagation()}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Eliminar Contrato</AlertDialogTitle>
                            <AlertDialogDescription>
                              ¿Estás seguro de que quieres eliminar el contrato de {contract.tenant?.name} para la unidad {contract.unit?.unit_number}?
                              Esta acción no se puede deshacer.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteContract(contract.id)}
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

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Editar Contrato</DialogTitle>
            <DialogDescription>
              Realiza cambios en los detalles del contrato.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit_unit_resident" className="text-right">Inquilino *</Label>
              <Select
                value={selectedUnitResident}
                onValueChange={(value) => setSelectedUnitResident(value)}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Seleccionar inquilino (con unidad asignada)" />
                </SelectTrigger>
                <SelectContent>
                  {unitResidentOptions.map((option) => (
                    <SelectItem key={`${option.unitId}-${option.residentId}`} value={`${option.unitId}-${option.residentId}`}>
                      {option.displayText}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit_start_date" className="text-right">Fecha Inicio *</Label>
              <Input
                id="edit_start_date"
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                className="col-span-3"
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit_end_date" className="text-right">Fecha Fin *</Label>
              <Input
                id="edit_end_date"
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                className="col-span-3"
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit_initial_rent_amount" className="text-right">Monto Inicial *</Label>
              <Input
                id="edit_initial_rent_amount"
                type="number"
                min="0"
                step="0.01"
                value={formData.initial_rent_amount || ''}
                onChange={(e) => {
                  const value = e.target.value
                  setFormData({
                    ...formData,
                    initial_rent_amount: value === '' ? undefined : parseFloat(value) || undefined
                  })
                }}
                className="col-span-3"
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit_currency" className="text-right">Moneda Contrato</Label>
              <Select
                value={formData.currency}
                onValueChange={(value) => setFormData({ ...formData, currency: value })}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Seleccionar moneda" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ARS">ARS (Peso Argentino)</SelectItem>
                  <SelectItem value="USD">USD (Dólar Estadounidense)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit_deposit_amount" className="text-right">Depósito</Label>
              <Input
                id="edit_deposit_amount"
                type="number"
                min="0"
                step="0.01"
                value={formData.deposit_amount || ''}
                onChange={(e) => {
                  const value = e.target.value
                  setFormData({
                    ...formData,
                    deposit_amount: value
                  })
                }}
                className="col-span-3"
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit_currency_deposit" className="text-right">Moneda Depósito</Label>
              <Select
                value={formData.currency_deposit}
                onValueChange={(value) => setFormData({ ...formData, currency_deposit: value })}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Seleccionar moneda depósito" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ARS">ARS (Peso Argentino)</SelectItem>
                  <SelectItem value="USD">USD (Dólar Estadounidense)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit_rent_increase_frequency" className="text-right">Frecuencia Aumento</Label>
              <Select
                value={formData.rent_increase_frequency}
                onValueChange={(value: 'monthly' | 'quarterly' | 'semi-annually' | 'annually') =>
                  setFormData({ ...formData, rent_increase_frequency: value })
                }
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Seleccionar frecuencia" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Mensual</SelectItem>
                  <SelectItem value="quarterly">Trimestral</SelectItem>
                  <SelectItem value="semi-annually">Semestral</SelectItem>
                  <SelectItem value="annually">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit_status" className="text-right">Estado</Label>
              <Select
                value={formData.status}
                onValueChange={(value: 'active' | 'expired' | 'renewed') =>
                  setFormData({ ...formData, status: value })
                }
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Seleccionar estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Activo</SelectItem>
                  <SelectItem value="expired">Expirado</SelectItem>
                  <SelectItem value="renewed">Renovado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit_description" className="text-right">Descripción</Label>
              <Textarea
                id="edit_description"
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="col-span-3"
                placeholder="Agrega notas adicionales sobre el contrato..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit_icl_index_type" className="text-right">Índice</Label>
              <Select
                value={formData.icl_index_type}
                onValueChange={(value) => setFormData({ ...formData, icl_index_type: value })}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Seleccionar índice" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ICL">ICL (Índice de Contratos de Locación)</SelectItem>
                  <SelectItem value="IPC">IPC (Índice de Precios al Consumidor)</SelectItem>
                  <SelectItem value="Average">Promedio (ICL + IPC)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleUpdateContract} disabled={loading}>
              {loading ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Contract Detail Modal */}
      <ContractDetailModal
        open={contractDetailModalOpen}
        onOpenChange={setContractDetailModalOpen}
        contractId={selectedContractId}
      />
    </div>
  )
})

ContractsTable.displayName = 'ContractsTable'

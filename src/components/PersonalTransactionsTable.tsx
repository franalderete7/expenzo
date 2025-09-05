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
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { ArrowUp, ArrowDown, Plus, Edit, Trash2, DollarSign, Filter } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { PersonalTransaction, PersonalTransactionFormData, Property } from '@/types/database'
import { NumberInput } from '@/components/ui/number-input'

interface PersonalTransactionsTableRef {
  openCreateDialog: () => void
}

type SortField = 'transaction_date' | 'amount' | 'category' | 'description' | 'created_at'
type SortDirection = 'asc' | 'desc'

export const PersonalTransactionsTable = forwardRef<PersonalTransactionsTableRef>((props, ref) => {
  const [transactions, setTransactions] = useState<PersonalTransaction[]>([])
  const [loading, setLoading] = useState(false)
  const [sortField, setSortField] = useState<SortField>('transaction_date')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  // Filter states
  const [filterMonth, setFilterMonth] = useState<string>((new Date().getMonth() + 1).toString())
  const [filterYear, setFilterYear] = useState<string>(new Date().getFullYear().toString())
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [totalAmount, setTotalAmount] = useState<number>(0)

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<PersonalTransaction | null>(null)

  // Properties for Edificio category
  const [properties, setProperties] = useState<Property[]>([])

  // Form data
  const [formData, setFormData] = useState<PersonalTransactionFormData>({
    transaction_date: '',
    amount: '',
    description: '',
    category: '',
    property_id: undefined
  })

  useImperativeHandle(ref, () => ({
    openCreateDialog: () => setCreateDialogOpen(true)
  }))

  // Fetch properties for Edificio category
  const fetchProperties = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const response = await fetch('/api/properties', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        }
      })

      if (!response.ok) {
        throw new Error('Failed to fetch properties')
      }

      const data = await response.json()
      setProperties(data.data || [])
    } catch (error) {
      console.error('Error fetching properties:', error)
    }
  }, [])

  const fetchTransactions = useCallback(async () => {
    try {
      setLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        toast.error('No active session')
        return
      }

      const params = new URLSearchParams({
        ...(filterMonth && filterMonth !== 'all' && { month: filterMonth }),
        ...(filterYear && filterYear !== 'all' && { year: filterYear }),
        ...(filterCategory && filterCategory !== 'all' && { category: filterCategory })
      })

      const response = await fetch(`/api/personal-transactions?${params}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        }
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Error fetching transactions')
      }

      const { transactions: fetchedTransactions, total } = await response.json()
      setTransactions(fetchedTransactions || [])
      setTotalAmount(total || 0)
    } catch (error) {
      console.error('Error fetching transactions:', error)
      toast.error(error instanceof Error ? error.message : 'Error fetching transactions')
    } finally {
      setLoading(false)
    }
  }, [filterMonth, filterYear, filterCategory])

  useEffect(() => {
    fetchProperties()
  }, [fetchProperties])

  useEffect(() => {
    fetchTransactions()
  }, [fetchTransactions])

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
  const sortedTransactions = [...transactions].sort((a, b) => {
    const aValue = a[sortField as keyof PersonalTransaction] as string | number
    const bValue = b[sortField as keyof PersonalTransaction] as string | number

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
      transaction_date: '',
      amount: '',
      description: '',
      category: '',
      property_id: undefined
    })
  }

  const handleCreateTransaction = async () => {
    if (!formData.transaction_date) {
      toast.error('La fecha de transacción es requerida')
      return
    }
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      toast.error('El monto debe ser mayor a 0')
      return
    }
    if (!formData.category) {
      toast.error('La categoría es requerida')
      return
    }

    try {
      setLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        toast.error('No active session')
        return
      }

      const response = await fetch('/api/personal-transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          transaction_date: formData.transaction_date,
          amount: formData.amount,
          description: formData.description,
          category: formData.category,
          property_id: formData.property_id
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Error creating transaction')
      }

      toast.success('Transacción creada exitosamente.')
      setCreateDialogOpen(false)
      resetForm()
      fetchTransactions()
    } catch (error) {
      console.error('Error creating transaction:', error)
      toast.error(error instanceof Error ? error.message : 'Error creating transaction')
    } finally {
      setLoading(false)
    }
  }

  const handleEditTransaction = (transaction: PersonalTransaction) => {
    setEditingTransaction(transaction)
    setFormData({
      transaction_date: transaction.transaction_date,
      amount: transaction.amount.toString(),
      description: transaction.description || '',
      category: transaction.category,
      property_id: transaction.property_id
    })
    setEditDialogOpen(true)
  }

  const handleUpdateTransaction = async () => {
    if (!editingTransaction) return

    if (!formData.transaction_date) {
      toast.error('La fecha de transacción es requerida')
      return
    }
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      toast.error('El monto debe ser mayor a 0')
      return
    }
    if (!formData.category) {
      toast.error('La categoría es requerida')
      return
    }

    try {
      setLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        toast.error('No active session')
        return
      }

      const response = await fetch(`/api/personal-transactions/${editingTransaction.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          transaction_date: formData.transaction_date,
          amount: formData.amount,
          description: formData.description,
          category: formData.category,
          property_id: formData.property_id
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Error updating transaction')
      }

      toast.success('Transacción actualizada exitosamente.')
      setEditDialogOpen(false)
      resetForm()
      setEditingTransaction(null)
      fetchTransactions()
    } catch (error) {
      console.error('Error updating transaction:', error)
      toast.error(error instanceof Error ? error.message : 'Error updating transaction')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteTransaction = async (transactionId: number) => {
    try {
      setLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        toast.error('No active session')
        return
      }

      const response = await fetch(`/api/personal-transactions/${transactionId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        }
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Error deleting transaction')
      }

      toast.success('Transacción eliminada exitosamente.')
      fetchTransactions()
    } catch (error) {
      console.error('Error deleting transaction:', error)
      toast.error(error instanceof Error ? error.message : 'Error deleting transaction')
    } finally {
      setLoading(false)
    }
  }

  const getCategoryBadgeVariant = (category: string) => {
    switch (category) {
      case 'Edificio':
        return 'default'
      case 'Luiggi':
        return 'secondary'
      case 'Nosotros':
        return 'outline'
      default:
        return 'outline'
    }
  }

  const clearFilters = () => {
    setFilterMonth((new Date().getMonth() + 1).toString())
    setFilterYear(new Date().getFullYear().toString())
    setFilterCategory('all')
  }

  // Generate years for filter (current year and 5 years back)
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 6 }, (_, i) => currentYear - i)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Transacciones Personales</h2>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="mr-2 h-4 w-4" /> Crear Transacción
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Crear Nueva Transacción</DialogTitle>
              <DialogDescription>
                Agrega una nueva transacción personal.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="transaction_date" className="text-right">Fecha *</Label>
                <Input
                  id="transaction_date"
                  type="date"
                  value={formData.transaction_date}
                  onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
                  className="col-span-3"
                />
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="amount" className="text-right">Monto *</Label>
                <NumberInput
                  id="amount"
                  value={formData.amount}
                  onChange={(value) => setFormData({ ...formData, amount: value })}
                  className="col-span-3"
                  placeholder="0.00"
                />
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="category" className="text-right">Categoría *</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({
                    ...formData,
                    category: value,
                    property_id: value !== 'Edificio' ? undefined : formData.property_id
                  })}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Seleccionar categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Edificio">Edificio</SelectItem>
                    <SelectItem value="Luiggi">Luiggi</SelectItem>
                    <SelectItem value="Nosotros">Nosotros</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.category === 'Edificio' && (
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="property" className="text-right">Edificio *</Label>
                  <Select
                    value={formData.property_id?.toString() || ''}
                    onValueChange={(value) => setFormData({ ...formData, property_id: parseInt(value) })}
                  >
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Seleccionar edificio" />
                    </SelectTrigger>
                    <SelectContent>
                      {properties.map((property) => (
                        <SelectItem key={property.id} value={property.id.toString()}>
                          {property.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="description" className="text-right">Descripción</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="col-span-3"
                  placeholder="Descripción opcional..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleCreateTransaction} disabled={loading}>
                {loading ? 'Creando...' : 'Crear Transacción'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
        <div className="flex items-center gap-4">
          <Filter className="h-5 w-5 text-muted-foreground" />
          <span className="font-medium">Filtros:</span>

          <Select value={filterYear} onValueChange={setFilterYear}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Año" />
            </SelectTrigger>
            <SelectContent>
              {years.map(year => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterMonth} onValueChange={setFilterMonth}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Mes" />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                <SelectItem key={month} value={month.toString()}>
                  {new Date(0, month - 1).toLocaleString('es-ES', { month: 'long' })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Categoría" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las categorías</SelectItem>
              <SelectItem value="Edificio">Edificio</SelectItem>
              <SelectItem value="Luiggi">Luiggi</SelectItem>
              <SelectItem value="Nosotros">Nosotros</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" onClick={clearFilters}>
            Limpiar
          </Button>
        </div>

        {/* Total Display */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Total:</span>
          <span className="font-bold text-green-600">
            ${totalAmount.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('transaction_date')}
              >
                <div className="flex items-center">
                  Fecha
                  {getSortIcon('transaction_date')}
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('amount')}
              >
                <div className="flex items-center">
                  Monto
                  {getSortIcon('amount')}
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('category')}
              >
                <div className="flex items-center">
                  Categoría
                  {getSortIcon('category')}
                </div>
              </TableHead>
              <TableHead>Edificio</TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('description')}
              >
                <div className="flex items-center">
                  Descripción
                  {getSortIcon('description')}
                </div>
              </TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                </TableCell>
              </TableRow>
            ) : sortedTransactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">No hay transacciones registradas</p>
                  <Button onClick={() => setCreateDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Crear Primera Transacción
                  </Button>
                </TableCell>
              </TableRow>
            ) : (
              sortedTransactions.map((transaction) => (
                <TableRow key={transaction.id}>
                  <TableCell className="font-medium">
                    {new Date(transaction.transaction_date).toLocaleDateString('es-ES')}
                  </TableCell>
                  <TableCell className="font-medium text-green-600">
                    ${transaction.amount.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getCategoryBadgeVariant(transaction.category)}>
                      {transaction.category}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {transaction.property?.name || '-'}
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-xs truncate">
                    {transaction.description || '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditTransaction(transaction)}
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
                            <AlertDialogTitle>Eliminar Transacción</AlertDialogTitle>
                            <AlertDialogDescription>
                              ¿Estás seguro de que quieres eliminar esta transacción de ${transaction.amount.toLocaleString('es-ES', { minimumFractionDigits: 2 })}?
                              Esta acción no se puede deshacer.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteTransaction(transaction.id)}
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
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Editar Transacción</DialogTitle>
            <DialogDescription>
              Modifica los detalles de la transacción.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit_transaction_date" className="text-right">Fecha *</Label>
              <Input
                id="edit_transaction_date"
                type="date"
                value={formData.transaction_date}
                onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
                className="col-span-3"
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit_amount" className="text-right">Monto *</Label>
              <NumberInput
                id="edit_amount"
                value={formData.amount}
                onChange={(value) => setFormData({ ...formData, amount: value })}
                className="col-span-3"
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit_category" className="text-right">Categoría *</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({
                  ...formData,
                  category: value,
                  property_id: value !== 'Edificio' ? undefined : formData.property_id
                })}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Seleccionar categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Edificio">Edificio</SelectItem>
                  <SelectItem value="Luiggi">Luiggi</SelectItem>
                  <SelectItem value="Nosotros">Nosotros</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.category === 'Edificio' && (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit_property" className="text-right">Edificio *</Label>
                <Select
                  value={formData.property_id?.toString() || ''}
                  onValueChange={(value) => setFormData({ ...formData, property_id: parseInt(value) })}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Seleccionar edificio" />
                  </SelectTrigger>
                  <SelectContent>
                    {properties.map((property) => (
                      <SelectItem key={property.id} value={property.id.toString()}>
                        {property.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit_description" className="text-right">Descripción</Label>
              <Textarea
                id="edit_description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="col-span-3"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleUpdateTransaction} disabled={loading}>
              {loading ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
})

PersonalTransactionsTable.displayName = 'PersonalTransactionsTable'

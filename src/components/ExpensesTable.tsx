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
import { ArrowUp, ArrowDown, Plus, Edit, Trash2, DollarSign, Filter, Download, FileSpreadsheet } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useProperty } from '@/contexts/PropertyContext'
import { Expense, ExpenseFormData } from '@/types/entities'
import * as XLSX from 'xlsx'
import Papa from 'papaparse'

interface ExpensesTableRef {
  openCreateDialog: () => void
}

type SortField = 'expense_type' | 'amount' | 'date' | 'description' | 'created_at'
type SortDirection = 'asc' | 'desc'

export const ExpensesTable = forwardRef<ExpensesTableRef>((props, ref) => {
  const { selectedProperty } = useProperty()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(false)
  const [sortField, setSortField] = useState<SortField>('date')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  // Filter states
  const [filterMonth, setFilterMonth] = useState<string>((new Date().getMonth() + 1).toString())
  const [filterYear, setFilterYear] = useState<string>(new Date().getFullYear().toString())
  const [monthlyTotal, setMonthlyTotal] = useState<number>(0)

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)

  // Form data
  const [formData, setFormData] = useState<ExpenseFormData>({
    property_id: 0,
    expense_type: '',
    amount: 0,
    date: '',
    description: ''
  })

  useImperativeHandle(ref, () => ({
    openCreateDialog: () => setCreateDialogOpen(true)
  }))

  const fetchExpenses = useCallback(async () => {
    if (!selectedProperty) return

    try {
      setLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        toast.error('No active session')
        return
      }

      const params = new URLSearchParams({
        property_id: selectedProperty.id.toString(),
        ...(filterMonth && filterMonth !== 'all' && { month: filterMonth }),
        ...(filterYear && filterYear !== 'all' && { year: filterYear })
      })

      const response = await fetch(`/api/expenses?${params}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        }
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Error fetching expenses')
      }

      const { expenses: fetchedExpenses, monthlyTotal: fetchedMonthlyTotal } = await response.json()

      // Store unsorted expenses - sorting will be done client-side
      setExpenses(fetchedExpenses || [])
      const numericMonthlyTotal =
        typeof fetchedMonthlyTotal === 'string'
          ? parseFloat(fetchedMonthlyTotal) || 0
          : typeof fetchedMonthlyTotal === 'number'
            ? fetchedMonthlyTotal
            : 0
      setMonthlyTotal(numericMonthlyTotal)
    } catch (error) {
      console.error('Error fetching expenses:', error)
      toast.error(error instanceof Error ? error.message : 'Error fetching expenses')
    } finally {
      setLoading(false)
    }
  }, [selectedProperty, filterMonth, filterYear])

  useEffect(() => {
    fetchExpenses()
  }, [fetchExpenses])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const resetForm = () => {
    setFormData({
      property_id: selectedProperty?.id || 0,
      expense_type: '',
      amount: 0,
      date: '',
      description: ''
    })
  }

  const handleCreateExpense = async () => {
    if (!selectedProperty) {
      toast.error('Selecciona una propiedad para crear un gasto.')
      return
    }

    if (!formData.expense_type.trim()) {
      toast.error('El tipo de gasto es requerido')
      return
    }
    if (!formData.amount || formData.amount <= 0) {
      toast.error('El monto debe ser mayor a 0')
      return
    }
    if (!formData.date) {
      toast.error('La fecha es requerida')
      return
    }

    try {
      setLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        toast.error('No active session')
        return
      }

      const response = await fetch('/api/expenses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          property_id: selectedProperty.id,
          expense_type: formData.expense_type.trim(),
          amount: formData.amount,
          date: formData.date,
          description: formData.description?.trim() || null
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Error creating expense')
      }

      toast.success('Gasto creado exitosamente.')
      setCreateDialogOpen(false)
      resetForm()
      fetchExpenses()
    } catch (error) {
      console.error('Error creating expense:', error)
      toast.error(error instanceof Error ? error.message : 'Error creating expense')
    } finally {
      setLoading(false)
    }
  }

  const handleEditExpense = (expense: Expense) => {
    setEditingExpense(expense)
    setFormData({
      property_id: expense.property_id,
      expense_type: expense.expense_type,
      amount: expense.amount,
      date: expense.date,
      description: expense.description || ''
    })
    setEditDialogOpen(true)
  }

  const handleUpdateExpense = async () => {
    if (!editingExpense) return

    if (!formData.expense_type.trim()) {
      toast.error('El tipo de gasto es requerido')
      return
    }
    if (!formData.amount || formData.amount <= 0) {
      toast.error('El monto debe ser mayor a 0')
      return
    }
    if (!formData.date) {
      toast.error('La fecha es requerida')
      return
    }

    try {
      setLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        toast.error('No active session')
        return
      }

      const response = await fetch(`/api/expenses/${editingExpense.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          expense_type: formData.expense_type.trim(),
          amount: formData.amount,
          date: formData.date,
          description: formData.description?.trim() || null
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Error updating expense')
      }

      toast.success('Gasto actualizado exitosamente.')
      setEditDialogOpen(false)
      resetForm()
      setEditingExpense(null)
      fetchExpenses()
    } catch (error) {
      console.error('Error updating expense:', error)
      toast.error(error instanceof Error ? error.message : 'Error updating expense')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteExpense = async (expenseId: number) => {
    try {
      setLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        toast.error('No active session')
        return
      }

      const response = await fetch(`/api/expenses/${expenseId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        }
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Error deleting expense')
      }

      toast.success('Gasto eliminado exitosamente.')
      fetchExpenses()
    } catch (error) {
      console.error('Error deleting expense:', error)
      toast.error(error instanceof Error ? error.message : 'Error deleting expense')
    } finally {
      setLoading(false)
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
  const sortedExpenses = [...expenses].sort((a, b) => {
    const aValue = a[sortField as keyof Expense]
    const bValue = b[sortField as keyof Expense]

    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortDirection === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue)
    }
    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue
    }
    return 0
  })

  const getExpenseTypeBadgeVariant = (type: string) => {
    const colors = ['default', 'secondary', 'destructive', 'outline'] as const
    return colors[Math.abs(type.length) % colors.length]
  }

  const clearFilters = () => {
    setFilterMonth((new Date().getMonth() + 1).toString())
    setFilterYear(new Date().getFullYear().toString())
  }

  // Generate years for filter (current year and 5 years back)
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 6 }, (_, i) => currentYear - i)

  // Export functions
  const getMonthName = (monthNumber: string) => {
    const months = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ]
    return months[parseInt(monthNumber) - 1] || monthNumber
  }

  const prepareExportData = () => {
    const exportData = sortedExpenses.map(expense => ({
      'Tipo': expense.expense_type,
      'Monto': expense.amount,
      'Fecha': new Date(expense.date).toLocaleDateString('es-ES'),
      'Descripción': expense.description || ''
    }))

    // Add total row
    const totalAmount = sortedExpenses.reduce((sum, expense) => sum + expense.amount, 0)
    exportData.push({
      'Tipo': 'TOTAL',
      'Monto': totalAmount,
      'Fecha': '',
      'Descripción': `Total de ${sortedExpenses.length} gastos`
    })

    return exportData
  }

  const exportToCSV = () => {
    try {
      const exportData = prepareExportData()
      const csvContent = Papa.unparse(exportData)

      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', `Expensas_${filterYear}_${getMonthName(filterMonth)}.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast.success('Archivo CSV exportado exitosamente')
    } catch (error) {
      console.error('Error exporting CSV:', error)
      toast.error('Error al exportar CSV')
    }
  }

  const exportToExcel = () => {
    try {
      const exportData = prepareExportData()

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(exportData)

      // Auto-size columns
      const colWidths = [
        { wch: 20 }, // Tipo
        { wch: 15 }, // Monto
        { wch: 12 }, // Fecha
        { wch: 30 }  // Descripción
      ]
      ws['!cols'] = colWidths

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Expensas')

      // Save file
      XLSX.writeFile(wb, `Expensas_${filterYear}_${getMonthName(filterMonth)}.xlsx`)

      toast.success('Archivo Excel exportado exitosamente')
    } catch (error) {
      console.error('Error exporting Excel:', error)
      toast.error('Error al exportar Excel')
    }
  }



  if (!selectedProperty) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Selecciona una propiedad para ver los gastos.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Gastos</h2>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="mr-2 h-4 w-4" /> Crear Gasto
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Crear Nuevo Gasto</DialogTitle>
              <DialogDescription>
                Completa los detalles para añadir un nuevo gasto.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="expense_type" className="text-right">
                  Tipo
                </Label>
                <Input
                  id="expense_type"
                  value={formData.expense_type}
                  onChange={(e) => setFormData({ ...formData, expense_type: e.target.value })}
                  className="col-span-3"
                  placeholder="Ej: Mantenimiento, Servicios, etc."
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="amount" className="text-right">
                  Monto
                </Label>
                <Input
                  id="amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                  className="col-span-3"
                  placeholder="0.00"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="date" className="text-right">
                  Fecha
                </Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="description" className="text-right">
                  Descripción
                </Label>
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
              <Button onClick={handleCreateExpense} disabled={loading}>
                {loading ? 'Creando...' : 'Crear Gasto'}
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

          <Button variant="outline" onClick={clearFilters}>
            Restablecer
          </Button>

          {/* Export Buttons */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={exportToCSV}
              disabled={expenses.length === 0}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={exportToExcel}
              disabled={expenses.length === 0}
              className="flex items-center gap-2"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Excel
            </Button>
          </div>
        </div>

        {/* Monthly Total Display - only when filtered by month and year */}
        {filterMonth && filterYear && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Total del mes:</span>
            <span className="font-bold text-green-600">
              ${monthlyTotal.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
            </span>
          </div>
        )}
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('expense_type')}
              >
                <div className="flex items-center">
                  Tipo
                  {getSortIcon('expense_type')}
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
                onClick={() => handleSort('date')}
              >
                <div className="flex items-center">
                  Fecha
                  {getSortIcon('date')}
                </div>
              </TableHead>
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
                <TableCell colSpan={5} className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                </TableCell>
              </TableRow>
            ) : expenses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">No hay gastos registrados</p>
                  <Button onClick={() => setCreateDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Crear Primer Gasto
                  </Button>
                </TableCell>
              </TableRow>
            ) : (
              sortedExpenses.map((expense) => (
                <TableRow key={expense.id}>
                  <TableCell className="font-medium">
                    <Badge variant={getExpenseTypeBadgeVariant(expense.expense_type)}>
                      {expense.expense_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium text-green-600">
                    ${expense.amount.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(expense.date).toLocaleDateString('es-ES')}
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-xs truncate">
                    {expense.description || '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditExpense(expense)}
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
                            <AlertDialogTitle>Eliminar Gasto</AlertDialogTitle>
                            <AlertDialogDescription>
                              ¿Estás seguro de que quieres eliminar el gasto &quot;{expense.expense_type}&quot; de ${expense.amount.toLocaleString('es-ES', { minimumFractionDigits: 2 })}?
                              Esta acción no se puede deshacer.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteExpense(expense.id)}
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
            <DialogTitle>Editar Gasto</DialogTitle>
            <DialogDescription>
              Realiza cambios en los detalles del gasto.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit_expense_type" className="text-right">
                Tipo
              </Label>
              <Input
                id="edit_expense_type"
                value={formData.expense_type}
                onChange={(e) => setFormData({ ...formData, expense_type: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit_amount" className="text-right">
                Monto
              </Label>
              <Input
                id="edit_amount"
                type="number"
                min="0"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit_date" className="text-right">
                Fecha
              </Label>
              <Input
                id="edit_date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit_description" className="text-right">
                Descripción
              </Label>
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
            <Button onClick={handleUpdateExpense} disabled={loading}>
              {loading ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
})

ExpensesTable.displayName = 'ExpensesTable'

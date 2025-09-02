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
import { ArrowUp, ArrowDown, Plus, Edit, Trash2, DollarSign, Filter, Download, FileSpreadsheet, Calendar, Settings, X } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useProperty } from '@/contexts/PropertyContext'
import { Expense, ExpenseFormData, ExpenseCategory } from '@/types/entities'
import * as XLSX from 'xlsx'
import Papa from 'papaparse'

interface ExpensesTableRef {
  openCreateDialog: () => void
}

type SortField = 'expense_type' | 'category' | 'amount' | 'date' | 'description' | 'created_at'
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
  const [honorariosDialogOpen, setHonorariosDialogOpen] = useState(false)

  // Honorarios calculation state
  const [honorariosPercentage, setHonorariosPercentage] = useState<number>(4)
  const [honorariosTotal, setHonorariosTotal] = useState<number>(0)
  const [honorariosAmount, setHonorariosAmount] = useState<number>(0)
  const [calculatingHonorarios, setCalculatingHonorarios] = useState(false)

  // Expense categories state
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([])
  const [showCategoryManager, setShowCategoryManager] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [loadingCategories, setLoadingCategories] = useState(false)

  // Form data
  const [formData, setFormData] = useState<ExpenseFormData>({
    property_id: 0,
    expense_type: '', // Keep for backward compatibility
    category: '', // New field for category selection
    amount: '', // Start with empty string for better UX
    date: '',
    description: ''
  })

  // Fetch expense categories
  const fetchExpenseCategories = useCallback(async () => {
    try {
      setLoadingCategories(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const response = await fetch('/api/expense-categories', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        }
      })

      if (!response.ok) {
        throw new Error('Error fetching categories')
      }

      const data = await response.json()
      const categories = data.categories || []
      setExpenseCategories(Array.isArray(categories) ? categories : [])
    } catch (error) {
      console.error('Error fetching expense categories:', error)
      toast.error('Error loading categories')
    } finally {
      setLoadingCategories(false)
    }
  }, [])

  // Add new expense category
  const addExpenseCategory = async () => {
    if (!newCategoryName.trim()) {
      toast.error('El nombre de la categoría es requerido')
      return
    }

    if (expenseCategories && expenseCategories.some(cat => cat.name && cat.name.toLowerCase() === newCategoryName.trim().toLowerCase())) {
      toast.error('Esta categoría ya existe')
      return
    }

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const response = await fetch('/api/expense-categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          name: newCategoryName.trim()
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Error creating category')
      }

      const { category } = await response.json()
      setExpenseCategories(prev => Array.isArray(prev) ? [...prev, category] : [category])
      setNewCategoryName('')
      toast.success('Categoría agregada')
    } catch (error) {
      console.error('Error adding expense category:', error)
      toast.error(error instanceof Error ? error.message : 'Error adding category')
    }
  }

  // Delete expense category
  const deleteExpenseCategory = async (categoryId: number) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const response = await fetch(`/api/expense-categories/${categoryId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        }
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Error deleting category')
      }

      setExpenseCategories(prev => Array.isArray(prev) ? prev.filter(cat => cat.id !== categoryId) : [])
      toast.success('Categoría eliminada')
    } catch (error) {
      console.error('Error deleting expense category:', error)
      toast.error(error instanceof Error ? error.message : 'Error deleting category')
    }
  }

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

  // Fetch expense categories on mount
  useEffect(() => {
    fetchExpenseCategories()
  }, [fetchExpenseCategories])

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
      expense_type: '', // Keep for backward compatibility
      category: '',
      amount: '',
      date: '',
      description: ''
    })
  }

  const handleCreateExpense = async () => {
    if (!selectedProperty) {
      toast.error('Selecciona una propiedad para crear un gasto.')
      return
    }

    if (!formData.category?.trim()) {
      toast.error('La categoría de gasto es requerida')
      return
    }
    const amountValue = formData.amount === '' ? 0 : parseFloat(formData.amount.toString())
    if (!formData.amount || amountValue <= 0) {
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
          category: formData.category.trim(),
          amount: amountValue,
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

      // Small delay to ensure database transaction completes, then refresh
      setTimeout(() => {
        fetchExpenses()
      }, 500)
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
      expense_type: expense.expense_type || '', // Keep for backward compatibility
      category: expense.category || expense.expense_type || '',
      amount: expense.amount.toString(),
      date: expense.date, // Already in YYYY-MM-DD format for HTML5 date input
      description: expense.description || ''
    })
    setEditDialogOpen(true)
  }

  const handleUpdateExpense = async () => {
    if (!editingExpense) return

    if (!formData.category?.trim()) {
      toast.error('La categoría de gasto es requerida')
      return
    }
    const amountValue = formData.amount === '' ? 0 : parseFloat(formData.amount.toString())
    if (!formData.amount || amountValue <= 0) {
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
          category: formData.category.trim(),
          amount: amountValue,
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

      // Small delay to ensure database transaction completes, then refresh
      setTimeout(() => {
        fetchExpenses()
      }, 500)
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

      // Small delay to ensure database transaction completes, then refresh
      setTimeout(() => {
        fetchExpenses()
      }, 500)
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
  const sortedExpenses = (expenses && Array.isArray(expenses) ? [...expenses] : []).sort((a, b) => {
    if (!a || !b) return 0

    let aValue: string | number | undefined = a[sortField as keyof Expense] as string | number | undefined
    let bValue: string | number | undefined = b[sortField as keyof Expense] as string | number | undefined

    // Special handling for category field - fall back to expense_type if category is null
    if (sortField === 'category') {
      aValue = a.category || a.expense_type || ''
      bValue = b.category || b.expense_type || ''
    }

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
    if (!type || typeof type !== 'string') {
      return colors[0] // Return default if type is undefined/null/invalid
    }
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
    const exportData = (sortedExpenses || []).filter(expense => expense).map(expense => ({
      'Tipo': expense.category || expense.expense_type || 'Otros',
      'Monto': expense.amount || 0,
      'Fecha': expense.date ? new Date(expense.date).toLocaleDateString('es-ES') : '',
      'Descripción': expense.description || ''
    }))

    // Add total row
    const totalAmount = (sortedExpenses || []).reduce((sum, expense) => sum + (expense?.amount || 0), 0)
    exportData.push({
      'Tipo': 'TOTAL',
      'Monto': totalAmount,
      'Fecha': '',
      'Descripción': `Total de ${(sortedExpenses || []).length} gastos`
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

  const calculateHonorarios = async () => {
    if (!selectedProperty) return

    try {
      setCalculatingHonorarios(true)

      // Get the current session token
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        toast.error('No active session')
        return
      }

      // Fetch total expenses for the current filtered month/year
      const response = await fetch(
        `/api/expenses?property_id=${selectedProperty.id}&month=${filterMonth}&year=${filterYear}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      )

      if (!response.ok) {
        throw new Error('Error fetching expenses')
      }

      const data = await response.json()
      const totalExpenses = data.expenses?.reduce((sum: number, expense: Expense) =>
        sum + Number(expense.amount), 0) || 0

      // Exclude any existing "Honorarios Administrador" expenses from the total
      const honorariosExpenses = data.expenses?.filter((expense: Expense) =>
        (expense.category || expense.expense_type || '').toLowerCase().includes('honorarios') ||
        (expense.category || expense.expense_type || '').toLowerCase().includes('administrador')
      ) || []

      const honorariosTotal = honorariosExpenses.reduce((sum: number, expense: Expense) =>
        sum + Number(expense.amount), 0)

      const baseTotal = totalExpenses - honorariosTotal
      const calculatedAmount = Math.round((baseTotal * honorariosPercentage) / 100 * 100) / 100

      setHonorariosTotal(baseTotal)
      setHonorariosAmount(calculatedAmount)

    } catch (error) {
      console.error('Error calculating honorarios:', error)
      toast.error('Error calculando honorarios')
    } finally {
      setCalculatingHonorarios(false)
    }
  }

  const createHonorariosExpense = async () => {
    if (!selectedProperty) return

    try {
      setCalculatingHonorarios(true)

      // Get the current session token
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        toast.error('No active session')
        return
      }

      // Create the expense
      const expenseData = {
        property_id: selectedProperty.id,
        category: 'Honorarios Administrador',
        amount: honorariosAmount,
        date: `${filterYear}-${filterMonth.padStart(2, '0')}-01`,
        description: `Honorarios calculados automáticamente (${honorariosPercentage}% de gastos totales: $${honorariosTotal.toLocaleString('es-ES')})`
      }

      const response = await fetch('/api/expenses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(expenseData)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Error creating expense')
      }

      await response.json()

      toast.success('Honorarios creados exitosamente')
      setHonorariosDialogOpen(false)

      // Longer delay to ensure database transaction completes, then refresh
      setTimeout(() => {
        console.log('🔄 Refreshing expenses after honorarios creation...')
        fetchExpenses()
      }, 1000)

    } catch (error) {
      console.error('Error creating honorarios expense:', error)
      toast.error(error instanceof Error ? error.message : 'Error creando gasto de honorarios')
    } finally {
      setCalculatingHonorarios(false)
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
        <div className="flex gap-2">
          <Dialog open={honorariosDialogOpen} onOpenChange={setHonorariosDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" onClick={() => {
                calculateHonorarios()
              }}>
                <DollarSign className="mr-2 h-4 w-4" />
                Calcular Honorarios
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Calcular Honorarios Administrador</DialogTitle>
                <DialogDescription>
                  Calcula automáticamente los honorarios basados en el porcentaje de gastos totales del mes filtrado.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="bg-blue-50 p-3 rounded-lg border">
                  <div className="text-sm text-blue-800">
                    <div className="flex justify-between mb-1">
                      <span>Período:</span>
                      <span className="font-semibold">{getMonthName(filterMonth)} {filterYear}</span>
                    </div>
                    <div className="text-xs text-blue-600">
                      Los honorarios se calcularán para el mes actualmente filtrado
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="honorarios_percentage" className="text-right">
                    Porcentaje
                  </Label>
                  <Input
                    id="honorarios_percentage"
                    type="number"
                    value={honorariosPercentage}
                    onChange={(e) => setHonorariosPercentage(parseFloat(e.target.value) || 4)}
                    className="col-span-3"
                    min="0"
                    max="20"
                    step="0.01"
                  />
                </div>
                <div className="bg-muted p-4 rounded-lg">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Gastos Totales:</span>
                      <span className="font-semibold">
                        ${honorariosTotal.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Honorarios ({honorariosPercentage}%):</span>
                      <span className="font-semibold text-green-600">
                        ${honorariosAmount.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setHonorariosDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={createHonorariosExpense}
                  disabled={calculatingHonorarios || honorariosAmount <= 0}
                >
                  {calculatingHonorarios ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Creando...
                    </>
                  ) : (
                    <>
                      <Plus className="mr-2 h-4 w-4" />
                      Crear Gasto
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

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
                  Categoría *
                </Label>
                <div className="col-span-3 flex gap-2">
                  <Select
                    value={formData.category}
                    onValueChange={(value) => setFormData({ ...formData, category: value })}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Seleccionar categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      {expenseCategories && expenseCategories.length > 0 ? (
                        expenseCategories.map((category) => (
                          <SelectItem key={category.id} value={category.name}>
                            {category.name}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="" disabled>
                          Cargando categorías...
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowCategoryManager(true)}
                    className="px-3"
                  >
                    <Settings className="w-4 h-4" />
                  </Button>
                </div>
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
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="col-span-3"
                  placeholder="0.00"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="date" className="text-right">
                  Fecha
                </Label>
                <div className="col-span-3 relative">
                  <Input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    placeholder=""
                    className="pr-10"
                  />
                  <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  {formData.date === '' && (
                    <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground pointer-events-none text-sm">
                    </div>
                  )}
                </div>
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
                onClick={() => handleSort('category')}
              >
                <div className="flex items-center">
                  Categoría
                  {getSortIcon('category')}
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
                    <Badge variant={getExpenseTypeBadgeVariant(expense.category || expense.expense_type || 'Otros')}>
                      {expense.category || expense.expense_type || 'Otros'}
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
                              ¿Estás seguro de que quieres eliminar el gasto &quot;{expense.category || expense.expense_type || 'Sin categoría'}&quot; de ${expense.amount.toLocaleString('es-ES', { minimumFractionDigits: 2 })}?
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
                Categoría *
              </Label>
              <div className="col-span-3 flex gap-2">
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Seleccionar categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {expenseCategories && expenseCategories.length > 0 ? (
                      expenseCategories.map((category) => (
                        <SelectItem key={category.id} value={category.name}>
                          {category.name}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="" disabled>
                        Cargando categorías...
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCategoryManager(true)}
                  className="px-3"
                >
                  <Settings className="w-4 h-4" />
                </Button>
              </div>
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
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="col-span-3"
                placeholder="0.00"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit_date" className="text-right">
                Fecha
              </Label>
              <div className="col-span-3 relative">
                <Input
                  id="edit_date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  placeholder=""
                  className="pr-10"
                />
                <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                {formData.date === '' && (
                  <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground pointer-events-none text-sm">
                    DD/MM/YYYY
                  </div>
                )}
              </div>
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

      {/* Category Management Modal */}
      <Dialog open={showCategoryManager} onOpenChange={setShowCategoryManager}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Gestionar Categorías</DialogTitle>
            <DialogDescription>
              Agrega, elimina o administra las categorías de gastos disponibles.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Add new category */}
            <div className="flex gap-2">
              <Input
                placeholder="Nueva categoría..."
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addExpenseCategory()}
              />
              <Button
                onClick={addExpenseCategory}
                disabled={!newCategoryName.trim() || loadingCategories}
              >
                <Plus className="w-4 h-4 mr-1" />
                Agregar
              </Button>
            </div>

            {/* Existing categories */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Categorías existentes:</Label>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {expenseCategories && expenseCategories.length > 0 ? (
                  expenseCategories.map((category) => (
                    <div
                      key={category.id}
                      className="flex items-center justify-between p-2 bg-muted rounded-md"
                    >
                      <span className="text-sm">{category.name}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteExpenseCategory(category.id)}
                        className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ))
                ) : (
                  <div className="p-4 text-center text-muted-foreground">
                    {loadingCategories ? 'Cargando categorías...' : 'No hay categorías disponibles'}
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCategoryManager(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
})

ExpensesTable.displayName = 'ExpensesTable'

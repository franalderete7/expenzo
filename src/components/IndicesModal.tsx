'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { Badge } from '@/components/ui/badge'

import { Plus, Edit, Trash2, TrendingUp } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'

interface ICLValue {
  id: number
  period_month: number
  period_year: number
  icl_value: number
  created_at: string
  updated_at: string
}

interface IPCValue {
  id: number
  period_month: number
  period_year: number
  ipc_value: number
  created_at: string
  updated_at: string
}

interface IndicesModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const monthNames = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

export function IndicesModal({ open, onOpenChange }: IndicesModalProps) {
  const [iclValues, setIclValues] = useState<ICLValue[]>([])
  const [ipcValues, setIpcValues] = useState<IPCValue[]>([])
  const [loading, setLoading] = useState(false)
  const [isICLDialogOpen, setIsICLDialogOpen] = useState(false)
  const [isIPCDialogOpen, setIsIPCDialogOpen] = useState(false)
  const [editingICL, setEditingICL] = useState<ICLValue | null>(null)
  const [editingIPC, setEditingIPC] = useState<IPCValue | null>(null)

  const [iclFormData, setIclFormData] = useState({
    period_month: '',
    period_year: new Date().getFullYear().toString(),
    icl_value: ''
  })

  const [ipcFormData, setIpcFormData] = useState({
    period_month: '',
    period_year: new Date().getFullYear().toString(),
    ipc_value: ''
  })

  const fetchIndices = async () => {
    try {
      setLoading(true)

      // Fetch ICL values
      const iclResponse = await fetch('/api/icl-values')
      const iclData = await iclResponse.json()
      setIclValues(iclData.iclValues || [])

      // Fetch IPC values
      const ipcResponse = await fetch('/api/ipc-values')
      const ipcData = await ipcResponse.json()
      setIpcValues(ipcData.ipcValues || [])
    } catch (error) {
      console.error('Error fetching indices:', error)
      toast.error('Error loading indices')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      fetchIndices()
    }
  }, [open])

  const handleCreateICL = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        toast.error('No active session')
        return
      }

      const response = await fetch('/api/icl-values', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          period_month: parseInt(iclFormData.period_month),
          period_year: parseInt(iclFormData.period_year),
          icl_value: parseFloat(iclFormData.icl_value)
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Error creating ICL value')
      }

      toast.success('Valor ICL creado exitosamente')
      setIsICLDialogOpen(false)
      resetICLForm()
      fetchIndices()
    } catch (error) {
      console.error('Error creating ICL value:', error)
      toast.error(error instanceof Error ? error.message : 'Error creating ICL value')
    }
  }

  const handleCreateIPC = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        toast.error('No active session')
        return
      }

      const response = await fetch('/api/ipc-values', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          period_month: parseInt(ipcFormData.period_month),
          period_year: parseInt(ipcFormData.period_year),
          ipc_value: parseFloat(ipcFormData.ipc_value)
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Error creating IPC value')
      }

      toast.success('Valor IPC creado exitosamente')
      setIsIPCDialogOpen(false)
      resetIPCForm()
      fetchIndices()
    } catch (error) {
      console.error('Error creating IPC value:', error)
      toast.error(error instanceof Error ? error.message : 'Error creating IPC value')
    }
  }

  const handleUpdateICL = async () => {
    if (!editingICL) return

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        toast.error('No active session')
        return
      }

      const response = await fetch(`/api/icl-values/${editingICL.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          period_month: parseInt(iclFormData.period_month),
          period_year: parseInt(iclFormData.period_year),
          icl_value: parseFloat(iclFormData.icl_value)
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Error updating ICL value')
      }

      toast.success('Valor ICL actualizado exitosamente')
      setIsICLDialogOpen(false)
      setEditingICL(null)
      resetICLForm()
      fetchIndices()
    } catch (error) {
      console.error('Error updating ICL value:', error)
      toast.error(error instanceof Error ? error.message : 'Error updating ICL value')
    }
  }

  const handleUpdateIPC = async () => {
    if (!editingIPC) return

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        toast.error('No active session')
        return
      }

      const response = await fetch(`/api/ipc-values/${editingIPC.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          period_month: parseInt(ipcFormData.period_month),
          period_year: parseInt(ipcFormData.period_year),
          ipc_value: parseFloat(ipcFormData.ipc_value)
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Error updating IPC value')
      }

      toast.success('Valor IPC actualizado exitosamente')
      setIsIPCDialogOpen(false)
      setEditingIPC(null)
      resetIPCForm()
      fetchIndices()
    } catch (error) {
      console.error('Error updating IPC value:', error)
      toast.error(error instanceof Error ? error.message : 'Error updating IPC value')
    }
  }

  const handleDeleteICL = async (iclId: number) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        toast.error('No active session')
        return
      }

      const response = await fetch(`/api/icl-values/${iclId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        }
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Error deleting ICL value')
      }

      toast.success('Valor ICL eliminado exitosamente')
      fetchIndices()
    } catch (error) {
      console.error('Error deleting ICL value:', error)
      toast.error(error instanceof Error ? error.message : 'Error deleting ICL value')
    }
  }

  const handleDeleteIPC = async (ipcId: number) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        toast.error('No active session')
        return
      }

      const response = await fetch(`/api/ipc-values/${ipcId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        }
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Error deleting IPC value')
      }

      toast.success('Valor IPC eliminado exitosamente')
      fetchIndices()
    } catch (error) {
      console.error('Error deleting IPC value:', error)
      toast.error(error instanceof Error ? error.message : 'Error deleting IPC value')
    }
  }

  const resetICLForm = () => {
    setIclFormData({
      period_month: '',
      period_year: new Date().getFullYear().toString(),
      icl_value: ''
    })
  }

  const resetIPCForm = () => {
    setIpcFormData({
      period_month: '',
      period_year: new Date().getFullYear().toString(),
      ipc_value: ''
    })
  }

  const handleEditICL = (icl: ICLValue) => {
    setEditingICL(icl)
    setIclFormData({
      period_month: icl.period_month.toString(),
      period_year: icl.period_year.toString(),
      icl_value: icl.icl_value.toString()
    })
    setIsICLDialogOpen(true)
  }

  const handleEditIPC = (ipc: IPCValue) => {
    setEditingIPC(ipc)
    setIpcFormData({
      period_month: ipc.period_month.toString(),
      period_year: ipc.period_year.toString(),
      ipc_value: ipc.ipc_value.toString()
    })
    setIsIPCDialogOpen(true)
  }

  const handleICLDialogClose = () => {
    setIsICLDialogOpen(false)
    setEditingICL(null)
    resetICLForm()
  }

  const handleIPCDialogClose = () => {
    setIsIPCDialogOpen(false)
    setEditingIPC(null)
    resetIPCForm()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Índices Económicos
          </DialogTitle>
          <DialogDescription>
            Gestiona los valores del ICL (Índice de Contratos de Locación) y IPC (Índice de Precios al Consumidor)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-8">
          {/* ICL Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Valores ICL</h3>
              <Dialog open={isICLDialogOpen} onOpenChange={handleICLDialogClose}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Nuevo ICL
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      {editingICL ? 'Editar Valor ICL' : 'Crear Nuevo Valor ICL'}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="icl_month">Mes</Label>
                        <Select
                          value={iclFormData.period_month}
                          onValueChange={(value) => setIclFormData({ ...iclFormData, period_month: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar mes" />
                          </SelectTrigger>
                          <SelectContent>
                            {monthNames.map((month, index) => (
                              <SelectItem key={index + 1} value={(index + 1).toString()}>
                                {month}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="icl_year">Año</Label>
                        <Input
                          id="icl_year"
                          type="number"
                          value={iclFormData.period_year}
                          onChange={(e) => setIclFormData({ ...iclFormData, period_year: e.target.value })}
                          min="2020"
                          max="2030"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="icl_value">Valor ICL (%)</Label>
                      <Input
                        id="icl_value"
                        type="number"
                        step="0.01"
                        value={iclFormData.icl_value}
                        onChange={(e) => setIclFormData({ ...iclFormData, icl_value: e.target.value })}
                        placeholder="12.50"
                      />
                    </div>
                    <div className="flex gap-2 pt-4">
                      <Button
                        variant="outline"
                        onClick={handleICLDialogClose}
                        className="flex-1"
                      >
                        Cancelar
                      </Button>
                      <Button
                        onClick={editingICL ? handleUpdateICL : handleCreateICL}
                        className="flex-1"
                      >
                        {editingICL ? 'Actualizar' : 'Crear'}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Período</TableHead>
                    <TableHead>Valor ICL (%)</TableHead>
                    <TableHead>Fecha Creación</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                      </TableCell>
                    </TableRow>
                  ) : iclValues.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8">
                        No hay valores ICL registrados
                      </TableCell>
                    </TableRow>
                  ) : (
                    iclValues.map((icl) => (
                      <TableRow key={icl.id}>
                        <TableCell className="font-medium">
                          {monthNames[icl.period_month - 1]} {icl.period_year}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {icl.icl_value}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(icl.created_at).toLocaleDateString('es-ES')}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditICL(icl)}
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
                                  <AlertDialogTitle>Eliminar Valor ICL</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    ¿Estás seguro de que quieres eliminar el valor ICL de {monthNames[icl.period_month - 1]} {icl.period_year}?
                                    Esta acción no se puede deshacer.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeleteICL(icl.id)}
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
          </div>

          {/* IPC Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Valores IPC</h3>
              <Dialog open={isIPCDialogOpen} onOpenChange={handleIPCDialogClose}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Nuevo IPC
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      {editingIPC ? 'Editar Valor IPC' : 'Crear Nuevo Valor IPC'}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="ipc_month">Mes</Label>
                        <Select
                          value={ipcFormData.period_month}
                          onValueChange={(value) => setIpcFormData({ ...ipcFormData, period_month: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar mes" />
                          </SelectTrigger>
                          <SelectContent>
                            {monthNames.map((month, index) => (
                              <SelectItem key={index + 1} value={(index + 1).toString()}>
                                {month}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="ipc_year">Año</Label>
                        <Input
                          id="ipc_year"
                          type="number"
                          value={ipcFormData.period_year}
                          onChange={(e) => setIpcFormData({ ...ipcFormData, period_year: e.target.value })}
                          min="2020"
                          max="2030"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="ipc_value">Valor IPC (%)</Label>
                      <Input
                        id="ipc_value"
                        type="number"
                        step="0.01"
                        value={ipcFormData.ipc_value}
                        onChange={(e) => setIpcFormData({ ...ipcFormData, ipc_value: e.target.value })}
                        placeholder="12.50"
                      />
                    </div>
                    <div className="flex gap-2 pt-4">
                      <Button
                        variant="outline"
                        onClick={handleIPCDialogClose}
                        className="flex-1"
                      >
                        Cancelar
                      </Button>
                      <Button
                        onClick={editingIPC ? handleUpdateIPC : handleCreateIPC}
                        className="flex-1"
                      >
                        {editingIPC ? 'Actualizar' : 'Crear'}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Período</TableHead>
                    <TableHead>Valor IPC (%)</TableHead>
                    <TableHead>Fecha Creación</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                      </TableCell>
                    </TableRow>
                  ) : ipcValues.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8">
                        No hay valores IPC registrados
                      </TableCell>
                    </TableRow>
                  ) : (
                    ipcValues.map((ipc) => (
                      <TableRow key={ipc.id}>
                        <TableCell className="font-medium">
                          {monthNames[ipc.period_month - 1]} {ipc.period_year}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {ipc.ipc_value}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(ipc.created_at).toLocaleDateString('es-ES')}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditIPC(ipc)}
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
                                  <AlertDialogTitle>Eliminar Valor IPC</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    ¿Estás seguro de que quieres eliminar el valor IPC de {monthNames[ipc.period_month - 1]} {ipc.period_year}?
                                    Esta acción no se puede deshacer.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeleteIPC(ipc.id)}
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
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

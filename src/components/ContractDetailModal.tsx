'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'

type Contract = {
  id: number
  start_date: string
  end_date: string
  initial_rent_amount: number
  rent_increase_frequency: 'monthly' | 'quarterly' | 'semi-annually' | 'annually'
  currency?: string
  icl_index_type?: string
  unit?: { unit_number: string }
  tenant?: { name: string }
}

type Rent = {
  id?: number
  period_year: number
  period_month: number
  amount: number
  base_amount?: number
  base_icl_value?: number
  adjustment_icl_value?: number
  icl_adjustment_factor?: number
  is_adjusted?: boolean
}

interface ContractDetailModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  contractId: number | null
}

export function ContractDetailModal({ open, onOpenChange, contractId }: ContractDetailModalProps) {
  const [contract, setContract] = useState<Contract | null>(null)
  const [rents, setRents] = useState<Rent[]>([])
  const [loading, setLoading] = useState(false)

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

  const getIndexTypeDisplay = (indexType: string) => {
    switch (indexType) {
      case 'ICL':
        return 'ICL (Índice de Contratos de Locación)'
      case 'IPC':
        return 'IPC (Índice de Precios al Consumidor)'
      case 'Average':
        return 'Promedio (ICL + IPC)'
      default:
        return indexType
    }
  }

  const fetchContract = async () => {
    if (!contractId) return

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const res = await fetch(`/api/contracts/${contractId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` }
      })
      if (!res.ok) throw new Error('Error cargando contrato')
      const data = await res.json()
      setContract(data.contract)
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const fetchRents = async () => {
    if (!contractId) return

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const res = await fetch(`/api/rents?contract_id=${contractId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` }
      })
      if (!res.ok) throw new Error('Error cargando rentas')
      const data = await res.json()
      setRents(data.rents || [])
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const handleRecalculate = async () => {
    if (!contractId) return

    try {
      setLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const res = await fetch(`/api/contracts/${contractId}/recalculate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` }
      })
      if (!res.ok) {
        const j = await res.json()
        throw new Error(j.error || 'Error recalculando rentas')
      }
      toast.success('Rentas recalculadas')
      fetchRents()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open && contractId) {
      fetchContract()
      fetchRents()
    }
  }, [open, contractId])

  if (!contract) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[90vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="sr-only">Detalles del Contrato</DialogTitle>
            <DialogDescription className="sr-only">
              Información detallada del contrato de alquiler
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[90vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="sr-only">Detalles del Contrato</DialogTitle>
          <DialogDescription className="sr-only">
            Información detallada del contrato de alquiler
          </DialogDescription>
        </DialogHeader>

        {/* Custom Header with Button */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex-1">
            <h2 className="text-2xl font-extrabold">Unidad {contract.unit?.unit_number}</h2>
            <p className="text-muted-foreground">Detalles del contrato de alquiler</p>
          </div>
          <div className="flex-shrink-0 mr-6">
            <Button onClick={handleRecalculate} disabled={loading}>
              {loading ? 'Calculando...' : 'Calcular alquileres'}
            </Button>
          </div>
        </div>

        <div className="space-y-6">
          {/* Contract Info Cards */}
          <div className="rounded-xl p-4 bg-gradient-to-r from-primary/10 via-accent/10 to-secondary/10 border">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="p-3 rounded-lg bg-background/60 border">
                <div className="text-muted-foreground">Inquilino</div>
                <div className="font-semibold text-base">{contract.tenant?.name}</div>
              </div>
              <div className="p-3 rounded-lg bg-background/60 border">
                <div className="text-muted-foreground">Período</div>
                <div className="font-semibold text-base">{contract.start_date} → {contract.end_date}</div>
              </div>
              <div className="p-3 rounded-lg bg-background/60 border">
                <div className="text-muted-foreground">Frecuencia</div>
                <div className="font-semibold text-base">{getFrequencyLabel(contract.rent_increase_frequency)}</div>
              </div>
              <div className="p-3 rounded-lg bg-background/60 border">
                <div className="text-muted-foreground">Moneda / Índice</div>
                <div className="font-semibold text-base">{contract.currency || 'ARS'} · {getIndexTypeDisplay(contract.icl_index_type || 'ICL')}</div>
              </div>
            </div>
          </div>

          {/* Rents Table */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Año</TableHead>
                  <TableHead>Mes</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Base</TableHead>
                  <TableHead>Índice Base</TableHead>
                  <TableHead>Índice Ajuste</TableHead>
                  <TableHead>Factor</TableHead>
                  <TableHead>Ajustado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rents.map((r, idx) => (
                  <TableRow key={r.id || `${r.period_year}-${r.period_month}`}>
                    <TableCell>{idx + 1}</TableCell>
                    <TableCell>{r.period_year}</TableCell>
                    <TableCell>{new Date(0, r.period_month - 1).toLocaleString('es-ES', { month: 'long' })}</TableCell>
                    <TableCell>{(Number(r.amount) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell>{(Number(r.base_amount) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell>{r.base_icl_value ?? '-'}</TableCell>
                    <TableCell>{r.adjustment_icl_value ?? '-'}</TableCell>
                    <TableCell>{r.icl_adjustment_factor ? r.icl_adjustment_factor.toFixed(6) : '-'}</TableCell>
                    <TableCell>{r.is_adjusted ? 'Sí' : 'No'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

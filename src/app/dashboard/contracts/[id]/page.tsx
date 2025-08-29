'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Navbar } from '@/components/Navbar'
import { DynamicSidebar } from '@/components/DynamicSidebar'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { PropertyProvider } from '@/contexts/PropertyContext'

export default function ContractDetailPage() {
  const params = useParams()
  const id = Array.isArray(params?.id) ? params.id[0] : (params?.id as string)
  const router = useRouter()

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
  const [contract, setContract] = useState<Contract | null>(null)
  const [rents, setRents] = useState<Rent[]>([])
  const [loading, setLoading] = useState(false)

  const fetchContract = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const res = await fetch(`/api/contracts/${id}`, { headers: { Authorization: `Bearer ${session.access_token}` } })
      if (!res.ok) throw new Error('Error cargando contrato')
      const data = await res.json()
      setContract(data.contract)
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const fetchRents = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const res = await fetch(`/api/rents?contract_id=${id}`, { headers: { Authorization: `Bearer ${session.access_token}` } })
      if (!res.ok) throw new Error('Error cargando rentas')
      const data = await res.json()
      setRents(data.rents || [])
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const handleRecalculate = async () => {
    try {
      setLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const res = await fetch(`/api/contracts/${id}/recalculate`, { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}` } })
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
    if (id) {
      fetchContract()
      fetchRents()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (!contract) return <div className="p-6">Cargando...</div>

  return (
    <PropertyProvider>
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex">
          <DynamicSidebar />
          <main className="flex-1 p-6 space-y-6">
            <div className="rounded-xl p-5 bg-gradient-to-r from-primary/10 via-accent/10 to-secondary/10 border">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-extrabold tracking-tight">Unidad {contract.unit?.unit_number}</h1>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={() => router.back()}>Volver</Button>
                  <Button onClick={handleRecalculate} disabled={loading}>{loading ? 'Calculando...' : 'Calcular alquileres'}</Button>
                </div>
              </div>

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
                  <div className="font-semibold text-base">{contract.currency || 'ARS'} · {contract.icl_index_type || 'ICL'}</div>
                </div>
              </div>
            </div>

            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Año</TableHead>
                    <TableHead>Mes</TableHead>
                    <TableHead>Monto</TableHead>
                    <TableHead>Base</TableHead>
                    <TableHead>ICL Base</TableHead>
                    <TableHead>ICL Ajuste</TableHead>
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
          </main>
        </div>
      </div>
    </PropertyProvider>
  )
}



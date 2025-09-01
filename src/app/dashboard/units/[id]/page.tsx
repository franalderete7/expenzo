'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Navbar } from '@/components/Navbar'
import { ContractDetailModal } from '@/components/ContractDetailModal'
import { toast } from 'sonner'
import { Toaster } from 'sonner'
import { supabase } from '@/lib/supabase'
import { PropertyProvider } from '@/contexts/PropertyContext'
import { Home, User, Calendar, DollarSign, ArrowLeft, Calculator } from 'lucide-react'

type Unit = {
  id: number
  unit_number: string
  status: 'occupied' | 'vacant'
  expense_percentage: number
  nis_number?: string
  catastro?: string
  water_account?: string
  gas_account?: string
  electricity_account?: string
  created_at: string
  property?: {
    id: number
    name: string
    street_address: string
    city: string
  }
  residents?: Array<{
    id: number
    name: string
    email?: string
    phone?: string
    role: 'owner' | 'tenant'
  }>
}

type Contract = {
  id: number
  start_date: string
  end_date: string
  initial_rent_amount: number
  rent_increase_frequency: 'monthly' | 'quarterly' | 'semi-annually' | 'annually'
  currency?: string
  icl_index_type?: string
  status: 'active' | 'expired' | 'renewed'
  tenant?: {
    id: number
    name: string
    email?: string
  }
}

export default function UnitDetailPage() {
  const params = useParams()
  const id = Array.isArray(params?.id) ? params.id[0] : (params?.id as string)

  const [unit, setUnit] = useState<Unit | null>(null)
  const [contracts, setContracts] = useState<Contract[]>([])
  const [loading, setLoading] = useState(true)
  const [contractDetailModalOpen, setContractDetailModalOpen] = useState(false)
  const [selectedContractId, setSelectedContractId] = useState<number | null>(null)

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

  const getContractStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'active':
        return 'default'
      case 'expired':
        return 'secondary'
      case 'renewed':
        return 'outline'
      default:
        return 'outline'
    }
  }

  const getContractStatusText = (status: string) => {
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

  const handleContractClick = (contractId: number) => {
    setSelectedContractId(contractId)
    setContractDetailModalOpen(true)
  }

  const handleBack = () => {
    try {
      window.history.back()
    } catch (error) {
      // Fallback to navigate to dashboard
      window.location.href = '/dashboard'
    }
  }

  const fetchUnit = async () => {
    if (!id) return

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const res = await fetch(`/api/units/${id}`, {
        headers: { Authorization: `Bearer ${session.access_token}` }
      })
      if (!res.ok) throw new Error('Error cargando unidad')
      const data = await res.json()
      setUnit(data.unit)
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const fetchContracts = async () => {
    if (!id) return

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const res = await fetch(`/api/contracts?unit_id=${id}`, {
        headers: { Authorization: `Bearer ${session.access_token}` }
      })
      if (!res.ok) throw new Error('Error cargando contratos')
      const data = await res.json()
      setContracts(data.contracts || [])
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      await Promise.all([fetchUnit(), fetchContracts()])
      setLoading(false)
    }

    if (id) {
      loadData()
    }
  }, [id])

  const resident = unit?.residents?.[0]

  return (
    <PropertyProvider>
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex">
          <main className="flex-1 p-6 space-y-6">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : !unit ? (
              <div className="text-center py-12">
                  <Home className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h2 className="text-xl font-semibold mb-2">Unidad no encontrada</h2>
                  <p className="text-muted-foreground mb-4">La unidad que buscas no existe o no tienes acceso a ella.</p>
                  <Button onClick={handleBack}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Volver
                  </Button>
              </div>
            ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Button variant="outline" size="sm" onClick={handleBack}>
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Volver
                    </Button>
                    <div>
                      <h1 className="text-3xl font-extrabold tracking-tight">Unidad {unit?.unit_number}</h1>
                      <p className="text-muted-foreground">Detalles de la unidad y contratos asociados</p>
                    </div>
                  </div>
              </div>

              <div className="rounded-xl p-6 bg-gradient-to-r from-primary/10 via-accent/10 to-secondary/10 border">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-4 rounded-lg bg-background/60 border">
                                      <div className="flex items-center gap-2 mb-2">
                    <Home className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Estado</span>
                  </div>
                  <Badge variant={getStatusBadgeVariant(unit?.status)} className="text-sm">
                    {getStatusText(unit?.status)}
                  </Badge>
                  </div>

                  <div className="p-4 rounded-lg bg-background/60 border">
                    <div className="flex items-center gap-2 mb-2">
                      <Calculator className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">% Expensas</span>
                    </div>
                    <div className="font-semibold text-lg">{unit?.expense_percentage}%</div>
                  </div>

                  <div className="p-4 rounded-lg bg-background/60 border">
                    <div className="flex items-center gap-2 mb-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Residente</span>
                    </div>
                    {resident ? (
                      <div>
                        <div className="font-semibold">{resident.name}</div>
                        <Badge variant={resident.role === 'owner' ? 'secondary' : 'default'} className="text-xs mt-1">
                          {resident.role === 'owner' ? 'Propietario' : 'Inquilino'}
                        </Badge>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Sin residente</span>
                    )}
                  </div>

                  <div className="p-4 rounded-lg bg-background/60 border">
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Creada</span>
                    </div>
                                      <div className="font-semibold">
                    {unit?.created_at ? new Date(unit.created_at).toLocaleDateString('es-ES') : ''}
                  </div>
                  </div>
              </div>
            </div>

            {/* Additional Details */}
            {(unit?.nis_number || unit?.catastro || unit?.water_account || unit?.gas_account || unit?.electricity_account) && (
              <div className="rounded-lg border p-6">
                  <h3 className="text-lg font-semibold mb-4">Información Adicional</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {unit?.nis_number && (
                      <div>
                        <label className="text-sm text-muted-foreground">NIS</label>
                        <div className="font-medium">{unit.nis_number}</div>
                      </div>
                    )}
                    {unit?.catastro && (
                      <div>
                        <label className="text-sm text-muted-foreground">Catastro</label>
                        <div className="font-medium">{unit.catastro}</div>
                      </div>
                    )}
                    {unit?.water_account && (
                      <div>
                        <label className="text-sm text-muted-foreground">Cuenta de Agua</label>
                        <div className="font-medium">{unit.water_account}</div>
                      </div>
                    )}
                    {unit?.gas_account && (
                      <div>
                        <label className="text-sm text-muted-foreground">Cuenta de Gas</label>
                        <div className="font-medium">{unit.gas_account}</div>
                      </div>
                    )}
                    {unit?.electricity_account && (
                      <div>
                        <label className="text-sm text-muted-foreground">Cuenta de Electricidad</label>
                        <div className="font-medium">{unit.electricity_account}</div>
                      </div>
                    )}
                  </div>
              </div>
            )}

            {/* Contracts Section */}
            <div className="rounded-lg border">
              <div className="p-6 border-b">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-muted-foreground" />
                      <h3 className="text-lg font-semibold">Contratos Asociados</h3>
                    </div>
                    <Badge variant="outline" className="text-sm">
                      {contracts.length} contrato{contracts.length !== 1 ? 's' : ''}
                    </Badge>
                  </div>
              </div>

              {contracts.length === 0 ? (
                  <div className="p-8 text-center">
                    <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h4 className="text-lg font-medium mb-2">Sin contratos</h4>
                    <p className="text-muted-foreground">
                      Esta unidad no tiene contratos asociados actualmente.
                    </p>
                  </div>
              ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Inquilino</TableHead>
                          <TableHead>Período</TableHead>
                          <TableHead>Monto Inicial</TableHead>
                          <TableHead>Frecuencia</TableHead>
                          <TableHead>Estado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {contracts.map((contract) => (
                          <TableRow
                            key={contract.id}
                            className="cursor-pointer hover:bg-muted/50 transition-colors"
                            onClick={() => handleContractClick(contract.id)}
                          >
                            <TableCell>
                              <div>
                                <div className="font-medium">{contract.tenant?.name}</div>
                                {contract.tenant?.email && (
                                  <div className="text-sm text-muted-foreground">{contract.tenant.email}</div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                {new Date(contract.start_date).toLocaleDateString('es-ES')} - {' '}
                                {new Date(contract.end_date).toLocaleDateString('es-ES')}
                              </div>
                            </TableCell>
                            <TableCell className="font-medium">
                              {contract.currency || 'ARS'} {contract.initial_rent_amount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {getFrequencyLabel(contract.rent_increase_frequency)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={getContractStatusBadgeVariant(contract.status)} className="text-xs">
                                {getContractStatusText(contract.status)}
                              </Badge>
                            </TableCell>

                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
              )}
              </div>
            </div>
            )}
          </main>
        </div>
      </div>

      {/* Contract Detail Modal */}
      <ContractDetailModal
        open={contractDetailModalOpen}
        onOpenChange={setContractDetailModalOpen}
        contractId={selectedContractId}
      />
      
      <Toaster />
    </PropertyProvider>
  )
}

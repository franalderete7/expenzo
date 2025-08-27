'use client'

import { useState } from 'react'
import { PropertyProvider, useProperty } from '@/contexts/PropertyContext'
import { PropertySelector } from './PropertySelector'
import { DynamicSidebar } from './DynamicSidebar'
import { PropertyCreateModal } from './PropertyCreateModal'
import { Navbar } from './Navbar'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { Plus } from 'lucide-react'

interface PropertyLayoutProps {
  children: React.ReactNode
}

// Inner component that uses the context
function PropertyLayoutInner({ children }: PropertyLayoutProps) {
  const { selectedProperty, selectProperty, refreshProperties } = useProperty()
  const [createModalOpen, setCreateModalOpen] = useState(false)

  const handleCreateProperty = () => {
    // Abrir el modal de creación de propiedad
    setCreateModalOpen(true)
  }

  const handlePropertyCreated = (propertyId: number) => {
    // Refrescar la lista de propiedades después de crear una nueva
    refreshProperties()

    // Seleccionar automáticamente la nueva propiedad
    selectProperty(propertyId)

    console.log('Nueva propiedad creada y seleccionada:', propertyId)
  }



  const handleCreateUnit = () => {
    console.log('Crear unidad para propiedad', selectedProperty?.id)
    // Aquí se abriría un diálogo/formulario de creación de unidad
  }

  const handleCreateContract = () => {
    console.log('Crear contrato para propiedad', selectedProperty?.id)
    // Aquí se abriría un diálogo/formulario de creación de contrato
  }

  const handleCreateExpense = () => {
    console.log('Crear gasto para propiedad', selectedProperty?.id)
    // Aquí se abriría un diálogo/formulario de creación de gasto
  }

  const handleCreatePayment = () => {
    console.log('Crear pago para propiedad', selectedProperty?.id)
    // Aquí se abriría un diálogo/formulario de creación de pago
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Barra de navegación con avatar y sesión */}
      <Navbar />

      {/* Encabezado con selector de propiedad */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-16 items-center px-6">
          <div className="flex items-center gap-4 flex-1">
            <h1 className="text-xl font-semibold">Gestor de Propiedades</h1>
            <div className="h-6 w-px bg-border" />
            <PropertySelector
              selectedPropertyId={selectedProperty?.id}
              onPropertySelect={selectProperty}
            />
          </div>
        </div>
      </header>

      {/* Main Content Layout */}
      <div className="flex">
        {/* Dynamic Sidebar */}
        <DynamicSidebar
          onCreateUnit={handleCreateUnit}
        />

        {/* Área de contenido principal */}
        <main className="flex-1 p-6">
          {selectedProperty ? (
            <div>
              <div className="mb-6">
                <h2 className="text-2xl font-bold">{selectedProperty.name}</h2>
                <p className="text-muted-foreground">
                  {selectedProperty.street_address}, {selectedProperty.city}
                </p>
              </div>
              {children}
            </div>
          ) : (
            <div className="flex items-center justify-center h-96">
              <div className="text-center">
                <h3 className="text-lg font-medium mb-2">Bienvenido al Gestor de Propiedades</h3>
                <p className="text-muted-foreground mb-4">
                  Selecciona una propiedad del menú desplegable arriba para comenzar
                </p>
                <Button onClick={handleCreateProperty}>
                  <Plus className="mr-2 h-4 w-4" />
                  Crear Tu Primera Propiedad
                </Button>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Modal de creación de propiedad */}
      <PropertyCreateModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        onSuccess={() => handlePropertyCreated(0)}
      />
    </div>
  )
}

// Main component that provides the context
export function PropertyLayout({ children }: PropertyLayoutProps) {
  return (
    <PropertyProvider>
      <PropertyLayoutInner>{children}</PropertyLayoutInner>
    </PropertyProvider>
  )
}

'use client'

import { useAuth } from '@/contexts/AuthContext'
import { PropertyProvider, useProperty } from '@/contexts/PropertyContext'
import { DynamicSidebar } from '@/components/DynamicSidebar'
import { Navbar } from '@/components/Navbar'
import { PropertiesManager } from '@/components/PropertiesManager'
import { PersonalTransactionsTable } from '@/components/PersonalTransactionsTable'
import { ViewSwitcher } from '@/components/ViewSwitcher'
import { Button } from '@/components/ui/button'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { UnitsTable } from '@/components/UnitsTable'
import { ResidentsTable } from '@/components/ResidentsTable'
import { ExpensesTable } from '@/components/ExpensesTable'
import { ContractsTable } from '@/components/ContractsTable'
import { LiquidacionesTable } from '@/components/LiquidacionesTable'
import { Toaster } from 'sonner'

// Inner component that uses the context
function DashboardInner() {
  const { user, loading: authLoading } = useAuth()
  const { selectedProperty, selectProperty, loading: propertyLoading } = useProperty()
  const router = useRouter()
  const unitsTableRef = useRef<{ openCreateDialog: () => void } | null>(null)
  const residentsTableRef = useRef<{ openCreateDialog: () => void } | null>(null)
  const expensesTableRef = useRef<{ openCreateDialog: () => void } | null>(null)
  const contractsTableRef = useRef<{ openCreateDialog: () => void } | null>(null)
  const personalTransactionsTableRef = useRef<{ openCreateDialog: () => void } | null>(null)
  const [activeTab, setActiveTab] = useState<'units' | 'residents' | 'expenses' | 'contracts' | 'liquidaciones'>('units')
  const [currentView, setCurrentView] = useState<'properties' | 'transactions'>('properties')

  useEffect(() => {
    if (!authLoading && !user) {
      // Add a small delay to prevent redirect loops
      const timer = setTimeout(() => {
        router.push('/')
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [user, authLoading, router])

  const handlePropertySelect = (propertyId: number | null) => {
    selectProperty(propertyId)
  }

  const handleBackToProperties = () => {
    selectProperty(null)
  }

  const handleCreateUnit = () => {
    if (unitsTableRef.current) {
      unitsTableRef.current.openCreateDialog()
    }
  }

  const handleCreateResident = () => {
    if (residentsTableRef.current) {
      residentsTableRef.current.openCreateDialog()
    }
  }

  const handleCreateExpense = () => {
    if (expensesTableRef.current) {
      expensesTableRef.current.openCreateDialog()
    }
  }

  const handleCreateContract = () => {
    if (contractsTableRef.current) {
      contractsTableRef.current.openCreateDialog()
    }
  }

  const handleCreatePersonalTransaction = () => {
    if (personalTransactionsTableRef.current) {
      personalTransactionsTableRef.current.openCreateDialog()
    }
  }

  const handleTabChange = (tab: 'units' | 'residents' | 'expenses' | 'contracts' | 'liquidaciones') => {
    setActiveTab(tab)
  }

  const handleViewChange = (view: 'properties' | 'transactions') => {
    setCurrentView(view)
    // Clear selected property when switching to transactions view
    if (view === 'transactions') {
      selectProperty(null)
    }
  }

  if (authLoading || propertyLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <Navbar />

      {!selectedProperty ? (
        /* Main Dashboard View - Properties or Personal Transactions */
        <div className="min-h-[calc(100vh-64px)] p-6">
          {/* View Switcher */}
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <ViewSwitcher currentView={currentView} onViewChange={handleViewChange} />
          </div>

          {currentView === 'properties' ? (
            <PropertiesManager onPropertySelect={handlePropertySelect} />
          ) : (
            <PersonalTransactionsTable ref={personalTransactionsTableRef} />
          )}
        </div>
      ) : (
        /* Property-Specific View */
        <div className="min-h-[calc(100vh-64px)] flex flex-col">
          {/* Header with back button and property switcher */}
          <div className="w-full border-b bg-background/95 backdrop-blur">
            <div className="flex h-16 items-center px-6 gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBackToProperties}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Volver a Propiedades
              </Button>

              <div className="h-6 w-px bg-border" />

              <div className="flex items-center gap-4 flex-1">
                <div>
                  <h2 className="font-semibold">{selectedProperty.name}</h2>
                  <p className="text-sm text-muted-foreground">
                    {selectedProperty.street_address}, {selectedProperty.city}
                  </p>
                </div>
              </div>


            </div>
          </div>

          {/* Property-specific content with sidebar */}
          <div className="flex flex-1 min-h-0">
            <DynamicSidebar
              onCreateUnit={handleCreateUnit}
              onCreateResident={handleCreateResident}
              onCreateExpense={handleCreateExpense}
              onCreateContract={handleCreateContract}
              onTabChange={handleTabChange}
              activeTab={activeTab}
            />

            <main className="flex-1 p-6 overflow-auto">
              <div className="space-y-6">
                {activeTab === 'units' ? (
                  <UnitsTable ref={unitsTableRef} />
                ) : activeTab === 'residents' ? (
                  <ResidentsTable ref={residentsTableRef} />
                ) : activeTab === 'expenses' ? (
                  <ExpensesTable ref={expensesTableRef} />
                ) : activeTab === 'contracts' ? (
                  <ContractsTable ref={contractsTableRef} />
                ) : (
                  <LiquidacionesTable />
                )}
              </div>
            </main>
          </div>
        </div>
      )}
      <Toaster />
    </div>
  )
}

// Main component with context provider
export default function Dashboard() {
  // Log dashboard page load
  useEffect(() => {
    console.log('📊 [DASHBOARD PAGE] Page loaded')
    console.log('📊 [DASHBOARD PAGE] Current URL:', window.location.href)
    console.log('📊 [DASHBOARD PAGE] Current origin:', window.location.origin)
    console.log('📊 [DASHBOARD PAGE] Search params:', window.location.search)

    // Check for OAuth-related URL parameters
    const urlParams = new URLSearchParams(window.location.search)
    const hasAuthParams = urlParams.has('code') || urlParams.has('access_token') || urlParams.has('refresh_token') || urlParams.has('error')
    console.log('📊 [DASHBOARD PAGE] Has OAuth params:', hasAuthParams)
    if (hasAuthParams) {
      console.log('📊 [DASHBOARD PAGE] OAuth params:', Object.fromEntries(urlParams.entries()))
    }
  }, [])
  return (
    <PropertyProvider>
      <DashboardInner />
    </PropertyProvider>
  )
}
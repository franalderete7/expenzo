'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { Property } from '@/types/database'
import { supabase } from '@/lib/supabase'

interface PropertyContextType {
  selectedPropertyId: number | null
  selectedProperty: Property | null
  properties: Property[]
  loading: boolean
  error: string | null
  selectProperty: (propertyId: number | null) => void
  refreshProperties: () => Promise<void>
}

const PropertyContext = createContext<PropertyContextType | undefined>(undefined)

interface PropertyProviderProps {
  children: ReactNode
}

export function PropertyProvider({ children }: PropertyProviderProps) {
  const [selectedPropertyId, setSelectedPropertyId] = useState<number | null>(null)
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null)
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load selected property from localStorage on mount
  useEffect(() => {
    const savedPropertyId = localStorage.getItem('selectedPropertyId')
    if (savedPropertyId) {
      setSelectedPropertyId(parseInt(savedPropertyId))
    }
    fetchProperties()
  }, [])

  // Update selectedProperty when selectedPropertyId or properties change
  useEffect(() => {
    if (selectedPropertyId && properties.length > 0) {
      const property = properties.find(p => p.id === selectedPropertyId)
      setSelectedProperty(property || null)
    } else {
      setSelectedProperty(null)
    }
  }, [selectedPropertyId, properties])

  const fetchProperties = async () => {
    try {
      setLoading(true)
      const { data: { user }, error: userError } = await supabase.auth.getUser()

      if (userError || !user) {
        setError('Not authenticated')
        setProperties([])
        return
      }

      const { data: properties, error } = await supabase
        .from('properties')
        .select('*')
        .eq('admin_id', user.id)
        .order('name')

      if (error) {
        setError(error.message)
        setProperties([])
        return
      }

      setProperties(properties || [])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch properties')
      setProperties([])
    } finally {
      setLoading(false)
    }
  }

  const selectProperty = (propertyId: number | null) => {
    setSelectedPropertyId(propertyId)
    if (propertyId) {
      localStorage.setItem('selectedPropertyId', propertyId.toString())
    } else {
      localStorage.removeItem('selectedPropertyId')
    }
  }

  const refreshProperties = async () => {
    await fetchProperties()
  }

  const value: PropertyContextType = {
    selectedPropertyId,
    selectedProperty,
    properties,
    loading,
    error,
    selectProperty,
    refreshProperties
  }

  return (
    <PropertyContext.Provider value={value}>
      {children}
    </PropertyContext.Provider>
  )
}

export function useProperty() {
  const context = useContext(PropertyContext)
  if (context === undefined) {
    throw new Error('useProperty must be used within a PropertyProvider')
  }
  return context
}

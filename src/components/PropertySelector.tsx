'use client'

import { useState, useEffect } from 'react'
import { ChevronDown, Building, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Property } from '@/types/database'
import { supabase } from '@/lib/supabase'

interface PropertySelectorProps {
  selectedPropertyId?: number
  onPropertySelect: (propertyId: number | null) => void
}

export function PropertySelector({
  selectedPropertyId,
  onPropertySelect
}: PropertySelectorProps) {
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchProperties()
  }, [])

  const fetchProperties = async () => {
    try {
      setLoading(true)
      const { data: { user }, error: userError } = await supabase.auth.getUser()

      if (userError || !user) {
        setError('Not authenticated')
        return
      }

      const { data: properties, error } = await supabase
        .from('properties')
        .select('*')
        .eq('admin_id', user.id)
        .order('name')

      if (error) {
        setError(error.message)
        return
      }

      setProperties(properties || [])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch properties')
    } finally {
      setLoading(false)
    }
  }

  const selectedProperty = properties.find(p => p.id === selectedPropertyId)

  if (loading) {
    return (
      <Button variant="outline" disabled className="w-64 justify-start">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Cargando propiedades...
      </Button>
    )
  }

  if (error) {
    return (
      <Button variant="outline" disabled className="w-64 justify-start">
        <Building className="mr-2 h-4 w-4" />
        Error cargando propiedades
      </Button>
    )
  }

    if (properties.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <Button
          variant="outline"
          disabled
          className="w-64 justify-start"
        >
          No hay propiedades disponibles
        </Button>
      </div>
    )
  }

  // Show dropdown even when properties exist
  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="w-64 justify-start">
            <Building className="mr-2 h-4 w-4" />
            <span className="truncate">
              {selectedProperty ? selectedProperty.name : 'Seleccionar Propiedad'}
            </span>
            <ChevronDown className="ml-auto h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel>Propiedades</DropdownMenuLabel>
          <DropdownMenuSeparator />

          {!selectedProperty && (
            <>
              <DropdownMenuItem
                onClick={() => onPropertySelect(null)}
                className="text-muted-foreground"
              >
                <Building className="mr-2 h-4 w-4" />
                Ninguna propiedad seleccionada
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}

          {properties.map((property) => (
            <DropdownMenuItem
              key={property.id}
              onClick={() => onPropertySelect(property.id)}
              className={`cursor-pointer ${
                selectedPropertyId === property.id
                  ? 'bg-accent text-accent-foreground'
                  : ''
              }`}
            >
              <Building className="mr-2 h-4 w-4" />
              <div className="flex flex-col items-start">
                <span className="font-medium">{property.name}</span>
                <span className="text-xs text-muted-foreground">
                  {property.street_address}, {property.city}
                </span>
              </div>
            </DropdownMenuItem>
          ))}


        </DropdownMenuContent>
      </DropdownMenu>

      {selectedProperty && (
        <div className="text-sm text-muted-foreground">
          {properties.length} propiedades
        </div>
      )}
    </div>
  )


}

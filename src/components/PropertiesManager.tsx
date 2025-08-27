'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import { Badge } from '@/components/ui/badge'
import { Plus, Edit, Trash2, Building, MapPin } from 'lucide-react'
import { Property, PropertyFormData } from '@/types/database'

interface PropertiesManagerProps {
  onPropertySelect?: (propertyId: number) => void
}

export function PropertiesManager({ onPropertySelect }: PropertiesManagerProps = {}) {
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [editingProperty, setEditingProperty] = useState<Property | null>(null)
  const [formData, setFormData] = useState<PropertyFormData>({
    name: '',
    street_address: '',
    city: '',
    description: '',
  })

  const fetchProperties = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/properties')
      if (!response.ok) {
        throw new Error('Failed to fetch properties')
      }
      const result = await response.json()
      console.log('API Response:', result) // Debug log
      setProperties(result.data || [])
    } catch (err) {
      console.error('Fetch error:', err) // Debug log
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProperties()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const url = editingProperty ? `/api/properties/${editingProperty.id}` : '/api/properties'
      const method = editingProperty ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save property')
      }

      const result = await response.json()
      console.log(result.message)

      // Reset form and close dialog
      setFormData({
        name: '',
        street_address: '',
        city: '',
        description: '',
      })
      setIsCreateDialogOpen(false)
      setEditingProperty(null)

      // Refresh properties list
      fetchProperties()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    }
  }

  const handleEdit = (property: Property) => {
    setEditingProperty(property)
    setFormData({
      name: property.name,
      street_address: property.street_address,
      city: property.city,
      description: property.description || '',
    })
    setIsCreateDialogOpen(true)
  }

  const handleDelete = async (propertyId: number) => {
    try {
      const response = await fetch(`/api/properties/${propertyId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete property')
      }

      const result = await response.json()
      console.log(result.message)

      // Refresh properties list
      fetchProperties()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      street_address: '',
      city: '',
      description: '',
    })
    setEditingProperty(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Propiedades</h2>
          <p className="text-muted-foreground">
            Gestiona tus propiedades inmobiliarias
          </p>
        </div>

        <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
          setIsCreateDialogOpen(open)
          if (!open) resetForm()
        }}>
          <DialogTrigger asChild>
            <Button size="lg" className="shadow-sm">
              <Plus className="mr-2 h-4 w-4" />
              Nueva Propiedad
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px] border-0 shadow-2xl">
            <DialogHeader className="space-y-3">
              <div className="flex items-center space-x-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Building className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <DialogTitle className="text-xl">
                    {editingProperty ? 'Editar Propiedad' : 'Crear Nueva Propiedad'}
                  </DialogTitle>
                  <DialogDescription className="text-muted-foreground">
                    {editingProperty
                      ? 'Actualiza los datos de tu propiedad'
                      : 'Agrega una nueva propiedad a tu portafolio inmobiliario'
                    }
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-medium text-foreground">
                    Nombre de la Propiedad
                  </Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ej: Edificio Central"
                    className="h-11"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="street_address" className="text-sm font-medium text-foreground">
                    Dirección Completa
                  </Label>
                  <Input
                    id="street_address"
                    value={formData.street_address}
                    onChange={(e) => setFormData({ ...formData, street_address: e.target.value })}
                    placeholder="Ej: Calle Principal 123"
                    className="h-11"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="city" className="text-sm font-medium text-foreground">
                    Ciudad
                  </Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="Ej: Buenos Aires"
                    className="h-11"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description" className="text-sm font-medium text-foreground">
                    Descripción <span className="text-muted-foreground">(opcional)</span>
                  </Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Agrega detalles adicionales sobre la propiedad..."
                    className="min-h-[100px] resize-none"
                    rows={4}
                  />
                </div>
              </div>

              <DialogFooter className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-primary hover:bg-primary/90"
                >
                  <Building className="mr-2 h-4 w-4" />
                  {editingProperty ? 'Actualizar Propiedad' : 'Crear Propiedad'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {properties.map((property) => (
          <Card
            key={property.id}
            className="hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => onPropertySelect?.(property.id)}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-2">
                  <Building className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">{property.name}</CardTitle>
                </div>
                <div className="flex space-x-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEdit(property);
                    }}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="border-destructive/20">
                      <AlertDialogHeader>
                        <div className="flex items-center space-x-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
                            <Trash2 className="h-5 w-5 text-destructive" />
                          </div>
                          <div>
                            <AlertDialogTitle className="text-left">
                              Eliminar Propiedad
                            </AlertDialogTitle>
                            <AlertDialogDescription className="text-left">
                              Esta acción no se puede deshacer. Se eliminarán permanentemente:
                            </AlertDialogDescription>
                          </div>
                        </div>
                        <div className="ml-13 mt-2 space-y-1 text-sm text-muted-foreground">
                          <p>• Todas las unidades de esta propiedad</p>
                          <p>• Todos los residentes asociados</p>
                          <p>• Todos los contratos y alquileres</p>
                          <p>• Historial de pagos y gastos</p>
                        </div>
                      </AlertDialogHeader>
                      <AlertDialogFooter className="flex gap-3">
                        <AlertDialogCancel className="flex-1">
                          Cancelar
                        </AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(property.id)}
                          className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Eliminar Propiedad
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
              <CardDescription className="flex items-center space-x-1">
                <MapPin className="h-4 w-4" />
                <span>{property.street_address}, {property.city}</span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-muted-foreground">
                    Propiedad activa
                  </span>
                </div>
                <Badge variant="outline">
                  Activa
                </Badge>
              </div>
              {property.description && (
                <p className="text-sm text-muted-foreground mt-2">
                  {property.description}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {properties.length === 0 && !loading && (
        <div className="text-center py-12">
          <Building className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-muted-foreground mb-2">
            No tienes propiedades registradas
          </h3>
          <p className="text-muted-foreground mb-4">
            Comienza agregando tu primera propiedad para empezar a gestionar tus alquileres.
          </p>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Crear Primera Propiedad
          </Button>
        </div>
      )}
    </div>
  )
}

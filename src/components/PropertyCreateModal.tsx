'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { supabase } from '@/lib/supabase'
import { PropertyFormData } from '@/types/database'
import { Loader2 } from 'lucide-react'

interface PropertyCreateModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function PropertyCreateModal({
  open,
  onOpenChange,
  onSuccess
}: PropertyCreateModalProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState<PropertyFormData>({
    name: '',
    street_address: '',
    city: '',
    description: ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name.trim() || !formData.street_address.trim() || !formData.city.trim()) {
      setError('Por favor completa todos los campos obligatorios')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser()

      if (userError || !user) {
        setError('Usuario no autenticado')
        return
      }

      // Create property
      const { data: property, error: createError } = await supabase
        .from('properties')
        .insert({
          name: formData.name.trim(),
          street_address: formData.street_address.trim(),
          city: formData.city.trim(),
          description: formData.description.trim() || null,
          admin_id: user.id
        })
        .select()
        .single()

      if (createError) {
        setError(createError.message)
        return
      }

      console.log('Propiedad creada exitosamente:', property)

      // Close modal and reset form
      onOpenChange(false)
      setFormData({
        name: '',
        street_address: '',
        city: '',
        description: ''
      })

      // Call success callback (no auto-selection)
      if (onSuccess) {
        onSuccess()
      }

    } catch (err) {
      console.error('Error creating property:', err)
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (field: keyof PropertyFormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Crear Nueva Propiedad</DialogTitle>
          <DialogDescription>
            Agrega una nueva propiedad a tu portafolio inmobiliario
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium">
                Nombre de la Propiedad *
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="Ej: Edificio Central"
                className="h-11"
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="street_address" className="text-sm font-medium">
                Dirección Completa *
              </Label>
              <Input
                id="street_address"
                value={formData.street_address}
                onChange={(e) => handleInputChange('street_address', e.target.value)}
                placeholder="Ej: Calle Principal 123"
                className="h-11"
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="city" className="text-sm font-medium">
                Ciudad *
              </Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => handleInputChange('city', e.target.value)}
                placeholder="Ej: Buenos Aires"
                className="h-11"
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm font-medium">
                Descripción <span className="text-muted-foreground">(opcional)</span>
              </Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Agrega detalles adicionales sobre la propiedad..."
                className="min-h-[100px] resize-none"
                rows={4}
                disabled={loading}
              />
            </div>
          </div>

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}

          <DialogFooter className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="min-w-[120px]"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creando...
                </>
              ) : (
                'Crear Propiedad'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

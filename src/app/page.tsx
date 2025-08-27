'use client'

import { Navbar } from '@/components/Navbar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/contexts/AuthContext'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { TrendingUp, Users, DollarSign, Shield } from 'lucide-react'

export default function Home() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && user) {
      router.push('/dashboard')
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      {/* Hero Section */}
      <section className="flex-1 container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <Badge variant="secondary" className="mb-4">
            🚀 Nueva plataforma de gestión financiera
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Gestiona tus gastos con Expenzo
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            La forma más inteligente y moderna de controlar tus finanzas personales.
            Visualiza, organiza y optimiza tus ingresos y gastos en tiempo real.
          </p>
          <Button size="lg" className="text-lg px-8 py-3">
            Comenzar gratis
          </Button>
        </div>

        {/* Marketing Numbers */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          <Card className="text-center">
            <CardHeader>
              <DollarSign className="h-8 w-8 mx-auto mb-2 text-green-500" />
              <CardTitle className="text-2xl font-bold text-green-500">
                $2.5M+
              </CardTitle>
              <CardDescription>
                Ahorro total generado por nuestros usuarios
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <Users className="h-8 w-8 mx-auto mb-2 text-blue-500" />
              <CardTitle className="text-2xl font-bold text-blue-500">
                10,000+
              </CardTitle>
              <CardDescription>
                Usuarios activos gestionando sus finanzas
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <TrendingUp className="h-8 w-8 mx-auto mb-2 text-purple-500" />
              <CardTitle className="text-2xl font-bold text-purple-500">
                35%
              </CardTitle>
              <CardDescription>
                Reducción promedio en gastos innecesarios
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <Shield className="h-8 w-8 mx-auto mb-2 text-orange-500" />
              <CardTitle className="text-2xl font-bold text-orange-500">
                99.9%
              </CardTitle>
              <CardDescription>
                Tiempo de actividad de la plataforma
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Features Section */}
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold mb-8">¿Por qué elegir Expenzo?</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-primary/10 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Análisis Inteligente</h3>
              <p className="text-muted-foreground">
                Obtén insights detallados sobre tus patrones de gasto con IA avanzada
              </p>
            </div>

            <div className="text-center">
              <div className="bg-primary/10 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <Shield className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Seguridad Total</h3>
              <p className="text-muted-foreground">
                Tus datos están protegidos con encriptación de nivel bancario
              </p>
            </div>

            <div className="text-center">
              <div className="bg-primary/10 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <Users className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Sincronización</h3>
              <p className="text-muted-foreground">
                Accede a tus datos desde cualquier dispositivo en tiempo real
              </p>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center bg-primary/5 rounded-lg p-8">
          <h2 className="text-3xl font-bold mb-4">¡Comienza tu viaje financiero hoy!</h2>
          <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
            Únete a miles de usuarios que ya están tomando control de sus finanzas con Expenzo.
            Es gratis comenzar y solo toma 2 minutos configurar tu cuenta.
          </p>
          <Button size="lg" className="text-lg px-8 py-3">
            Crear cuenta gratuita
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>&copy; 2024 Expenzo. Todos los derechos reservados.</p>
        </div>
      </footer>
    </div>
  )
}

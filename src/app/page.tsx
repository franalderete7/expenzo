'use client'

import { Navbar } from '@/components/Navbar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/contexts/AuthContext'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { TrendingUp, Users, DollarSign, Shield, Sparkles } from 'lucide-react'

function AnimatedCounter({
  end,
  duration = 3000,
  suffix = '',
  prefix = '',
  isVisible
}: {
  end: string
  duration?: number
  suffix?: string
  prefix?: string
  isVisible: boolean
}) {
  const [count, setCount] = useState(0)
  const [hasAnimated, setHasAnimated] = useState(false)

  useEffect(() => {
    console.log(`AnimatedCounter: isVisible=${isVisible}, hasAnimated=${hasAnimated}, end=${end}`)

    if (isVisible && !hasAnimated) {
      console.log(`Starting animation for ${end}`)
      setHasAnimated(true)
      const start = 0
      // Extract only the numeric part from formats like "USD 500,000" or "$2.5M+"
      let numericString = end.replace(/[^0-9.,]/g, '') // Remove everything except numbers, dots, and commas
      numericString = numericString.replace(/,/g, '') // Remove commas
      const endNum = parseFloat(numericString)

      console.log(`Parsed endNum: ${endNum} from ${end}`)

      if (isNaN(endNum)) {
        console.error(`Failed to parse number from: ${end}`)
        return
      }

      // Use requestAnimationFrame for smoother animation
      const startTime = Date.now()

      const animate = () => {
        const currentTime = Date.now()
        const elapsed = currentTime - startTime
        const progress = Math.min(elapsed / duration, 1)

        // Use easing function for smoother animation
        const easeOutQuart = 1 - Math.pow(1 - progress, 4)
        const currentValue = start + (endNum - start) * easeOutQuart

        setCount(currentValue)

        if (progress < 1) {
          requestAnimationFrame(animate)
        } else {
          setCount(endNum)
          console.log(`Animation completed for ${end}: ${endNum}`)
        }
      }

      requestAnimationFrame(animate)
    }
  }, [isVisible, hasAnimated, end, duration])

  const formatNumber = (num: number) => {
    if (end.includes('$') || end.includes('USD')) {
      // Handle formats like "USD 500,000" or "$2.5M+"
      const prefix = end.includes('USD') ? 'USD ' : '$'
      return prefix + Math.round(num).toLocaleString()
    }
    if (end.includes('%')) {
      return Math.round(num) + '%'
    }
    if (end.includes('+')) {
      return Math.round(num).toLocaleString() + '+'
    }
    return Math.round(num).toString()
  }

  return (
    <span>
      {prefix}
      {hasAnimated ? formatNumber(count) : (
        end.includes('$') || end.includes('USD') ? (end.includes('USD') ? 'USD 0' : '$0') :
        end.includes('%') ? '0%' :
        end.includes('+') ? '0+' :
        '0'
      )}
      {suffix}
    </span>
  )
}

export default function Home() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [isVisible, setIsVisible] = useState(false)
  const [showFeatures, setShowFeatures] = useState(false)
  const [showRedirectMessage, setShowRedirectMessage] = useState(false)

  // Redirect authenticated users to dashboard (fallback to middleware)
  useEffect(() => {
    if (!loading && user && !window.location.search.includes('redirected')) {
      console.log('Home page: Authenticated user detected, preparing redirect', user.id)

      // Show redirect message for better UX
      setShowRedirectMessage(true)

      // Redirect after a short delay to allow message to be seen
      const timer = setTimeout(() => {
        console.log('Home page: Redirecting authenticated user to dashboard', user.id)
        router.push('/dashboard')
      }, 1500)

      return () => clearTimeout(timer)
    } else {
      setShowRedirectMessage(false)
    }
  }, [user, loading, router])

  useEffect(() => {
    // Small delay to ensure component is fully mounted before starting animation
    const timer = setTimeout(() => {
      console.log('Setting isVisible to true')
      setIsVisible(true)
    }, 500) // Increased delay to ensure DOM is ready

    // Set up scroll listener for features section
    const handleScroll = () => {
      const scrollY = window.scrollY
      const windowHeight = window.innerHeight

      // Show features when scrolled to second viewport
      if (scrollY > windowHeight * 0.8) {
        setShowFeatures(true)
      }
    }

    window.addEventListener('scroll', handleScroll)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

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

      {/* Hero Section - Full Viewport */}
      <section className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-4xl mx-auto">
            <div className="mb-6">
              <Sparkles className="h-6 w-6 mx-auto mb-4 text-primary" />
              <h2 className="text-lg font-medium text-muted-foreground mb-2">
                Nueva plataforma de gestión financiera
              </h2>
            </div>

            <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-primary via-primary to-primary/60 bg-clip-text text-transparent leading-tight">
              Gestiona tus gastos con Expenzo
            </h1>

            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto leading-relaxed">
              La forma más inteligente y moderna de controlar tus finanzas personales.
              Visualiza, organiza y optimiza tus ingresos y gastos en tiempo real.
            </p>

            {showRedirectMessage ? (
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 mb-6 max-w-md mx-auto">
                <div className="text-primary font-medium flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                  Redirigiendo al panel de control...
                </div>
              </div>
            ) : (
              <Button size="lg" className="text-lg px-8 py-3 cursor-pointer">
                Comenzar gratis
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* Marketing Numbers Section - Full Viewport */}
      <section className="min-h-screen flex items-center justify-center py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Resultados que hablan por sí solos
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Miles de usuarios ya están transformando su relación con el dinero
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <Card className="text-center border-0 shadow-lg bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20">
              <CardHeader className="pb-4">
                <DollarSign className="h-8 w-8 mx-auto mb-2 text-green-600 dark:text-green-400" />
                <CardTitle className="text-3xl font-bold text-green-600 dark:text-green-400">
                  <AnimatedCounter end="USD 500,000" isVisible={isVisible} />
                </CardTitle>
                <CardDescription className="text-base">
                  Gestionados anualmente
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="text-center border-0 shadow-lg bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20">
              <CardHeader className="pb-4">
                <Users className="h-8 w-8 mx-auto mb-2 text-blue-600 dark:text-blue-400" />
                <CardTitle className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                  <AnimatedCounter end="100+" isVisible={isVisible} />
                </CardTitle>
                <CardDescription className="text-base">
                  Usuarios activos en la plataforma
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="text-center border-0 shadow-lg bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20">
              <CardHeader className="pb-4">
                <TrendingUp className="h-8 w-8 mx-auto mb-2 text-purple-600 dark:text-purple-400" />
                <CardTitle className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                  <AnimatedCounter end="70%" isVisible={isVisible} />
                </CardTitle>
                <CardDescription className="text-base">
                  Reduccion en tareas administrativas
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="text-center border-0 shadow-lg bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20">
              <CardHeader className="pb-4">
                <Shield className="h-8 w-8 mx-auto mb-2 text-orange-600 dark:text-orange-400" />
                <CardTitle className="text-3xl font-bold text-orange-600 dark:text-orange-400">
                  <AnimatedCounter end="99.9%" isVisible={isVisible} />
                </CardTitle>
                <CardDescription className="text-base">
                  Tiempo de actividad de la plataforma
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* Features Section - Full Viewport */}
      <section className="min-h-screen flex items-center justify-center py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className={`text-center transition-all duration-1000 ${showFeatures ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              ¿Por qué elegir Expenzo?
            </h2>
            <p className="text-xl text-muted-foreground mb-16 max-w-3xl mx-auto">
              Hemos diseñado cada aspecto pensando en tu experiencia financiera
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
              <div className={`text-center transition-all duration-700 delay-100 ${showFeatures ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                <div className="bg-primary/10 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
                  <TrendingUp className="h-10 w-10 text-primary" />
                </div>
                <h3 className="text-2xl font-semibold mb-4">Análisis Inteligente</h3>
                <p className="text-muted-foreground text-lg leading-relaxed">
                  Obtén insights detallados sobre tus patrones de gasto con IA avanzada que aprende de tus hábitos financieros
                </p>
              </div>

              <div className={`text-center transition-all duration-700 delay-200 ${showFeatures ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                <div className="bg-primary/10 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
                  <Shield className="h-10 w-10 text-primary" />
                </div>
                <h3 className="text-2xl font-semibold mb-4">Seguridad Total</h3>
                <p className="text-muted-foreground text-lg leading-relaxed">
                  Tus datos están protegidos con encriptación de nivel bancario y protocolos de seguridad de última generación
                </p>
              </div>

              <div className={`text-center transition-all duration-700 delay-300 ${showFeatures ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                <div className="bg-primary/10 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
                  <Users className="h-10 w-10 text-primary" />
                </div>
                <h3 className="text-2xl font-semibold mb-4">Sincronización</h3>
                <p className="text-muted-foreground text-lg leading-relaxed">
                  Accede a tus datos desde cualquier dispositivo en tiempo real con sincronización perfecta
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12 bg-muted/30">
        <div className="container mx-auto px-4 text-center">
          <p className="text-muted-foreground">
            &copy; 2024 Expenzo. Todos los derechos reservados.
          </p>
        </div>
      </footer>
    </div>
  )
}

'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
  errorInfo?: ErrorInfo
  isChunkError: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, isChunkError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    // Check if it's a chunk loading error
    const isChunkError = error.message.includes('Loading chunk') ||
                        error.message.includes('ChunkLoadError') ||
                        error.message.includes('Loading CSS chunk')

    return {
      hasError: true,
      error,
      isChunkError
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)

    this.setState({
      error,
      errorInfo,
      isChunkError: error.message.includes('Loading chunk') ||
                   error.message.includes('ChunkLoadError') ||
                   error.message.includes('Loading CSS chunk')
    })

    // If it's a chunk loading error, try to reload the page after a delay
    if (this.state.isChunkError) {
      setTimeout(() => {
        window.location.reload()
      }, 2000)
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined, isChunkError: false })
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="max-w-md w-full text-center space-y-6">
            <div className="flex justify-center">
              <AlertTriangle className="h-16 w-16 text-destructive" />
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-bold">
                {this.state.isChunkError ? 'Error de carga' : 'Algo salió mal'}
              </h1>
              <p className="text-muted-foreground">
                {this.state.isChunkError
                  ? 'Hubo un problema al cargar algunos archivos de la aplicación. La página se recargará automáticamente.'
                  : 'Ocurrió un error inesperado. Por favor, intenta nuevamente.'
                }
              </p>
            </div>

            {this.state.isChunkError && (
              <div className="bg-muted p-4 rounded-lg text-sm text-left">
                <p className="font-medium mb-2">🔄 Recargando automáticamente...</p>
                <p className="text-muted-foreground">
                  Si la página no se recarga en unos segundos, haz clic en el botón de abajo.
                </p>
              </div>
            )}

            <div className="flex gap-3 justify-center">
              <Button onClick={this.handleRetry} variant="outline">
                <RefreshCw className="mr-2 h-4 w-4" />
                Reintentar
              </Button>
              <Button onClick={this.handleReload}>
                Recargar página
              </Button>
            </div>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-6 text-left">
                <summary className="cursor-pointer text-sm font-medium mb-2">
                  Detalles del error (desarrollo)
                </summary>
                <div className="bg-muted p-3 rounded text-xs font-mono overflow-auto max-h-40">
                  <div className="mb-2">
                    <strong>Error:</strong> {this.state.error.message}
                  </div>
                  {this.state.error.stack && (
                    <div>
                      <strong>Stack:</strong>
                      <pre className="whitespace-pre-wrap mt-1">
                        {this.state.error.stack}
                      </pre>
                    </div>
                  )}
                </div>
              </details>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

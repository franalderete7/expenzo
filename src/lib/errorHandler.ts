// Global error handler for chunk loading errors
export function setupGlobalErrorHandler() {
  if (typeof window !== 'undefined') {
    // Handle unhandled promise rejections (including chunk load errors)
    window.addEventListener('unhandledrejection', (event) => {
      const reason = event.reason
      if (reason && typeof reason === 'object' && 'message' in reason) {
        const message = String(reason.message)
        if (message.includes('Loading chunk') || message.includes('ChunkLoadError')) {
          console.warn('Chunk loading error detected, reloading page...')
          // Prevent the default handler
          event.preventDefault()
          // Reload the page after a short delay
          setTimeout(() => {
            window.location.reload()
          }, 1000)
        }
      }
    })

    // Handle global errors
    window.addEventListener('error', (event) => {
      const message = event.message || ''
      if (message.includes('Loading chunk') || message.includes('ChunkLoadError')) {
        console.warn('Chunk loading error detected in global error handler, reloading page...')
        event.preventDefault()
        setTimeout(() => {
          window.location.reload()
        }, 1000)
      }
    })

    // Handle service worker errors if any
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('error', (event) => {
        console.warn('Service worker error:', event)
      })
    }
  }
}

// Call this function early in the app lifecycle
if (typeof window !== 'undefined') {
  setupGlobalErrorHandler()
}

'use client'

import * as React from 'react'
import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { PwaRegister } from '@/components/pwa/pwa-register'
import { waitForOfflineHydration } from '@/lib/cache/client-query-cache'

// Suppress known false-positive React 19 script tag warning from next-themes in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  const origError = typeof console !== 'undefined' ? console.error : undefined
  if (typeof origError === 'function') {
    console.error = (...args: unknown[]) => {
      if (
        typeof args[0] === 'string' &&
        args[0].includes('Encountered a script tag while rendering React component')
      ) {
        return
      }
      try {
        origError.apply(console, args)
      } catch {
        // Fallback safely
      }
    }
  }
}

export default function Providers({ children }: { children: React.ReactNode }) {
  React.useEffect(() => {
    waitForOfflineHydration().catch(() => {})
  }, [])

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <PwaRegister />
      {children}
    </NextThemesProvider>
  )
}

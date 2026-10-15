import type { Metadata } from 'next'
import './globals.css'
import Providers from '@/app/providers'

export const metadata: Metadata = {
  title: 'Lab Management System | LabSync LIMS',
  description: 'Institutional Laboratory Operations, Practical Scheduling & Maintenance Terminal',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className="h-full antialiased font-sans"
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Noto+Sans+Devanagari:wght@400;500;600;700&family=Outfit:wght@500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap"
        />
      </head>
      <body className="min-h-full flex flex-col bg-slate-50 dark:bg-[#0B0F19] text-zinc-900 dark:text-zinc-100 transition-colors duration-200">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}

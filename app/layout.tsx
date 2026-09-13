import type { Metadata } from 'next'
import { Plus_Jakarta_Sans, Inter, Noto_Sans_Devanagari, JetBrains_Mono, Outfit } from 'next/font/google'
import './globals.css'
import Providers from '@/app/providers'

const outfit = Outfit({
  variable: '--font-display-source',
  subsets: ['latin'],
  display: 'swap',
})

const jakarta = Plus_Jakarta_Sans({
  variable: '--font-heading-source',
  subsets: ['latin'],
  display: 'swap',
})

const inter = Inter({
  variable: '--font-sans-source',
  subsets: ['latin'],
  display: 'swap',
})

const notoDevanagari = Noto_Sans_Devanagari({
  variable: '--font-devanagari',
  subsets: ['devanagari'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
})

const mono = JetBrains_Mono({
  variable: '--font-mono-source',
  subsets: ['latin'],
  display: 'swap',
})

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
      className={`${outfit.variable} ${jakarta.variable} ${inter.variable} ${notoDevanagari.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-slate-50 dark:bg-[#0B0F19] text-zinc-900 dark:text-zinc-100 transition-colors duration-200">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}

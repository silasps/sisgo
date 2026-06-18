import type { Metadata, Viewport } from 'next'
import './globals.css'
import { BiometricLock } from '@/components/BiometricLock'

export const metadata: Metadata = {
  title: 'SISGO',
  description: 'Sistema de Gestão de Bases Missionárias',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'SISGO',
  },
}

export const viewport: Viewport = {
  themeColor: '#15343B',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
      </head>
      <body>
        {children}
        <BiometricLock />
      </body>
    </html>
  )
}

import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'SISGO',
  description: 'Sistema de Gestão de Bases Missionárias',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}

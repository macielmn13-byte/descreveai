import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'DescreveAí — Descrições que vendem',
  description: 'Gere descrições de produto otimizadas com IA em 3 segundos.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Mettkey Content Engine',
  description: 'Internal content-generation dashboard for Mettkey — a California mortgage education platform. Blog, social, and newsletter content generation with built-in compliance checks.',
  robots: { index: false, follow: false },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Playfair+Display:wght@400;500&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  )
}

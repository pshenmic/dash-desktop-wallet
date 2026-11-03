import type { Metadata, Viewport } from 'next'
import { Manrope } from 'next/font/google'
import type { ReactNode } from 'react'
import { Providers } from './Providers'
import './globals.css'

const manrope = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-manrope',
})

const siteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : 'http://localhost:3000'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'Dash Desktop Wallet',
  description:
    'Dash Desktop Wallet — Core payments, Platform identities and shielded transactions. Non-custodial and open source for macOS, Windows and Linux.',
  openGraph: {
    title: 'Dash Desktop Wallet',
    description: 'Dash Desktop Wallet — Core payments, Platform identities and shielded transactions.',
    images: '/icon.png',
  },
  twitter: { card: 'summary' },
  icons: { icon: { url: '/icon.png', type: 'image/png' } },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#4C7EFF',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={manrope.variable}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
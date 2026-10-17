import type { Metadata, Viewport } from 'next'
import { Fraunces, Geist, Geist_Mono } from 'next/font/google'
import { headers } from 'next/headers'
import type { ReactNode } from 'react'
import { THEME_HEADER } from '../proxy.ts'
import { publicConfig } from '../server/config.ts'
import { getConfig } from '../server/container.ts'
import { Providers } from '../src/state/Providers'
import '../src/index.css'

const display = Fraunces({ subsets: ['latin'], style: ['normal', 'italic'], variable: '--font-display' })
const sans = Geist({ subsets: ['latin'], variable: '--font-body' })
const mono = Geist_Mono({ subsets: ['latin'], variable: '--font-code' })

const TITLE = 'Image Text Editor · Change text in any image, keep the exact font'

export function generateMetadata(): Metadata {
  return {
    metadataBase: new URL(getConfig().APP_ORIGIN),
    title: 'Image Text Editor · Change text in any image, keep the same font',
    description:
      'Replace text in any image and keep the original font, size, colour and slant. Free text detection, font-matched edits, crop and PNG/PDF download. Pixel-perfect AI edits, paid per edit.',
    icons: { icon: { url: '/favicon.svg', type: 'image/svg+xml' } },
    openGraph: {
      type: 'website',
      title: TITLE,
      description: "Click a line of text, type new words, and they're redrawn in the original lettering.",
      images: '/media/hero-poster.jpg',
    },
    twitter: { card: 'summary_large_image' },
  }
}

export const viewport: Viewport = { themeColor: '#16150f' }

export default async function RootLayout({ children }: { children: ReactNode }) {
  const theme = (await headers()).get(THEME_HEADER) ?? 'light'
  const config = getConfig()
  return (
    <html lang="en" data-theme={theme} className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body>
        <div id="root">
          <Providers initialConfig={publicConfig(config, config.cashfree !== null)}>{children}</Providers>
        </div>
      </body>
    </html>
  )
}

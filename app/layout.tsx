import type { Metadata, Viewport } from 'next'
import { headers } from 'next/headers'
import type { ReactNode } from 'react'
import { THEME_HEADER } from '../proxy.ts'
import { getConfig } from '../server/container.ts'
import { Providers } from '../src/state/Providers'
import '../src/index.css'

const TITLE = 'Image Text Editor · Change text in any image, keep the exact font'

export function generateMetadata(): Metadata {
  return {
    // Social previews need absolute image URLs.
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

export const viewport: Viewport = { themeColor: '#0f1115' }

export default async function RootLayout({ children }: { children: ReactNode }) {
  const theme = (await headers()).get(THEME_HEADER) ?? 'light'
  return (
    <html lang="en" data-theme={theme}>
      <body>
        {/* The stylesheet sizes #root to the full window, as in the old single-page app. */}
        <div id="root">
          <Providers>{children}</Providers>
        </div>
      </body>
    </html>
  )
}

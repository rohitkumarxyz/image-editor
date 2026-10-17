import { getConfig } from '../../server/container.ts'

export const dynamic = 'force-dynamic'

const PUBLIC_PAGES = ['/', '/terms', '/privacy', '/refunds', '/contact']

export function GET(): Response {
  const origin = getConfig().APP_ORIGIN
  const urls = PUBLIC_PAGES.map((p) => `  <url><loc>${origin}${p === '/' ? '' : p}</loc></url>`).join('\n')
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  })
}

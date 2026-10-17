import { getConfig } from '../../server/container.ts'

export const dynamic = 'force-dynamic'

export function GET(): Response {
  const origin = getConfig().APP_ORIGIN
  return new Response(`User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /account\nSitemap: ${origin}/sitemap.xml\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}

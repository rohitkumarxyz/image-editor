import type { NextConfig } from 'next'

const ONE_HOUR = 'public, max-age=3600'

const nextConfig: NextConfig = {
  // One self-contained server folder for the Docker image.
  output: 'standalone',
  poweredByHeader: false,
  reactStrictMode: true,
  // Images, videos and the icon in /public; hashed /_next/static files are already cached for a year by Next.js.
  headers: async () => [
    { source: '/media/:path*', headers: [{ key: 'Cache-Control', value: ONE_HOUR }] },
    { source: '/examples/:path*', headers: [{ key: 'Cache-Control', value: ONE_HOUR }] },
    { source: '/favicon.svg', headers: [{ key: 'Cache-Control', value: ONE_HOUR }] },
  ],
}

export default nextConfig

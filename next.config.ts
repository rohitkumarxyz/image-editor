import type { NextConfig } from 'next'

const ONE_HOUR = 'public, max-age=3600'

const nextConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  reactStrictMode: true,
  headers: async () => [
    { source: '/media/:path*', headers: [{ key: 'Cache-Control', value: ONE_HOUR }] },
    { source: '/examples/:path*', headers: [{ key: 'Cache-Control', value: ONE_HOUR }] },
    { source: '/favicon.svg', headers: [{ key: 'Cache-Control', value: ONE_HOUR }] },
  ],
}

export default nextConfig

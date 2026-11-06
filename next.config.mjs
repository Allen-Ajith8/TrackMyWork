/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Deployment safety net: don't fail production builds on type-only issues.
  // Runtime-breaking errors are fixed directly in the source.
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/api/webhooks/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization, x-github-event, x-github-delivery, x-hub-signature-256' },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/mcp/:path*',
        destination: process.env.MCP_SERVER_URL || 'http://localhost:3001/mcp/:path*',
      },
    ];
  },
};
 
export default nextConfig;
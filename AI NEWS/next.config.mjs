import withPWA from 'next-pwa';

const isProd = process.env.NODE_ENV === 'production';

const withPwa = withPWA({
  dest: 'public',
  disable: !isProd,
});

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'X-XSS-Protection', value: '0' }
];

const nextConfig = {
  reactStrictMode: true,
  experimental: {
    appDir: true
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: '**' }
    ]
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders
      }
    ];
  }
};

export default withPwa(nextConfig);
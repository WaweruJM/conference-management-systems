const nextConfig = {
  output: 'standalone',
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: 'https', hostname: 'avatars.githubusercontent.com', pathname: '/**' },
    ],
  },
  // Renamed from experimental.serverComponentsExternalPackages in Next 15
  serverExternalPackages: ['mongodb', 'pdfkit'],
  webpack(config, { dev }) {
    if (dev) {
      // Reduce CPU/memory from file watching
      config.watchOptions = {
        poll: 2000, // check every 2 seconds
        aggregateTimeout: 300, // wait before rebuilding
        ignored: ['**/node_modules'],
      };
    }
    return config;
  },
  onDemandEntries: {
    maxInactiveAge: 10000,
    pagesBufferLength: 2,
  },
  async headers() {
    // SECURITY: hardened security headers. Frame-ancestors is deliberately
    // scoped to same-origin only to prevent clickjacking. CORS is left to
    // the API route handler (which knows the request origin) so we don't
    // set a wildcard here.
    const isProd = process.env.NODE_ENV === 'production'
    const csp = [
      "default-src 'self'",
      "img-src 'self' data: https:",
      "media-src 'self' https: blob:",
      "font-src 'self' https: data:",
      // Next.js needs inline scripts for hydration
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:",
      "style-src 'self' 'unsafe-inline' https:",
      "connect-src 'self' https: wss: ws:",
      "frame-src 'self' https:",
      "frame-ancestors 'self'",
      "form-action 'self'",
      "base-uri 'self'",
      "object-src 'none'",
    ].join('; ')
    const commonHeaders = [
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "geolocation=(), microphone=(self), camera=(self)" },
      { key: "Content-Security-Policy", value: csp },
    ]
    if (isProd) {
      commonHeaders.push({ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" })
    }
    return [
      {
        source: "/(.*)",
        headers: commonHeaders,
      },
    ];
  },
};

module.exports = nextConfig;

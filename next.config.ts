import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  allowedDevOrigins: [
    '192.168.1.2',
    '192.168.1.2:3000',
    '192.168.1.5',
    '192.168.1.5:3000',
    '192.168.2.17',
    '192.168.2.17:3000',
    '192.168.1.3',
    '192.168.1.3:3000',
    '192.168.1.4',
    '192.168.1.4:3000',
    'localhost',
    'localhost:3000',
    '127.0.0.1',
    '127.0.0.1:3000',
  ],
  serverExternalPackages: ['pg'],
  experimental: {
    optimizePackageImports: ['lucide-react', 'date-fns'],
  },
  async redirects() {
    return [
      {
        source: '/logs/new',
        destination: '/records/new',
        permanent: true,
      },
      {
        source: '/logs',
        destination: '/records',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;

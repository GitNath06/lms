import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['192.168.1.4', 'localhost:3000', '127.0.0.1:3000'],
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

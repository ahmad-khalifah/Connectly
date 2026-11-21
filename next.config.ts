import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Admin detail pages moved to static pages that take ?id= (see
  // lib/http/admin-api.ts, which answers the same redirects on Cloudflare).
  async redirects() {
    return [
      { source: '/admin/customers/:id([0-9a-fA-F-]{36})', destination: '/admin/customer?id=:id', permanent: true },
    ];
  },
};

export default nextConfig;

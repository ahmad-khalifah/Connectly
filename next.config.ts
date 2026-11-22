import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Admin detail pages moved to static pages that take ?id= (see
  // lib/http/admin-api.ts, which answers the same redirects on Cloudflare).
  async redirects() {
    return [
      // The old marketing page moved to Solutions.
      { source: '/wifi', destination: '/solutions', permanent: true },
      { source: '/admin/customers/:id([0-9a-fA-F-]{36})', destination: '/admin/customer?id=:id', permanent: true },
      { source: '/admin/plans/:id([0-9a-fA-F-]{36})', destination: '/admin/plan?id=:id', permanent: true },
      { source: '/admin/locations/:id([0-9a-fA-F-]{36})', destination: '/admin/location?id=:id', permanent: true },
      { source: '/admin/locations/:id([0-9a-fA-F-]{36})/edit', destination: '/admin/location/edit?id=:id', permanent: true },
      { source: '/admin/network/routers/:id([0-9a-fA-F-]{36})', destination: '/admin/network/router?id=:id', permanent: true },
      { source: '/admin/network/routers/:id([0-9a-fA-F-]{36})/edit', destination: '/admin/network/router/edit?id=:id', permanent: true },
    ];
  },
};

export default nextConfig;

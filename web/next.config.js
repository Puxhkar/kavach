/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The floating dev badge covers content in screen recordings of the app.
  devIndicators: false,
  // web/ is its own pnpm project; don't let Next guess a root further up the tree.
  turbopack: { root: __dirname },
  outputFileTracingRoot: __dirname,
  // A self-contained server.js, so the deploy image can run the site next to the API.
  output: "standalone",
  // In the single-service deploy the browser calls /api/v1 on the site itself and the
  // site forwards it to the API in the same container: one origin, nothing to wake up twice.
  async rewrites() {
    const api = process.env.NARADA_INTERNAL_URL || "http://127.0.0.1:8010";
    return [{ source: "/api/v1/:path*", destination: `${api}/api/v1/:path*` }];
  },
  // Test runs and voice turns can take a while; don't cut the forwarded request short.
  experimental: { proxyTimeout: 180_000 },
};

module.exports = nextConfig;

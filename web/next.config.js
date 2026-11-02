/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The floating dev badge covers content in screen recordings of the app.
  devIndicators: false,
  // web/ is its own pnpm project; don't let Next guess a root further up the tree.
  turbopack: { root: __dirname },
};

module.exports = nextConfig;

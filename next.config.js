/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  images: { unoptimized: true },
  reactStrictMode: true,
  output: "standalone", // Important for Render or Docker
  webpack: (config) => {
    config.resolve.alias["undici"] = false;
    return config;
  },
};

module.exports = nextConfig;

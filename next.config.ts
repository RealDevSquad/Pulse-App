import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Enable React strict mode for better development experience
  reactStrictMode: true,
  
  // TEMPORARY: Enable source maps to debug production errors
  // Remove this after debugging!
  productionBrowserSourceMaps: true,
};

export default nextConfig;

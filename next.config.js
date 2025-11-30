/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Allow dev server access from other devices on local network (mobile testing)
  allowedDevOrigins: ['192.168.21.19'],
  experimental: {
    // Turbopack is enabled by default in Next.js 16+
  },
};

export default nextConfig;

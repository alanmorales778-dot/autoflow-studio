/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  images: { unoptimized: true },
  serverExternalPackages: ['nodemailer'],
  experimental: {
    serverActions: { bodySizeLimit: '5mb' },
  },
};

export default nextConfig;

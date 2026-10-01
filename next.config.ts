import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  basePath: '/dashboard',
  devIndicators: false,
  // k3s에 올릴 때 가벼운 이미지를 만들기 위해 (Dockerfile 참고)
  output: 'standalone',
};

export default nextConfig;

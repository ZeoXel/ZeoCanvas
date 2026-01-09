import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 增加请求体大小限制 (用于 Base64 图片上传)
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
  // API 路由配置
  serverExternalPackages: [],
};

export default nextConfig;

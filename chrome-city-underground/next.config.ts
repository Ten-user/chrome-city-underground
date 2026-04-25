import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  allowedDevOrigins: [
    'preview-chat-b41a4dd5-7895-468d-8daa-fa29137afa36.space.z.ai',
    '.space.chatglm.site',
    '.space.z.ai',
    '.chatglm.site',
    '.z.ai',
    'localhost',
  ],
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 自托管：输出独立运行包，Docker 镜像只需拷贝 .next/standalone
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // 除登录页外所有页面都需要会话，开发时的自动「即时导航」校验无法在没有会话的模拟渲染中完成，
    // 只会产生无效提示。改为仅校验显式导出 instant 的路由段。
    instantInsights: { validationLevel: "manual-warning" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

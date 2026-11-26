import { fileURLToPath } from "node:url";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwind from "@tailwindcss/postcss";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

// 本地开发时，Hyperdrive 直接连接 .env 中的 DATABASE_URL（CI 中没有 .env，构建不需要）
try {
  process.loadEnvFile();
  process.env.CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE ??= process.env.DATABASE_URL;
} catch {
  // 没有 .env 时跳过
}

/** 服务端模块：只能在 Worker 中运行，前端引用时构建直接报错，避免把数据库代码打进浏览器 */
const SERVER_MODULE =
  /\/src\/server\/|\/workers\/|\/src\/features\/[^/]+\/(queries|mutations|service|routes)\.ts$|\/src\/features\/assistant\/(providers\/|tools|topic-reply|tool-definition)/;

function serverOnly(): Plugin {
  return {
    name: "nowx:server-only",
    applyToEnvironment: (environment) => environment.name === "client",
    transform(_code, id) {
      if (SERVER_MODULE.test(id)) this.error(`前端代码不能引用服务端模块：${id}`);
    },
  };
}

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  css: { postcss: { plugins: [tailwind()] } },
  plugins: [react(), cloudflare(), serverOnly()],
});

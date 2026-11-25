import { fileURLToPath } from "node:url";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwind from "@tailwindcss/postcss";
import { defineConfig } from "vite";
import vinext from "vinext";

const workers = (file: string) => fileURLToPath(new URL(`./workers/${file}`, import.meta.url));

export default defineConfig({
  define: { "process.env.NOWX_WORKERS_BUILD": JSON.stringify("1") },
  css: { postcss: { plugins: [tailwind()] } },
  resolve: {
    alias: {
      "@/server/storage": workers("storage.ts"),
      "@/server/events": workers("events-adapter.ts"),
      "@/components/layout/live-updates": workers("live-updates.tsx"),
      "@/server/db": workers("database.ts"),
      "@/server/rate-limit": workers("rate-limit-client.ts"),
      "@/server/auth/password": workers("password-client.ts"),
    },
  },
  plugins: [
    // Next.js 的 standalone 产物仅用于现有 Docker 部署。
    vinext({ nextConfig: {} }),
    cloudflare({ viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] } }),
  ],
});

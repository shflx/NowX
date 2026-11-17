// Prisma CLI 配置（Prisma 7 起数据库连接串在这里声明，而不是 schema 中）
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // 直接读取环境变量而不用 env()：安装依赖时执行 prisma generate 不需要数据库连接，缺少该变量不应报错
    url: process.env.DATABASE_URL,
  },
});

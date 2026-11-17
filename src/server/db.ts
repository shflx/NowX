import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

function createClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

// 开发环境热更新会重复执行模块，挂到 globalThis 上复用同一个实例，避免连接池耗尽
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}

/** 事务回调中使用的客户端类型 */
export type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];

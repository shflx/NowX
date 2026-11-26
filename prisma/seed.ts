// 初始化数据：创建第一个管理员账号（已存在则跳过）。
// 运行：pnpm db:seed（读取 .env 中的 SEED_ADMIN_* 变量）
import "dotenv/config";

// 密码哈希与线上 PasswordHash 使用相同的 Argon2id 参数（库的默认值 m=19456, t=2, p=1）
import { hash as hashPassword } from "@node-rs/argon2";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "./generated/client";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

async function main() {
  const login = (process.env.SEED_ADMIN_LOGIN || "admin").toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  const name = process.env.SEED_ADMIN_NAME || "管理员";

  if (!password || password.length < 8) {
    throw new Error("请在环境变量中设置至少 8 位的 SEED_ADMIN_PASSWORD");
  }

  const existing = await db.user.findUnique({ where: { login } });
  if (existing) {
    console.log(`管理员 ${login} 已存在，跳过`);
    return;
  }

  await db.user.create({
    data: {
      login,
      name,
      title: "管理员",
      role: "ADMIN",
      color: "#4f46e5",
      passwordHash: await hashPassword(password),
      // 种子密码写在环境变量里，首次登录强制修改
      mustChangePassword: true,
    },
  });
  console.log(`已创建管理员 ${login}，首次登录后需要修改密码`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());

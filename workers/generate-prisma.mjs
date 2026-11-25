import { execFileSync } from "node:child_process";
import { readFileSync, unlinkSync, writeFileSync } from "node:fs";

// 两个运行时共用 Prisma 模型。Workers 构建生成独立的查询引擎，供 workerd 加载。
const source = new URL("../prisma/schema.prisma", import.meta.url);
const target = new URL("./.schema.prisma", import.meta.url);
const contents = readFileSync(source, "utf8").replace(
  /generator client \{[^}]+\}/,
  'generator client {\n  provider = "prisma-client"\n  runtime = "workerd"\n  output = "./.generated/prisma"\n}',
);
writeFileSync(target, contents);
try {
  execFileSync("pnpm", ["exec", "prisma", "generate", "--schema", "workers/.schema.prisma"], { stdio: "inherit" });
} finally {
  unlinkSync(target);
}

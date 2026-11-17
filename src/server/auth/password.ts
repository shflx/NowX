// 密码哈希：使用 Argon2id（OWASP 推荐算法），参数采用库的默认值
// 注意：本文件不引入 server-only，以便种子脚本复用
import { hash, verify } from "@node-rs/argon2";

export function hashPassword(password: string) {
  return hash(password);
}

export async function verifyPassword(passwordHash: string, password: string) {
  try {
    return await verify(passwordHash, password);
  } catch {
    // 哈希格式损坏时按校验失败处理，避免把内部错误暴露给登录接口
    return false;
  }
}

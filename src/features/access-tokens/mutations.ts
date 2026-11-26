import { z } from "zod";

import { parseInput } from "@/lib/action-result";
import { requireUser } from "@/server/auth/dal";
import { createPersonalAccessToken, revokePersonalAccessToken } from "@/server/auth/personal-access-token";

const nameSchema = z.string().trim().min(1, "请输入令牌名称").max(80, "令牌名称不能超过 80 个字符");
const idSchema = z.cuid();

export async function createMyAccessToken(input: unknown) {
  const user = await requireUser();
  const { name } = parseInput(z.object({ name: nameSchema }), input);
  const { token } = await createPersonalAccessToken(user.id, name);
  return { token };
}

export async function revokeMyAccessToken(input: unknown) {
  const user = await requireUser();
  await revokePersonalAccessToken(user.id, parseInput(idSchema, input));
}

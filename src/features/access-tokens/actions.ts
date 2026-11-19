"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { parseInput } from "@/lib/action-result";
import { runAction } from "@/server/action";
import { requireUser } from "@/server/auth/dal";
import {
  createPersonalAccessToken,
  listPersonalAccessTokens,
  revokePersonalAccessToken,
} from "@/server/auth/personal-access-token";

const nameSchema = z.string().trim().min(1, "请输入令牌名称").max(80, "令牌名称不能超过 80 个字符");
const idSchema = z.cuid();

export async function listMyAccessTokens() {
  const user = await requireUser();
  const tokens = await listPersonalAccessTokens(user.id);
  const now = Date.now();
  return tokens.map((token) => ({ ...token, expired: token.expiresAt.getTime() <= now }));
}

export async function createMyAccessToken(input: unknown) {
  return runAction(async () => {
    const user = await requireUser();
    const { name } = parseInput(z.object({ name: nameSchema }), input);
    const { token } = await createPersonalAccessToken(user.id, name);
    refresh();
    return { token };
  });
}

export async function revokeMyAccessToken(input: unknown) {
  return runAction(async () => {
    const user = await requireUser();
    await revokePersonalAccessToken(user.id, parseInput(idSchema, input));
    refresh();
  });
}

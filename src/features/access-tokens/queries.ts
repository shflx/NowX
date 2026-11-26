import { listPersonalAccessTokens } from "@/server/auth/personal-access-token";

/** 我的个人访问令牌（不含令牌明文），附带是否已过期 */
export async function listMyAccessTokens(userId: string) {
  const tokens = await listPersonalAccessTokens(userId);
  const now = Date.now();
  return tokens.map((token) => ({ ...token, expired: token.expiresAt.getTime() <= now }));
}

export type AccessTokenRow = Awaited<ReturnType<typeof listMyAccessTokens>>[number];

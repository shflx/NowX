import { ActionError, parseInput } from "@/lib/action-result";
import { AVATAR_COLORS } from "@/lib/constants";
import { generatePassword } from "@/lib/password";
import { requireAdmin } from "@/server/auth/dal";
import { hashPassword } from "@/server/auth/password";
import { revokeUserPersonalAccessTokens } from "@/server/auth/personal-access-token";
import { deleteUserSessions } from "@/server/auth/session";
import { db, type Tx } from "@/server/db";
import { cuid } from "@/server/db/id";

import { usageCounts } from "./queries";
import { accountFieldsSchema, createAccountSchema } from "./schemas";

/** 发给新成员的登录信息（密码只在这里返回一次，不会再次展示） */
export type Credentials = { name: string; login: string; password: string };

/** 让账号的项目成员关系与勾选结果一致 */
async function syncMemberships(tx: Tx, userId: string, projectIds: string[]) {
  let removal = tx.deleteFrom("ProjectMember").where("userId", "=", userId);
  if (projectIds.length > 0) removal = removal.where("projectId", "not in", projectIds);
  await removal.execute();
  if (projectIds.length > 0) {
    await tx
      .insertInto("ProjectMember")
      .values(projectIds.map((projectId) => ({ projectId, userId })))
      .onConflict((oc) => oc.doNothing())
      .execute();
  }
}

export async function createAccount(input: unknown): Promise<Credentials> {
  await requireAdmin();
  const data = parseInput(createAccountSchema, input);

  if (await db.selectFrom("User").select("id").where("login", "=", data.login).executeTakeFirst()) {
    throw new ActionError(`登录名 ${data.login} 已被使用`, { login: "登录名已被使用" });
  }

  const { count } = await db
    .selectFrom("User")
    .select((eb) => eb.fn.countAll<string>().as("count"))
    .executeTakeFirstOrThrow();
  const passwordHash = await hashPassword(data.password);
  await db.transaction().execute(async (tx) => {
    const id = cuid();
    await tx
      .insertInto("User")
      .values({
        id,
        login: data.login,
        name: data.name,
        title: data.title,
        role: data.role,
        color: AVATAR_COLORS[Number(count) % AVATAR_COLORS.length],
        passwordHash,
        mustChangePassword: true,
        updatedAt: new Date(),
      })
      .execute();
    await syncMemberships(tx, id, data.projectIds);
  });

  return { name: data.name, login: data.login, password: data.password };
}

export async function updateAccount(userId: string, input: unknown) {
  const admin = await requireAdmin();
  const data = parseInput(accountFieldsSchema, input);
  if (userId === admin.id && data.role !== "ADMIN") {
    throw new ActionError("不能取消自己的管理员角色");
  }

  await db.transaction().execute(async (tx) => {
    await tx
      .updateTable("User")
      .set({ name: data.name, title: data.title, role: data.role, updatedAt: new Date() })
      .where("id", "=", userId)
      .execute();
    await syncMemberships(tx, userId, data.projectIds);
  });
}

export async function resetAccountPassword(userId: string): Promise<Credentials> {
  await requireAdmin();
  const password = generatePassword();
  const passwordHash = await hashPassword(password);
  const user = await db.transaction().execute(async (tx) => {
    const updated = await tx
      .updateTable("User")
      .set({ passwordHash, mustChangePassword: true, updatedAt: new Date() })
      .where("id", "=", userId)
      .returning(["name", "login"])
      .executeTakeFirst();
    if (!updated) throw new ActionError("账号不存在");
    await revokeUserPersonalAccessTokens(tx, userId);
    return updated;
  });
  // 旧密码登录的会话全部失效
  await deleteUserSessions(userId);
  return { name: user.name, login: user.login, password };
}

export async function setAccountStatus(userId: string, status: "ACTIVE" | "DISABLED") {
  const admin = await requireAdmin();
  if (userId === admin.id) throw new ActionError("不能停用自己的账号");

  await db.transaction().execute(async (tx) => {
    await tx.updateTable("User").set({ status, updatedAt: new Date() }).where("id", "=", userId).execute();
    if (status === "DISABLED") await revokeUserPersonalAccessTokens(tx, userId);
  });
  if (status === "DISABLED") await deleteUserSessions(userId);
}

/**
 * 删除账号：只允许删除没有留下协作记录的账号（例如建错、从未使用的账号）。
 * 已参与协作的账号请停用，以保留任务、帖子等历史中的作者信息。
 */
export async function deleteAccount(userId: string) {
  const admin = await requireAdmin();
  if (userId === admin.id) throw new ActionError("不能删除自己的账号");

  const user = await db
    .selectFrom("User")
    .select(["name", usageCounts().as("counts")])
    .where("id", "=", userId)
    .executeTakeFirst();
  if (!user) throw new ActionError("账号不存在");

  const { name, counts } = user;
  if (Object.values(counts).some((n) => n > 0)) {
    throw new ActionError(`${name} 已有任务、帖子等协作记录，不能删除；如不再使用，请停用该账号`);
  }

  // 会话、访问令牌、项目成员关系、通知随账号级联删除；负责的需求、指定回答的帖子置空
  await db.deleteFrom("User").where("id", "=", userId).execute();
  return { name };
}

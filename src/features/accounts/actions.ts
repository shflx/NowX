"use server";

import { refresh } from "next/cache";

import { ActionError, parseInput } from "@/lib/action-result";
import { AVATAR_COLORS } from "@/lib/constants";
import { requireAdmin } from "@/server/auth/dal";
import { generatePassword } from "@/lib/password";
import { hashPassword } from "@/server/auth/password";
import { deleteUserSessions } from "@/server/auth/session";
import { runAction } from "@/server/action";
import { db, type Tx } from "@/server/db";

import { accountFieldsSchema, createAccountSchema } from "./schemas";

/** 发给新成员的登录信息（密码只在这里返回一次，不会再次展示） */
export type Credentials = { name: string; login: string; password: string };

/** 让账号的项目成员关系与勾选结果一致 */
async function syncMemberships(tx: Tx, userId: string, projectIds: string[]) {
  await tx.projectMember.deleteMany({ where: { userId, projectId: { notIn: projectIds } } });
  await tx.projectMember.createMany({
    data: projectIds.map((projectId) => ({ projectId, userId })),
    skipDuplicates: true,
  });
}

export async function createAccount(input: unknown) {
  return runAction<Credentials>(async () => {
    await requireAdmin();
    const data = parseInput(createAccountSchema, input);

    if (await db.user.findUnique({ where: { login: data.login } })) {
      throw new ActionError(`登录名 ${data.login} 已被使用`, { login: "登录名已被使用" });
    }

    const count = await db.user.count();
    await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          login: data.login,
          name: data.name,
          title: data.title,
          role: data.role,
          color: AVATAR_COLORS[count % AVATAR_COLORS.length],
          passwordHash: await hashPassword(data.password),
          mustChangePassword: true,
        },
      });
      await syncMemberships(tx, user.id, data.projectIds);
    });

    refresh();
    return { name: data.name, login: data.login, password: data.password };
  });
}

export async function updateAccount(userId: string, input: unknown) {
  return runAction(async () => {
    const admin = await requireAdmin();
    const data = parseInput(accountFieldsSchema, input);
    if (userId === admin.id && data.role !== "ADMIN") {
      throw new ActionError("不能取消自己的管理员角色");
    }

    await db.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { name: data.name, title: data.title, role: data.role } });
      await syncMemberships(tx, userId, data.projectIds);
    });
    refresh();
  });
}

export async function resetAccountPassword(userId: string) {
  return runAction<Credentials>(async () => {
    await requireAdmin();
    const password = generatePassword();
    const user = await db.user.update({
      where: { id: userId },
      data: { passwordHash: await hashPassword(password), mustChangePassword: true },
    });
    // 旧密码登录的会话全部失效
    await deleteUserSessions(userId);
    refresh();
    return { name: user.name, login: user.login, password };
  });
}

export async function setAccountStatus(userId: string, status: "ACTIVE" | "DISABLED") {
  return runAction(async () => {
    const admin = await requireAdmin();
    if (userId === admin.id) throw new ActionError("不能停用自己的账号");

    await db.user.update({ where: { id: userId }, data: { status } });
    if (status === "DISABLED") await deleteUserSessions(userId);
    refresh();
  });
}

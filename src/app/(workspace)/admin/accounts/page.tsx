import type { Metadata } from "next";

import { NoPermission } from "@/components/shared/no-permission";
import { AccountsTable } from "@/features/accounts/components/accounts-table";
import { listAccounts } from "@/features/accounts/queries";
import { formatRelative } from "@/lib/dates";
import { isAdmin, requireUser } from "@/server/auth/dal";
import { appConfig } from "@/server/config";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "账号管理" };

export default async function AccountsPage() {
  const user = await requireUser();
  if (!isAdmin(user)) return <NoPermission feature="账号管理" />;

  const [accounts, projects] = await Promise.all([
    listAccounts(),
    db.project.findMany({ where: { archivedAt: null }, orderBy: { createdAt: "asc" }, select: { id: true, key: true, name: true, color: true } }),
  ]);
  const now = new Date();

  return (
    <AccountsTable
      accounts={accounts.map((a) => ({
        ...a,
        lastLogin: a.lastLoginAt ? formatRelative(a.lastLoginAt, appConfig.timeZone, now) : "从未登录",
      }))}
      projects={projects}
      currentUserId={user.id}
      appUrl={appConfig.appUrl}
    />
  );
}

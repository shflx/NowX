import { useAppConfig } from "@/components/layout/workspace-context";
import { NoPermission } from "@/components/shared/no-permission";
import { PageTitle } from "@/components/shared/page-title";
import { AccountsTable } from "@/features/accounts/components/accounts-table";
import type { AccountsData } from "@/features/accounts/routes";
import { formatRelative } from "@/lib/dates";
import { useApi } from "@/lib/query";

export default function AccountsPage() {
  const data = useApi<AccountsData>("/api/admin/accounts");
  const { timeZone, appUrl } = useAppConfig();
  const now = new Date();

  return (
    <>
      <PageTitle title="账号管理" />
      {data.allowed ? (
        <AccountsTable
          accounts={data.accounts.map((a) => ({
            ...a,
            lastLogin: a.lastLoginAt ? formatRelative(a.lastLoginAt, timeZone, now) : "从未登录",
          }))}
          projects={data.projects}
          currentUserId={data.user.id}
          appUrl={appUrl}
        />
      ) : (
        <NoPermission feature="账号管理" />
      )}
    </>
  );
}

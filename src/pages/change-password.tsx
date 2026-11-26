import { Suspense } from "react";

import { PageTitle } from "@/components/shared/page-title";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChangePasswordForm } from "@/features/auth/components/change-password-form";
import { useApi } from "@/lib/query";
import type { CurrentUser } from "@/server/auth/dal";

export default function ChangePasswordPage() {
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <PageTitle title="修改密码" />
      <Card className="w-full max-w-md">
        <Suspense>
          <ChangePasswordContent />
        </Suspense>
      </Card>
    </main>
  );
}

function ChangePasswordContent() {
  // 未登录时接口返回 401，统一跳转登录页
  const { user } = useApi<{ user: CurrentUser }>("/api/session");

  return (
    <>
      <CardHeader>
        <CardTitle>{user.mustChangePassword ? "设置新密码" : "修改密码"}</CardTitle>
        <CardDescription>
          {user.mustChangePassword
            ? `${user.name}，欢迎加入。首次登录请先把初始密码改成只有你知道的密码。`
            : "修改后，其他设备上的登录会失效。"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChangePasswordForm />
      </CardContent>
    </>
  );
}

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChangePasswordForm } from "@/features/auth/components/change-password-form";
import { getCurrentUser } from "@/server/auth/dal";

export const metadata: Metadata = { title: "修改密码" };

export default function ChangePasswordPage() {
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <Card className="w-full max-w-md">
        <Suspense>
          <ChangePasswordContent />
        </Suspense>
      </Card>
    </main>
  );
}

async function ChangePasswordContent() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

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

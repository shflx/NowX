"use client";

import { PlusIcon } from "lucide-react";
import { useState } from "react";

import { ConfirmButton } from "@/components/shared/confirm-button";
import { PageHeader } from "@/components/shared/page-header";
import { ProjectDot } from "@/components/shared/project-dot";
import { StatusBadge } from "@/components/shared/status-badge";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAction } from "@/hooks/use-action";
import { cn } from "@/lib/utils";

import { type Credentials, resetAccountPassword, setAccountStatus } from "../actions";
import type { AccountRow } from "../queries";
import { AccountDialog } from "./account-dialog";
import { CredentialsDialog } from "./credentials-dialog";

type Props = {
  accounts: (AccountRow & { lastLogin: string })[];
  projects: { id: string; key: string; name: string; color: string }[];
  currentUserId: string;
  appUrl: string;
};

export function AccountsTable({ accounts, projects, currentUserId, appUrl }: Props) {
  const [dialog, setDialog] = useState<{ account?: AccountRow } | null>(null);
  const [credentials, setCredentials] = useState<(Credentials & { kind: "created" | "reset" }) | null>(null);

  const reset = useAction(resetAccountPassword, { onSuccess: (c) => setCredentials({ ...c, kind: "reset" }) });
  const toggle = useAction(setAccountStatus, { successMessage: "账号状态已更新" });

  const activeCount = accounts.filter((a) => a.status === "ACTIVE").length;

  return (
    <>
      <PageHeader
        title="账号管理"
        description={`平台不开放注册，所有账号由管理员创建。共 ${accounts.length} 个账号，${activeCount} 个正常使用`}
        actions={
          <Button onClick={() => setDialog({})}>
            <PlusIcon />
            创建账号
          </Button>
        }
      />

      <div className="overflow-hidden rounded-lg border bg-card shadow-xs">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>成员</TableHead>
              <TableHead>登录名</TableHead>
              <TableHead>职能</TableHead>
              <TableHead>角色</TableHead>
              <TableHead>参与项目</TableHead>
              <TableHead>最近登录</TableHead>
              <TableHead>状态</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {accounts.map((a) => {
              const disabled = a.status === "DISABLED";
              const self = a.id === currentUserId;
              return (
                <TableRow key={a.id} className={cn(disabled && "text-muted-foreground")}>
                  <TableCell>
                    <span className="flex items-center gap-2">
                      <UserAvatar user={a} className={cn(disabled && "opacity-50 grayscale")} />
                      <b className="font-semibold">{a.name}</b>
                      {self && <StatusBadge>我</StatusBadge>}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">{a.login}</TableCell>
                  <TableCell className="text-muted-foreground">{a.title}</TableCell>
                  <TableCell>
                    {a.role === "ADMIN" ? <StatusBadge tone="accent">管理员</StatusBadge> : <StatusBadge>成员</StatusBadge>}
                  </TableCell>
                  <TableCell>
                    <span className="flex gap-1">
                      {a.memberships.length ? (
                        a.memberships.map(({ project }) => (
                          <span key={project.id} title={project.name}>
                            <ProjectDot project={project} className="size-5" />
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground">未加入项目</span>
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{a.lastLogin}</TableCell>
                  <TableCell>
                    {disabled ? (
                      <StatusBadge>已停用</StatusBadge>
                    ) : a.mustChangePassword ? (
                      <StatusBadge tone="warn">待首次登录</StatusBadge>
                    ) : (
                      <StatusBadge tone="ok">正常</StatusBadge>
                    )}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Button variant="ghost" size="sm" onClick={() => setDialog({ account: a })}>
                      编辑
                    </Button>
                    <ConfirmButton
                      trigger={
                        <Button variant="ghost" size="sm" disabled={reset.pending}>
                          重置密码
                        </Button>
                      }
                      title={`重置 ${a.name} 的密码？`}
                      description="会生成新的临时密码，对方的所有登录会失效，下次登录需要修改密码。"
                      confirmLabel="重置"
                      onConfirm={() => reset.run(a.id)}
                    />
                    {!self &&
                      (disabled ? (
                        <Button variant="ghost" size="sm" onClick={() => toggle.run(a.id, "ACTIVE")}>
                          启用
                        </Button>
                      ) : (
                        <ConfirmButton
                          trigger={
                            <Button variant="ghost" size="sm">
                              停用
                            </Button>
                          }
                          title={`停用 ${a.name} 的账号？`}
                          description="停用后该账号无法登录，但其任务、帖子等历史记录会保留；重新启用即可恢复。"
                          confirmLabel="停用"
                          destructive
                          onConfirm={() => toggle.run(a.id, "DISABLED")}
                        />
                      ))}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {dialog && (
        <AccountDialog
          account={dialog.account}
          projects={projects}
          onClose={() => setDialog(null)}
          onCreated={(c) => {
            setDialog(null);
            setCredentials({ ...c, kind: "created" });
          }}
        />
      )}
      <CredentialsDialog credentials={credentials} appUrl={appUrl} onClose={() => setCredentials(null)} />
    </>
  );
}

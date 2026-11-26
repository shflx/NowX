import { PlusIcon, UserMinusIcon } from "lucide-react";
import { useState } from "react";

import { ActionMenu } from "@/components/shared/action-menu";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { UserAvatar } from "@/components/shared/user-avatar";
import { UserChecklist } from "@/components/shared/user-checklist";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Credentials } from "@/features/accounts/actions";
import { AccountDialog } from "@/features/accounts/components/account-dialog";
import { CredentialsDialog } from "@/features/accounts/components/credentials-dialog";
import { useAction } from "@/hooks/use-action";

import { addProjectMembers, removeProjectMember } from "../actions";

type Member = { id: string; name: string; title: string; color: string; status: string; activeTasks: number };

type Props = {
  projectId: string;
  currentUserId: string;
  /** 全部正常状态的账号，用于挑选新成员 */
  directory: { id: string; name: string; title: string; color: string }[];
  members: Member[];
  allProjects: { id: string; key: string; name: string; color: string }[];
  appUrl: string;
};

export function ProjectMembers({ projectId, currentUserId, directory, members, allProjects, appUrl }: Props) {
  const [adding, setAdding] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [credentials, setCredentials] = useState<(Credentials & { kind: "created" }) | null>(null);

  const add = useAction(addProjectMembers.bind(null, projectId), {
    successMessage: "已添加成员",
    onSuccess: () => {
      setAdding(false);
      setPicked([]);
    },
  });
  const remove = useAction(removeProjectMember.bind(null, projectId), { successMessage: "已移出项目" });

  const candidates = directory.filter((d) => !members.some((m) => m.id === d.id));

  return (
    <SectionCard
      title="项目成员"
      extra={<Badge variant="secondary">{members.length}</Badge>}
      action={
        <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
          <PlusIcon />
          添加成员
        </Button>
      }
      bodyClassName="px-0 pb-0"
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">成员</TableHead>
            <TableHead>职能</TableHead>
            <TableHead>本期未完成任务</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((m) => (
            <TableRow key={m.id}>
              <TableCell className="pl-4">
                <span className="flex items-center gap-2">
                  <UserAvatar user={m} />
                  <b className="font-semibold">{m.name}</b>
                  {m.id === currentUserId && <StatusBadge>我</StatusBadge>}
                  {m.status === "DISABLED" && <StatusBadge>已停用</StatusBadge>}
                </span>
              </TableCell>
              <TableCell className="text-muted-foreground">{m.title}</TableCell>
              <TableCell className="tabular-nums">{m.activeTasks} 个</TableCell>
              <TableCell className="pr-4 text-right">
                <ActionMenu
                  label={`${m.name} 的操作`}
                  items={[
                    {
                      label: "移出项目",
                      icon: UserMinusIcon,
                      destructive: true,
                      onSelect: () => remove.run(m.id),
                      confirm: { title: `把 ${m.name} 移出项目？`, description: "其负责的任务和发过的帖子会保留。", confirmLabel: "移出" },
                    },
                  ]}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>添加成员</DialogTitle>
          </DialogHeader>
          {candidates.length ? (
            <UserChecklist users={candidates} value={picked} onChange={setPicked} />
          ) : (
            <p className="text-sm text-muted-foreground">所有账号都已在项目中。</p>
          )}
          <div className="flex items-center justify-between gap-3 rounded-md border border-dashed border-primary/30 bg-accent-soft/50 px-3 py-2.5 text-sm">
            <span>要找的人还没有账号？创建后会自动加入当前项目。</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setAdding(false);
                setCreatingAccount(true);
              }}
            >
              <PlusIcon />
              创建新账号
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdding(false)}>
              取消
            </Button>
            <Button disabled={!picked.length || add.pending} onClick={() => add.run(picked)}>
              {add.pending && <Spinner />}
              添加
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {creatingAccount && (
        <AccountDialog
          projects={allProjects}
          defaultProjectIds={[projectId]}
          onClose={() => setCreatingAccount(false)}
          onCreated={(c) => {
            setCreatingAccount(false);
            setCredentials({ ...c, kind: "created" });
          }}
        />
      )}
      <CredentialsDialog credentials={credentials} appUrl={appUrl} onClose={() => setCredentials(null)} />
    </SectionCard>
  );
}

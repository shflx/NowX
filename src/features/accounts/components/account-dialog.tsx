"use client";

import { RefreshCwIcon } from "lucide-react";
import { useState } from "react";

import { FormField } from "@/components/shared/form-field";
import { OptionSelect } from "@/components/shared/option-select";
import { ProjectDot } from "@/components/shared/project-dot";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useAction } from "@/hooks/use-action";
import { generatePassword } from "@/lib/password";
import { cn } from "@/lib/utils";

import { type Credentials, createAccount, updateAccount } from "../actions";
import type { AccountRow } from "../queries";

type ProjectOption = { id: string; key: string; name: string; color: string };

type Props = {
  /** 传入则为编辑，否则为创建 */
  account?: AccountRow;
  projects: ProjectOption[];
  /** 创建时默认加入的项目 */
  defaultProjectIds?: string[];
  onClose: () => void;
  onCreated?: (credentials: Credentials) => void;
};

const ROLE_OPTIONS = [
  { value: "MEMBER", label: "成员", render: <>成员<span className="text-xs text-muted-foreground">参与被加入的项目</span></> },
  { value: "ADMIN", label: "管理员", render: <>管理员<span className="text-xs text-muted-foreground">可管理账号与所有项目</span></> },
];

export function AccountDialog({ account, projects, defaultProjectIds = [], onClose, onCreated }: Props) {
  const editing = Boolean(account);
  const [role, setRole] = useState<string>(account?.role ?? "MEMBER");
  const [password, setPassword] = useState(() => generatePassword());
  const [projectIds, setProjectIds] = useState<string[]>(
    account ? account.memberships.map((m) => m.project.id) : defaultProjectIds,
  );

  const create = useAction(createAccount, { onSuccess: (c) => onCreated?.(c) });
  const update = useAction(updateAccount.bind(null, account?.id ?? ""), { successMessage: "已保存", onSuccess: onClose });
  const { pending, fieldErrors } = editing ? update : create;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const fields = { name: form.get("name"), title: form.get("title"), role, projectIds };
    if (editing) update.run(fields);
    else create.run({ ...fields, login: form.get("login"), password });
  }

  const toggleProject = (id: string, checked: boolean) =>
    setProjectIds((ids) => (checked ? [...ids, id] : ids.filter((v) => v !== id)));

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{editing ? `编辑账号：${account!.name}` : "创建账号"}</DialogTitle>
        </DialogHeader>
        <form id="account-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="姓名" htmlFor="account-name" error={fieldErrors.name}>
              <Input id="account-name" name="name" defaultValue={account?.name} placeholder="例如：张三" autoFocus />
            </FormField>
            <FormField label="登录名" htmlFor="account-login" error={fieldErrors.login}>
              <Input
                id="account-login"
                name="login"
                defaultValue={account?.login}
                disabled={editing}
                placeholder="如 zhangsan"
                autoComplete="off"
              />
            </FormField>
            <FormField label="职能" htmlFor="account-title" error={fieldErrors.title}>
              <Input id="account-title" name="title" defaultValue={account?.title} placeholder="例如：前端开发" />
            </FormField>
            <FormField label="平台角色">
              <OptionSelect options={ROLE_OPTIONS} value={role} onValueChange={setRole} className="w-full" />
            </FormField>
          </div>

          {!editing && (
            <FormField label="初始密码" error={fieldErrors.password} description="成员首次登录时需要修改密码。">
              <div className="flex gap-2">
                <Input value={password} onChange={(e) => setPassword(e.target.value)} className="font-mono" />
                <Button type="button" variant="outline" onClick={() => setPassword(generatePassword())}>
                  <RefreshCwIcon />
                  重新生成
                </Button>
              </div>
            </FormField>
          )}

          <FormField label="加入项目" description="之后也可以在项目设置中调整">
            <div className="grid grid-cols-2 gap-1.5">
              {projects.map((p) => {
                const checked = projectIds.includes(p.id);
                return (
                  <label
                    key={p.id}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-2 text-sm hover:border-input",
                      checked && "border-primary/30 bg-accent-soft",
                    )}
                  >
                    <Checkbox checked={checked} onCheckedChange={(c) => toggleProject(p.id, c === true)} />
                    <ProjectDot project={p} className="size-5" />
                    <span className="truncate">{p.name}</span>
                  </label>
                );
              })}
              {projects.length === 0 && <p className="text-sm text-muted-foreground">还没有项目</p>}
            </div>
          </FormField>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button type="submit" form="account-form" disabled={pending}>
            {pending && <Spinner />}
            {editing ? "保存" : "创建账号"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

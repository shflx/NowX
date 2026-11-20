"use client";

import { LinkIcon, PencilIcon, PlusIcon, TagIcon, Trash2Icon, UploadIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { ActionMenu } from "@/components/shared/action-menu";
import { FormField } from "@/components/shared/form-field";
import { PageHeader } from "@/components/shared/page-header";
import { TagChip, tagColors } from "@/components/shared/tag-chip";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { DocType, MaterialKind } from "@/generated/prisma/enums";
import type { RequirementLite } from "@/features/tasks/components/types";
import { Input } from "@/components/ui/input";
import { useAction } from "@/hooks/use-action";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";

import { deleteMaterial, renameMaterial, updateMaterialTags } from "../actions";
import { AddMaterialDialog } from "./add-material-dialog";
import { MaterialIcon, materialHref } from "./material-icon";
import { TagManagerDialog } from "./tag-manager-dialog";
import { type TagLite, TagPicker } from "./tag-picker";

export type MaterialCardData = {
  id: string;
  kind: MaterialKind;
  name: string;
  url: string | null;
  docType: DocType | null;
  meta: string;
  date: string;
  /** 上传人或管理员：可重命名、删除 */
  canManage: boolean;
  uploader: { name: string; color: string };
  requirement: { number: number; code: string } | null;
  tags: TagLite[];
};

type Props = {
  projectId: string;
  projectKey: string;
  materials: MaterialCardData[];
  tags: (TagLite & { count: number })[];
  total: number;
  activeTag: string | null;
  requirements: RequirementLite[];
};

/** 材料库主体：标签筛选、添加材料、材料卡片 */
export function MaterialLibrary({ projectId, projectKey, materials, tags, total, activeTag, requirements }: Props) {
  const [adding, setAdding] = useState<"file" | "link" | null>(null);
  const [managing, setManaging] = useState(false);
  const [editing, setEditing] = useState<MaterialCardData | null>(null);
  const [renaming, setRenaming] = useState<MaterialCardData | null>(null);

  return (
    <>
      <PageHeader
        title="材料库"
        description="规格说明书、设计稿、接口文档、会议纪要……文件和外链都放这里，用标签归类，可关联到需求"
        actions={
          <>
            <Button variant="outline" onClick={() => setAdding("link")}>
              <LinkIcon />
              添加链接
            </Button>
            <Button onClick={() => setAdding("file")}>
              <UploadIcon />
              上传文件
            </Button>
          </>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        <FilterChip href="?" active={!activeTag}>
          全部 <span className="tabular-nums opacity-70">{total}</span>
        </FilterChip>
        {tags.map((t) => (
          <FilterChip key={t.id} href={`?tag=${t.id}`} active={activeTag === t.id}>
            <i className="size-2 rounded-full" style={{ background: tagColors(t.color)[1] }} />
            {t.name} <span className="tabular-nums opacity-70">{t.count}</span>
          </FilterChip>
        ))}
        <button
          type="button"
          onClick={() => setManaging(true)}
          className="inline-flex items-center gap-1 rounded-full border border-dashed px-3 py-0.5 text-sm text-muted-foreground hover:border-input hover:text-foreground"
        >
          <TagIcon className="size-3.5" />
          新建 / 管理标签
        </button>
      </div>

      {materials.length === 0 ? (
        <div className="rounded-lg border bg-card py-14 text-center text-sm text-muted-foreground">
          {activeTag ? "这个标签下还没有材料" : "还没有材料，上传规格说明书、设计稿或添加文档链接吧"}
          <div className="mt-3">
            <Button variant="outline" size="sm" onClick={() => setAdding("file")}>
              <PlusIcon />
              添加材料
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
          {materials.map((m) => (
            <MaterialCard key={m.id} material={m} projectKey={projectKey} onEditTags={() => setEditing(m)} onRename={() => setRenaming(m)} />
          ))}
        </div>
      )}

      {adding && (
        <AddMaterialDialog
          projectId={projectId}
          projectKey={projectKey}
          tags={tags}
          requirements={requirements}
          defaultTab={adding}
          onClose={() => setAdding(null)}
        />
      )}
      {managing && <TagManagerDialog projectId={projectId} tags={tags} onClose={() => setManaging(false)} />}
      {renaming && <RenameDialog material={renaming} onClose={() => setRenaming(null)} />}
      {editing && <EditTagsDialog projectId={projectId} material={editing} tags={tags} onClose={() => setEditing(null)} />}
    </>
  );
}

function FilterChip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-0.5 text-sm text-muted-foreground transition-colors hover:border-input hover:text-foreground",
        active && "border-foreground bg-foreground text-background hover:border-foreground hover:text-background",
      )}
    >
      {children}
    </Link>
  );
}

type CardProps = { material: MaterialCardData; projectKey: string; onEditTags: () => void; onRename: () => void };

function MaterialCard({ material: m, projectKey, onEditTags, onRename }: CardProps) {
  const remove = useAction(deleteMaterial, { successMessage: "已删除" });
  return (
    <div className="group relative flex flex-col gap-2.5 rounded-lg border bg-card p-3.5 shadow-xs transition-colors hover:border-input">
      <div className="flex items-start gap-3">
        <MaterialIcon material={m} />
        <div className="min-w-0 flex-1">
          <a
            href={materialHref(m)}
            target={m.kind === "LINK" ? "_blank" : undefined}
            rel="noopener noreferrer"
            className="leading-snug font-semibold break-all after:absolute after:inset-0 hover:text-accent-text"
          >
            {m.name}
          </a>
          <div className="text-xs text-muted-foreground">{m.meta}</div>
        </div>
        {/* 操作菜单位于覆盖链接之上 */}
        <div className="relative z-10 -mt-1 -mr-1.5">
          <ActionMenu
            label="材料操作"
            items={[
              { label: "重命名", icon: PencilIcon, onSelect: onRename, hidden: !m.canManage },
              { label: "编辑标签", icon: TagIcon, onSelect: onEditTags },
              {
                label: "删除材料",
                icon: Trash2Icon,
                destructive: true,
                hidden: !m.canManage,
                onSelect: () => remove.run(m.id),
                confirm: {
                  title: `删除「${m.name}」？`,
                  description: m.kind === "FILE" ? "文件会被永久删除，无法恢复。" : "删除后无法恢复。",
                  confirmLabel: "删除",
                },
              },
            ]}
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        {m.tags.map((t) => (
          <TagChip key={t.id} tag={t} />
        ))}
        {m.requirement && (
          <Link
            href={routes.requirement(projectKey, m.requirement.number)}
            className="relative z-10 rounded border bg-muted px-1.5 text-xs leading-5 text-muted-foreground hover:border-primary hover:text-accent-text"
          >
            {m.requirement.code}
          </Link>
        )}
      </div>
      <div className="mt-auto flex items-center gap-1.5 text-xs text-muted-foreground">
        <UserAvatar user={m.uploader} size="sm" />
        {m.uploader.name}
        <span className="ml-auto tabular-nums">{m.date}</span>
      </div>
    </div>
  );
}

function EditTagsDialog({ projectId, material, tags, onClose }: { projectId: string; material: MaterialCardData; tags: TagLite[]; onClose: () => void }) {
  const [value, setValue] = useState(material.tags.map((t) => t.id));
  const save = useAction(updateMaterialTags.bind(null, material.id), { successMessage: "标签已更新", onSuccess: onClose });
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>编辑标签</DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-2.5 text-sm">
          <MaterialIcon material={material} small />
          <b className="truncate">{material.name}</b>
        </div>
        <TagPicker projectId={projectId} tags={tags} value={value} onChange={setValue} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button disabled={save.pending} onClick={() => save.run(value)}>
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RenameDialog({ material, onClose }: { material: MaterialCardData; onClose: () => void }) {
  const [name, setName] = useState(material.name);
  const rename = useAction(renameMaterial.bind(null, material.id), { successMessage: "已重命名", onSuccess: onClose });
  const isFile = material.kind === "FILE";

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>重命名</DialogTitle>
        </DialogHeader>
        <form
          id="rename-material"
          onSubmit={(e) => {
            e.preventDefault();
            rename.run(name);
          }}
        >
          <FormField
            label="名称"
            htmlFor="material-name"
            error={rename.fieldErrors._}
            description={isFile ? "未填写扩展名时会自动保留原扩展名" : undefined}
          >
            <Input
              id="material-name"
              value={name}
              maxLength={120}
              autoFocus
              // 文件默认只选中扩展名之前的部分，方便直接改名
              onFocus={(e) => {
                const dot = isFile ? e.target.value.lastIndexOf(".") : -1;
                e.target.setSelectionRange(0, dot > 0 ? dot : e.target.value.length);
              }}
              onChange={(e) => setName(e.target.value)}
            />
          </FormField>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button type="submit" form="rename-material" disabled={rename.pending || !name.trim() || name.trim() === material.name}>
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

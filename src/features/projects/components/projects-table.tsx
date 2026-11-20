"use client";

import { ArchiveIcon, ArchiveRestoreIcon, PlusIcon, SettingsIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { ActionMenu } from "@/components/shared/action-menu";
import { PageHeader } from "@/components/shared/page-header";
import { ProjectDot } from "@/components/shared/project-dot";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAction } from "@/hooks/use-action";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";

import { setProjectArchived } from "../actions";
import { CreateProjectDialog } from "./create-project-dialog";
import { DeleteProjectDialog } from "./delete-project-dialog";

type Row = {
  id: string;
  key: string;
  name: string;
  color: string;
  description: string;
  archived: boolean;
  createdAt: string;
  activeCycle: string | null;
  counts: { members: number; tasks: number; requirements: number; topics: number; materials: number };
};

type Props = {
  projects: Row[];
  currentUserId: string;
  directory: { id: string; name: string; title: string; color: string }[];
};

export function ProjectsTable({ projects, currentUserId, directory }: Props) {
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Row | null>(null);
  const archive = useAction(setProjectArchived, { successMessage: "已更新项目状态" });
  const activeCount = projects.filter((p) => !p.archived).length;

  return (
    <>
      <PageHeader
        title="项目管理"
        description={`共 ${projects.length} 个项目，${activeCount} 个进行中。归档后项目对成员隐藏、数据保留；删除则不可恢复`}
        actions={
          <Button onClick={() => setCreating(true)}>
            <PlusIcon />
            新建项目
          </Button>
        }
      />

      <div className="overflow-hidden rounded-lg border bg-card shadow-xs">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">项目</TableHead>
              <TableHead>编号前缀</TableHead>
              <TableHead>成员</TableHead>
              <TableHead>任务 / 需求 / 帖子</TableHead>
              <TableHead>当前周期</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>创建于</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.map((p) => (
              <TableRow key={p.id} className={cn(p.archived && "text-muted-foreground")}>
                <TableCell className="pl-4">
                  <span className="flex items-center gap-2.5">
                    <ProjectDot project={p} className={cn(p.archived && "opacity-50 grayscale")} />
                    <span className="min-w-0">
                      <Link href={routes.tasks(p.key)} className="font-semibold hover:text-accent-text">
                        {p.name}
                      </Link>
                      {p.description && <span className="block max-w-72 truncate text-xs text-muted-foreground">{p.description}</span>}
                    </span>
                  </span>
                </TableCell>
                <TableCell className="font-mono text-xs">{p.key}</TableCell>
                <TableCell className="tabular-nums">{p.counts.members}</TableCell>
                <TableCell className="text-muted-foreground tabular-nums">
                  {p.counts.tasks} / {p.counts.requirements} / {p.counts.topics}
                </TableCell>
                <TableCell>{p.activeCycle ?? <span className="text-xs text-muted-foreground">—</span>}</TableCell>
                <TableCell>{p.archived ? <StatusBadge>已归档</StatusBadge> : <StatusBadge tone="ok">进行中</StatusBadge>}</TableCell>
                <TableCell className="text-xs text-muted-foreground tabular-nums">{p.createdAt}</TableCell>
                <TableCell className="pr-4 text-right whitespace-nowrap">
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={routes.settings(p.key)}>
                      <SettingsIcon />
                      设置
                    </Link>
                  </Button>
                  <ActionMenu
                    label={`${p.name} 的操作`}
                    items={[
                      {
                        label: p.archived ? "取消归档" : "归档项目",
                        icon: p.archived ? ArchiveRestoreIcon : ArchiveIcon,
                        onSelect: () => archive.run(p.id, !p.archived),
                        confirm: p.archived
                          ? undefined
                          : { title: `归档「${p.name}」？`, description: "归档后项目对成员隐藏，数据完整保留，可以随时取消归档。", confirmLabel: "归档" },
                      },
                      { label: "删除项目", icon: Trash2Icon, destructive: true, onSelect: () => setDeleting(p) },
                    ]}
                  />
                </TableCell>
              </TableRow>
            ))}
            {projects.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-12 text-center text-muted-foreground">
                  还没有项目，点右上角「新建项目」开始
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {deleting && (
        <DeleteProjectDialog
          project={deleting}
          summary={`${deleting.counts.tasks} 个任务、${deleting.counts.requirements} 条需求、${deleting.counts.topics} 个帖子、${deleting.counts.materials} 份材料`}
          open
          onOpenChange={(open) => !open && setDeleting(null)}
        />
      )}
      <CreateProjectDialog open={creating} onOpenChange={setCreating} currentUserId={currentUserId} directory={directory} />
    </>
  );
}

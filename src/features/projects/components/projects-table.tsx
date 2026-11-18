"use client";

import { ArchiveIcon, ArchiveRestoreIcon, PlusIcon, SettingsIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { PageHeader } from "@/components/shared/page-header";
import { ProjectDot } from "@/components/shared/project-dot";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAction } from "@/hooks/use-action";
import { cn } from "@/lib/utils";

import { setProjectArchived } from "../actions";
import { CreateProjectDialog } from "./create-project-dialog";
import { DeleteProjectButton } from "./delete-project-button";

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
                      <Link href={`/projects/${p.key}/tasks`} className="font-semibold hover:text-accent-text">
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
                    <Link href={`/projects/${p.key}/settings`}>
                      <SettingsIcon />
                      设置
                    </Link>
                  </Button>
                  <Button variant="ghost" size="sm" disabled={archive.pending} onClick={() => archive.run(p.id, !p.archived)}>
                    {p.archived ? <ArchiveRestoreIcon /> : <ArchiveIcon />}
                    {p.archived ? "取消归档" : "归档"}
                  </Button>
                  <DeleteProjectButton
                    project={p}
                    summary={`${p.counts.tasks} 个任务、${p.counts.requirements} 条需求、${p.counts.topics} 个帖子、${p.counts.materials} 份材料`}
                    trigger={
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                        <Trash2Icon />
                        删除
                      </Button>
                    }
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

      <CreateProjectDialog open={creating} onOpenChange={setCreating} currentUserId={currentUserId} directory={directory} />
    </>
  );
}

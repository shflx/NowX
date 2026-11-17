import { MessagesSquareIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DocLink } from "@/components/shared/doc-link";
import { Markdown } from "@/components/shared/markdown";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { ProgressBar } from "@/components/shared/status-bar";
import { TaskStatusIcon } from "@/components/shared/task-status";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NewTopicButton } from "@/features/discussions/components/topic-form-dialog";
import { TopicStatusBadge } from "@/features/discussions/components/topic-status-badge";
import { listTags } from "@/features/materials/queries";
import { AddMaterialButton } from "@/features/materials/components/add-material-button";
import { MaterialIcon, materialHref } from "@/features/materials/components/material-icon";
import { EditRequirementButton } from "@/features/requirements/components/requirement-buttons";
import { RequirementStatusBadge } from "@/features/requirements/components/requirement-status-badge";
import { getRequirement } from "@/features/requirements/queries";
import { loadTaskFormOptions } from "@/features/tasks/form-options";
import { NewTaskButton } from "@/features/tasks/components/task-form-dialog";
import { BOARD_STATUSES } from "@/lib/constants";
import { requirementCode, taskCode } from "@/lib/format";
import { isAdmin } from "@/server/auth/dal";
import { requireProjectByKey } from "@/server/permissions";

export const metadata: Metadata = { title: "需求详情" };

export default async function RequirementPage({ params }: PageProps<"/projects/[key]/requirements/[number]">) {
  const { key, number } = await params;
  const { user, project } = await requireProjectByKey(key);
  const n = Number(number);
  if (!Number.isInteger(n)) notFound();

  const [requirement, options, tags] = await Promise.all([getRequirement(project.id, n), loadTaskFormOptions(project), listTags(project.id)]);
  if (!requirement) notFound();

  const code = requirementCode(requirement.number);
  const canDelete = (requirement.ownerId === user.id || isAdmin(user)) && requirement.tasks.length === 0;

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <span className="text-sm text-muted-foreground tabular-nums">{code}</span>
            <RequirementStatusBadge status={requirement.status} />
          </>
        }
        title={requirement.title}
        description={
          <>
            负责人 {requirement.owner?.name ?? "未指定"} · 已拆解 {requirement.taskCount} 个任务，完成 {requirement.percent}%
          </>
        }
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href={`/projects/${project.key}/requirements`}>返回列表</Link>
            </Button>
            <EditRequirementButton
              projectId={project.id}
              projectKey={project.key}
              members={options.members}
              currentUserId={user.id}
              canDelete={canDelete}
              requirement={{
                id: requirement.id,
                code,
                title: requirement.title,
                summary: requirement.summary,
                status: requirement.status,
                ownerId: requirement.ownerId,
                docs: requirement.docs,
              }}
            />
            <NewTaskButton {...options} currentUserId={user.id} defaultRequirementId={requirement.id} label="拆解任务" />
          </>
        }
      />
      <div className="grid grid-cols-[minmax(0,1fr)_300px] items-start gap-4">
        <div className="flex flex-col gap-4">
          <SectionCard title="需求摘要" extra={<span className="text-xs text-muted-foreground">完整内容以外部文档为准</span>}>
            {requirement.summary ? <Markdown>{requirement.summary}</Markdown> : <p className="text-sm text-muted-foreground">暂无摘要</p>}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {requirement.docs.length ? requirement.docs.map((d) => <DocLink key={d.id} doc={d} />) : <span className="text-xs text-muted-foreground">未关联外部文档</span>}
            </div>
          </SectionCard>

          <SectionCard title="拆解出的任务" extra={<Badge variant="secondary">{requirement.tasks.length}</Badge>}>
            {requirement.tasks.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">还没有拆解任务，点右上角「拆解任务」开始</p>}
            {requirement.tasks.map((t) => (
              <Link
                key={t.id}
                href={`/projects/${project.key}/tasks?task=${t.number}&cycle=all`}
                className="flex items-center gap-2.5 border-t py-2.5 text-sm first:border-0 hover:text-accent-text"
              >
                <TaskStatusIcon status={t.status} />
                <span className="text-xs text-muted-foreground tabular-nums">{taskCode(project.key, t.number)}</span>
                <span className="flex-1 truncate">{t.title}</span>
                {t._count.subtasks > 0 && <span className="text-xs text-muted-foreground">{t._count.subtasks} 个子任务</span>}
                <StatusBadge>{t.cycle?.name ?? "待规划"}</StatusBadge>
                {t.assignee && <UserAvatar user={t.assignee} size="sm" />}
              </Link>
            ))}
          </SectionCard>

          <SectionCard
            title="相关讨论"
            extra={<Badge variant="secondary">{requirement.topics.length}</Badge>}
            action={
              <NewTopicButton
                projectId={project.id}
                projectKey={project.key}
                members={options.members}
                currentUserId={user.id}
                defaultLink={`req:${requirement.id}`}
                trigger={
                  <Button variant="outline" size="sm">
                    <MessagesSquareIcon />
                    就此需求提问
                  </Button>
                }
              />
            }
          >
            {requirement.topics.length === 0 && <p className="text-xs text-muted-foreground">暂无讨论</p>}
            {requirement.topics.map((t) => (
              <Link
                key={t.id}
                href={`/projects/${project.key}/discussions/${t.id}`}
                className="flex items-center gap-2.5 border-t py-2 text-sm first:border-0 hover:text-accent-text"
              >
                <TopicStatusBadge status={t.status} />
                <span className="flex-1 truncate">{t.title}</span>
                {t.isFaq && <StatusBadge tone="accent">FAQ</StatusBadge>}
                <span className="text-xs text-muted-foreground">{t._count.replies} 回复</span>
              </Link>
            ))}
          </SectionCard>
        </div>

        <div className="flex flex-col gap-4">
          <SectionCard
            title="材料"
            action={
              <AddMaterialButton
                projectId={project.id}
                projectKey={project.key}
                tags={tags}
                requirements={options.requirements}
                defaultRequirementId={requirement.id}
              />
            }
          >
            {requirement.materials.length === 0 && <p className="text-xs text-muted-foreground">暂无材料</p>}
            {requirement.materials.map((m) => (
              <a
                key={m.id}
                href={materialHref(m)}
                target={m.kind === "LINK" ? "_blank" : undefined}
                rel="noopener noreferrer"
                className="flex items-center gap-2 border-t py-2 text-sm first:border-0 first:pt-0 hover:text-accent-text"
              >
                <MaterialIcon material={m} small />
                <span className="truncate">{m.name}</span>
              </a>
            ))}
          </SectionCard>
          <SectionCard title="进度">
            <ProgressBar value={requirement.percent} className="mb-3" />
            {BOARD_STATUSES.map((s) => (
              <div key={s} className="flex items-center justify-between py-0.5 text-sm">
                <TaskStatusIcon status={s} showLabel />
                <span className="tabular-nums">{requirement.tasks.filter((t) => t.status === s).length}</span>
              </div>
            ))}
          </SectionCard>
        </div>
      </div>
    </>
  );
}

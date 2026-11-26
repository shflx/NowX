import { PlusIcon, SparklesIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { NewTopicButton } from "@/features/discussions/components/topic-form-dialog";
import { TopicStatusBadge } from "@/features/discussions/components/topic-status-badge";
import { countTopics, listTopics } from "@/features/discussions/queries";
import { TOPIC_FILTER_LABEL, TOPIC_FILTERS, type TopicFilter } from "@/features/discussions/schemas";
import { listProjectMembers } from "@/features/projects/queries";
import { ASSISTANT_MENTION } from "@/lib/constants";
import { formatRelative } from "@/lib/dates";
import { requirementCode, taskCode } from "@/lib/format";
import { routes } from "@/lib/routes";
import { excerpt } from "@/lib/text";
import { cn } from "@/lib/utils";
import { appConfig } from "@/server/config";
import { requireProjectByKey } from "@/server/permissions";

export const metadata: Metadata = { title: "交流区" };

export default async function DiscussionsPage({ params, searchParams }: PageProps<"/projects/[key]/discussions">) {
  const { key } = await params;
  const { filter: raw } = await searchParams;
  const filter: TopicFilter = TOPIC_FILTERS.includes(raw as TopicFilter) ? (raw as TopicFilter) : "all";
  const { user, project } = await requireProjectByKey(key);

  const [topics, counts, members] = await Promise.all([
    listTopics(project.id, filter, user.id),
    countTopics(project.id, user.id),
    listProjectMembers(project.id),
  ]);
  const now = new Date();

  return (
    <>
      <PageHeader
        title="交流区"
        description="所有讨论对项目成员公开并永久存档；可指定希望谁来回答，好答案可设为 FAQ"
        actions={
          <NewTopicButton
            projectId={project.id}
            projectKey={project.key}
            members={members}
            currentUserId={user.id}
            trigger={
              <Button>
                <PlusIcon />
                发起提问
              </Button>
            }
          />
        }
      />
      <div className="grid grid-cols-[200px_minmax(0,1fr)] items-start gap-5">
        <nav className="flex flex-col gap-0.5" aria-label="帖子筛选">
          {TOPIC_FILTERS.map((f) => (
            <Link
              key={f}
              prefetch={false}
              href={f === "all" ? "?" : `?filter=${f}`}
              aria-current={f === filter ? "page" : undefined}
              className={cn(
                "flex items-center rounded-md px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground",
                f === filter && "bg-card font-medium text-foreground shadow-xs",
              )}
            >
              {TOPIC_FILTER_LABEL[f]}
              <span className={cn("ml-auto text-xs tabular-nums", f === "mine" && counts.mine > 0 && "rounded-full bg-primary px-1.5 text-primary-foreground")}>
                {counts[f]}
              </span>
            </Link>
          ))}
          {appConfig.assistantEnabled && (
            <div className="mt-4 rounded-md border border-dashed border-primary/30 bg-accent-soft/50 p-3 text-xs leading-relaxed">
              <div className="mb-1 flex items-center gap-1 font-semibold text-accent-text">
                <SparklesIcon className="size-3.5" />
                小提示
              </div>
              在帖子里 {ASSISTANT_MENTION}，它会从任务、材料和 FAQ 中查找线索。
            </div>
          )}
        </nav>

        <div className="overflow-hidden rounded-lg border bg-card shadow-xs">
          {topics.length === 0 && <p className="py-12 text-center text-sm text-muted-foreground">这里还没有帖子</p>}
          {topics.map((t) => {
            const link = t.task ? taskCode(project.key, t.task.number) : t.requirement ? requirementCode(t.requirement.number) : null;
            const solved = t.status === "SOLVED";
            return (
              <article key={t.id} className="relative flex gap-3.5 border-b px-4 py-3.5 transition-colors last:border-0 hover:bg-muted/40">
                <UserAvatar user={t.author} size="lg" />
                <div className="min-w-0 flex-1">
                  <h2 className="flex items-center gap-2 text-[15px] font-semibold">
                    <Link prefetch={false} href={routes.topic(project.key, t.id)} className="after:absolute after:inset-0 hover:text-accent-text">
                      {t.title}
                    </Link>
                    {t.isFaq && <StatusBadge tone="accent">FAQ</StatusBadge>}
                  </h2>
                  <p className="mt-0.5 mb-2 truncate text-sm text-muted-foreground">{excerpt(t.body)}</p>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <TopicStatusBadge status={t.status} />
                    <span>
                      {t.author.name} 发布于 {formatRelative(t.createdAt, appConfig.timeZone, now)}
                    </span>
                    {t.assignee && (
                      <span>
                        · 请 <b className="text-foreground/80">{t.assignee.name}</b> 回答
                      </span>
                    )}
                    {link && <span className="rounded border bg-muted px-1.5">{link}</span>}
                    <span>· {t.viewCount} 次浏览</span>
                  </div>
                </div>
                <div className={cn("w-16 shrink-0 pt-0.5 text-center", solved && "text-ok")}>
                  <div className="text-lg font-semibold tabular-nums">{t._count.replies}</div>
                  <div className="text-[11px] text-muted-foreground">{solved ? "已解决" : "回复"}</div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </>
  );
}

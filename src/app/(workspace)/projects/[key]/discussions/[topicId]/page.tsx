import { CheckIcon, StarIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";

import { Markdown } from "@/components/shared/markdown";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { AcceptReplyButton, ReplyComposer, TopicManageActions } from "@/features/discussions/components/topic-actions";
import { TopicStatusBadge } from "@/features/discussions/components/topic-status-badge";
import { getTopic, incrementTopicView, listFaq } from "@/features/discussions/queries";
import { formatRelative } from "@/lib/dates";
import { requirementCode, taskCode } from "@/lib/format";
import { cn } from "@/lib/utils";
import { isAdmin } from "@/server/auth/dal";
import { appConfig } from "@/server/config";
import { requireProjectByKey } from "@/server/permissions";

export const metadata: Metadata = { title: "帖子详情" };

export default async function TopicPage({ params }: PageProps<"/projects/[key]/discussions/[topicId]">) {
  const { key, topicId } = await params;
  const { user, project } = await requireProjectByKey(key);
  const [topic, faqs] = await Promise.all([getTopic(project.id, topicId), listFaq(project.id, topicId)]);
  if (!topic) notFound();

  // 响应发送后再累计浏览数，不阻塞渲染
  after(() => incrementTopicView(topic.id));

  const canManage = topic.authorId === user.id || topic.assigneeId === user.id || isAdmin(user);
  const now = new Date();
  const time = (d: Date) => formatRelative(d, appConfig.timeZone, now);
  const participants = [topic.author, ...topic.replies.map((r) => r.author)].filter(
    (u, i, all): u is NonNullable<typeof u> => Boolean(u) && all.findIndex((x) => x?.id === u!.id) === i,
  );

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <TopicStatusBadge status={topic.status} />
            {topic.isFaq && <StatusBadge tone="accent">FAQ</StatusBadge>}
            <span className="text-xs text-muted-foreground">{topic.viewCount + 1} 次浏览</span>
          </>
        }
        title={topic.title}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href={`/projects/${project.key}/discussions`}>返回列表</Link>
            </Button>
            {canManage && <TopicManageActions topicId={topic.id} isFaq={topic.isFaq} status={topic.status} />}
          </>
        }
      />
      <div className="grid grid-cols-[minmax(0,1fr)_300px] items-start gap-4">
        <div className="flex flex-col gap-4">
          <div className="overflow-hidden rounded-lg border bg-card shadow-xs">
            <Post author={topic.author} time={time(topic.createdAt)} body={topic.body} />
            {topic.replies.length > 0 && (
              <div className="border-y bg-muted/40 px-5 py-2 text-xs text-muted-foreground">{topic.replies.length} 条回复</div>
            )}
            {topic.replies.map((r) => (
              <Post
                key={r.id}
                author={r.author}
                assistant={r.isAssistant}
                accepted={r.isAccepted}
                time={time(r.createdAt)}
                body={r.body}
                action={
                  canManage && !r.isAccepted && !r.isAssistant && r.authorId !== topic.authorId && topic.status !== "CLOSED" ? (
                    <AcceptReplyButton replyId={r.id} />
                  ) : null
                }
              />
            ))}
          </div>
          {topic.status === "CLOSED" ? (
            <p className="rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground">帖子已关闭，不能再回复。</p>
          ) : (
            <ReplyComposer
              topicId={topic.id}
              currentUser={user}
              canSolve={canManage && topic.status === "OPEN"}
              assistantEnabled={appConfig.assistantEnabled}
            />
          )}
        </div>

        <div className="flex flex-col gap-4">
          <SectionCard bodyClassName="flex flex-col gap-4 text-sm">
            <div>
              <div className="mb-1.5 text-xs text-muted-foreground">指定回答人</div>
              {topic.assignee ? (
                <span className="flex items-center gap-2">
                  <UserAvatar user={topic.assignee} size="sm" />
                  {topic.assignee.name}
                </span>
              ) : (
                <span className="text-muted-foreground">未指定，所有人都可以回答</span>
              )}
            </div>
            <div>
              <div className="mb-1.5 text-xs text-muted-foreground">关联</div>
              {topic.task ? (
                <Link href={`/projects/${project.key}/tasks?task=${topic.task.number}`} className="text-accent-text hover:underline">
                  {taskCode(project.key, topic.task.number)} {topic.task.title}
                </Link>
              ) : topic.requirement ? (
                <Link href={`/projects/${project.key}/requirements/${topic.requirement.number}`} className="text-accent-text hover:underline">
                  {requirementCode(topic.requirement.number)} {topic.requirement.title}
                </Link>
              ) : (
                <span className="text-muted-foreground">无</span>
              )}
            </div>
            <div>
              <div className="mb-1.5 text-xs text-muted-foreground">参与者</div>
              <div className="flex">
                {participants.map((p) => (
                  <UserAvatar key={p.id} user={p} size="sm" className="-ml-1 first:ml-0" />
                ))}
                {topic.replies.some((r) => r.isAssistant) && <UserAvatar user={null} assistant size="sm" className="-ml-1" />}
              </div>
            </div>
          </SectionCard>
          <SectionCard title="FAQ 精选">
            {faqs.length ? (
              faqs.map((f) => (
                <Link
                  key={f.id}
                  href={`/projects/${project.key}/discussions/${f.id}`}
                  className="flex items-start gap-2 border-t py-2 text-sm first:border-0 first:pt-0 hover:text-accent-text"
                >
                  <StarIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                  {f.title}
                </Link>
              ))
            ) : (
              <p className="text-xs text-muted-foreground">还没有 FAQ</p>
            )}
          </SectionCard>
        </div>
      </div>
    </>
  );
}

type PostProps = {
  author: { name: string; color: string } | null;
  assistant?: boolean;
  accepted?: boolean;
  time: string;
  body: string;
  action?: React.ReactNode;
};

function Post({ author, assistant, accepted, time, body, action }: PostProps) {
  return (
    <div
      className={cn(
        "flex gap-3.5 border-b px-5 py-4 last:border-0",
        accepted && "bg-ok-soft/60 shadow-[inset_3px_0_0_var(--ok)]",
        assistant && "bg-accent-soft/40",
      )}
    >
      <UserAvatar user={author} assistant={assistant} size="lg" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-sm font-semibold">
          {assistant ? "项目助手" : (author?.name ?? "已删除用户")}
          {assistant && <StatusBadge tone="accent">Agent</StatusBadge>}
          {accepted && (
            <StatusBadge tone="ok">
              <CheckIcon />
              已采纳
            </StatusBadge>
          )}
          <span className="text-xs font-normal text-muted-foreground">{time}</span>
        </div>
        <Markdown className="mt-1.5">{body}</Markdown>
        {action && <div className="mt-2">{action}</div>}
      </div>
    </div>
  );
}

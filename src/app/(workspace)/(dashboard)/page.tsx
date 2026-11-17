import { PinIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { StatusBar, StatusLegend } from "@/components/shared/status-bar";
import { PriorityIndicator, TaskStatusIcon } from "@/components/shared/task-status";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Badge } from "@/components/ui/badge";
import { getDashboard } from "@/features/dashboard/queries";
import { DueDate } from "@/features/tasks/components/task-card";
import { formatLongDate, formatMonthDay } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { requireUser } from "@/server/auth/dal";
import { appConfig } from "@/server/config";

export const metadata: Metadata = { title: "工作台" };

function greeting() {
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: appConfig.timeZone, hour: "numeric", hourCycle: "h23" }).format(new Date()));
  if (hour < 5) return "夜深了";
  if (hour < 11) return "早上好";
  if (hour < 13) return "中午好";
  if (hour < 18) return "下午好";
  return "晚上好";
}

/** 工作台只回答三件事：我要做什么、谁在等我、项目进展如何 */
export default async function DashboardPage() {
  const user = await requireUser();
  const data = await getDashboard(user);
  const { myTasks, waiting, activeCycles, pinned, activities } = data;

  const overdue = myTasks.filter((t) => t.overdue);
  const groups = [
    { label: "已逾期", tasks: overdue, danger: true },
    { label: "进行中", tasks: myTasks.filter((t) => !t.overdue && (t.status === "IN_PROGRESS" || t.status === "IN_REVIEW")) },
    { label: "待开始", tasks: myTasks.filter((t) => !t.overdue && t.status === "TODO") },
  ].filter((g) => g.tasks.length);
  const multiProject = new Set(myTasks.map((t) => t.project.id)).size > 1;

  const summary = [`你有 ${myTasks.length} 个未完成任务`];
  if (overdue.length) summary.push(`${overdue.length} 个已逾期`);
  if (waiting.length) summary.push(`${waiting.length} 个问题等你回答`);

  return (
    <>
      <PageHeader title={`${greeting()}，${user.name}`} description={`${formatLongDate(data.today)} · ${summary.join("，")}`} />

      {pinned.length > 0 && (
        <Link
          href={`/projects/${pinned[0].project.key}/announcements`}
          className="group mb-4 flex items-center gap-2.5 rounded-lg border border-[#f3e3c2] bg-warn-soft px-3.5 py-2.5 text-warn"
        >
          <PinIcon className="size-4 shrink-0" />
          <b className="truncate font-semibold text-foreground">{pinned[0].title}</b>
          <span className="shrink-0 text-xs text-muted-foreground">{pinned[0].author.name}</span>
          <span className="ml-auto shrink-0 text-xs text-accent-text group-hover:underline">
            {pinned.length > 1 ? `还有 ${pinned.length - 1} 条置顶公告` : "查看公告"} →
          </span>
        </Link>
      )}

      <div className="grid grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)] items-start gap-4 max-xl:grid-cols-1">
        <div className="flex flex-col gap-4">
          <SectionCard title="我的任务" extra={<span className="text-xs text-muted-foreground">我参与的项目 · 进行中的周期</span>}>
            {groups.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">本周期没有分配给你的未完成任务</p>}
            {groups.map((g) => (
              <div key={g.label}>
                <h3 className={cn("flex gap-1.5 pt-3 pb-1 text-xs font-semibold text-muted-foreground first:pt-0", g.danger && "text-destructive")}>
                  {g.label}
                  <span className="font-normal">{g.tasks.length}</span>
                </h3>
                {g.tasks.map((t) => (
                  <Link
                    key={t.id}
                    href={`/projects/${t.project.key}/tasks?task=${t.number}`}
                    className="group -mx-2 flex items-center gap-2.5 rounded-md px-2 py-2 text-sm transition-colors hover:bg-muted/50"
                  >
                    <TaskStatusIcon status={t.status} />
                    <span className="text-xs text-muted-foreground tabular-nums">{t.code}</span>
                    <span className="flex-1 truncate group-hover:text-accent-text">{t.title}</span>
                    {multiProject && <StatusBadge className="border bg-transparent">{t.project.name}</StatusBadge>}
                    {(t.priority === "URGENT" || t.priority === "HIGH") && <PriorityIndicator priority={t.priority} />}
                    <DueDate task={t} className="w-24 text-right" />
                  </Link>
                ))}
              </div>
            ))}
          </SectionCard>

          <SectionCard title="最近动态">
            {activities.length === 0 && <p className="text-sm text-muted-foreground">暂无动态</p>}
            {activities.map((a) => {
              const content = (
                <>
                  <UserAvatar user={a.actor} size="sm" />
                  <span className="min-w-0 flex-1 truncate">
                    <b className="font-semibold">{a.actor.name}</b> <span className="text-muted-foreground">{a.verb}</span> {a.target}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{a.time}</span>
                </>
              );
              return a.href ? (
                <Link key={a.id} href={a.href} className="flex items-center gap-2.5 py-1.5 text-sm hover:text-accent-text">
                  {content}
                </Link>
              ) : (
                <div key={a.id} className="flex items-center gap-2.5 py-1.5 text-sm">
                  {content}
                </div>
              );
            })}
          </SectionCard>
        </div>

        <div className="flex flex-col gap-4">
          {activeCycles.length === 0 && (
            <SectionCard title="进行中的周期">
              <p className="text-sm text-muted-foreground">你参与的项目都没有进行中的周期</p>
            </SectionCard>
          )}
          {activeCycles.map((c) => (
            <SectionCard
              key={c.id}
              title={
                <Link href={`/projects/${c.project.key}/cycles?cycle=${c.id}`} className="hover:text-accent-text">
                  {activeCycles.length > 1 ? `${c.project.name} · ${c.name}` : c.name}
                </Link>
              }
              extra={
                <span className="text-xs text-muted-foreground tabular-nums">
                  {formatMonthDay(c.startDate)}–{formatMonthDay(c.endDate)}
                </span>
              }
              action={<Badge variant="secondary">剩 {c.daysLeft} 天</Badge>}
            >
              <div className="flex flex-col gap-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-semibold tracking-tight tabular-nums">{c.percent}%</span>
                  <span className="text-sm text-muted-foreground">
                    {c.done} / {c.total} 个任务已完成
                  </span>
                </div>
                <StatusBar counts={c.counts} />
                <StatusLegend counts={c.counts} />
                <div className="flex items-center justify-between">
                  {c.behind > 0 ? <StatusBadge tone="warn">落后计划约 {c.behind} 个</StatusBadge> : <StatusBadge tone="ok">进度正常</StatusBadge>}
                  <Link href={`/projects/${c.project.key}/cycles?cycle=${c.id}`} className="text-xs text-accent-text hover:underline">
                    查看燃尽图 →
                  </Link>
                </div>
              </div>
            </SectionCard>
          ))}

          <SectionCard title="待我回答" extra={waiting.length > 0 && <StatusBadge tone="warn">{waiting.length}</StatusBadge>}>
            {waiting.length === 0 && <p className="text-sm text-muted-foreground">没有等你回答的问题</p>}
            {waiting.map((t) => (
              <Link
                key={t.id}
                href={`/projects/${t.project.key}/discussions/${t.id}`}
                className="group -mx-2 flex items-center gap-2.5 rounded-md px-2 py-2 text-sm hover:bg-muted/50"
              >
                <UserAvatar user={t.author} size="sm" />
                <span className="flex-1 truncate group-hover:text-accent-text">{t.title}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{t.time}</span>
              </Link>
            ))}
          </SectionCard>
        </div>
      </div>
    </>
  );
}

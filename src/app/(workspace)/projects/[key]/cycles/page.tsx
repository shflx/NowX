import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge, type Tone } from "@/components/shared/status-badge";
import { ProgressBar, StatusBar, StatusLegend } from "@/components/shared/status-bar";
import { TaskStatusIcon } from "@/components/shared/task-status";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import type { CycleStatus } from "@/generated/prisma/enums";
import { BurndownChart } from "@/features/cycles/components/burndown-chart";
import { RequirementStatusBadge } from "@/features/requirements/components/requirement-status-badge";
import { CycleActions, NewCycleButton } from "@/features/cycles/components/cycle-actions";
import { getCycleDetail, listCycles } from "@/features/cycles/queries";
import { behindPlan } from "@/features/cycles/stats";
import { CYCLE_STATUS_LABEL } from "@/lib/constants";
import { addDays, formatMonthDay } from "@/lib/dates";
import { taskCode } from "@/lib/format";
import { cn } from "@/lib/utils";
import { today } from "@/server/config";
import { db } from "@/server/db";
import { requireProjectByKey } from "@/server/permissions";

export const metadata: Metadata = { title: "周期" };

const CYCLE_TONE: Record<CycleStatus, Tone> = { PLANNED: "neutral", ACTIVE: "accent", ENDED: "ok" };

export default async function CyclesPage({ params, searchParams }: PageProps<"/projects/[key]/cycles">) {
  const { key } = await params;
  const { cycle: selectedId } = await searchParams;
  const { project } = await requireProjectByKey(key);

  const cycles = await listCycles(project.id);
  const now = today();
  const lastEnd = cycles.at(-1)?.endDate;
  const defaultStart = lastEnd && lastEnd >= now ? addDays(lastEnd, 1) : now;
  const selected =
    cycles.find((c) => c.id === selectedId) ?? cycles.find((c) => c.status === "ACTIVE") ?? cycles.find((c) => c.status === "PLANNED") ?? cycles.at(-1);

  const header = (
    <PageHeader
      title="周期"
      description="每个周期两周或一个月，任务归属于周期，未完成的可顺延到下一期"
      actions={<NewCycleButton projectId={project.id} cycles={cycles} defaultStart={defaultStart} />}
    />
  );

  if (!selected) {
    return (
      <>
        {header}
        <Empty className="border bg-card">
          <EmptyHeader>
            <EmptyTitle>还没有周期</EmptyTitle>
            <EmptyDescription>新建一个两周或一个月的周期，然后把任务放进去。</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </>
    );
  }

  const [detail, unfinished] = await Promise.all([
    getCycleDetail(selected),
    selected.status === "ACTIVE"
      ? db.task.findMany({
          where: { cycleId: selected.id, parentId: null, status: { in: ["TODO", "IN_PROGRESS", "IN_REVIEW"] } },
          orderBy: { number: "asc" },
          select: { id: true, number: true, title: true, status: true, assignee: { select: { name: true, color: true } } },
        })
      : [],
  ]);
  const maxLoad = Math.max(1, ...detail.members.map((m) => m.total));
  const plannedReqs = detail.requirements;
  const deliveredReqs = plannedReqs.filter((r) => r.status === "DELIVERED");
  const carriedOutReqs = plannedReqs.filter((r) => r.carriedOut);
  const behind = selected.status === "ACTIVE" ? behindPlan(selected.total, selected.remaining, selected.startDate, selected.endDate, now) : 0;

  return (
    <>
      {header}
      <div className="grid grid-cols-[280px_minmax(0,1fr)] items-start gap-4">
        <nav className="flex flex-col gap-2" aria-label="周期列表">
          {cycles.map((c) => (
            <Link
              key={c.id}
              href={`?cycle=${c.id}`}
              scroll={false}
              aria-current={c.id === selected.id ? "page" : undefined}
              className={cn(
                "rounded-lg border bg-card p-3.5 shadow-xs transition-colors hover:border-input",
                c.id === selected.id && "border-primary ring-3 ring-accent-soft",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold">{c.name}</span>
                <StatusBadge tone={CYCLE_TONE[c.status]}>{CYCLE_STATUS_LABEL[c.status]}</StatusBadge>
              </div>
              <div className="mt-0.5 mb-2.5 text-xs text-muted-foreground tabular-nums">
                {formatMonthDay(c.startDate)} – {formatMonthDay(c.endDate)} · {c.total} 个任务
              </div>
              <ProgressBar value={c.percent} />
              <div className="mt-1 text-xs text-muted-foreground tabular-nums">完成 {c.percent}%</div>
            </Link>
          ))}
        </nav>

        <div className="flex min-w-0 flex-col gap-4">
          <SectionCard>
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-lg font-semibold">{selected.name}</h2>
              <StatusBadge tone={CYCLE_TONE[selected.status]}>{CYCLE_STATUS_LABEL[selected.status]}</StatusBadge>
              <span className="text-sm text-muted-foreground tabular-nums">
                {selected.startDate} ~ {selected.endDate}
              </span>
              <div className="ml-auto">
                <CycleActions
                  projectId={project.id}
                  cycle={selected}
                  cycles={cycles}
                  unfinished={unfinished.map((t) => ({ ...t, code: taskCode(project.key, t.number) }))}
                  undeliveredRequirements={plannedReqs
                    .filter((r) => !r.carriedOut && r.status !== "DELIVERED")
                    .map((r) => ({ id: r.id, code: r.code, title: r.title, allTasksDone: r.total > 0 && r.done === r.total }))}
                />
              </div>
            </div>
            {selected.goal && <p className="mt-2 text-sm text-muted-foreground">目标：{selected.goal}</p>}
            <div className="mt-4 grid grid-cols-4 gap-3">
              <MiniStat label="完成任务" value={<>{selected.done}<span className="text-sm text-muted-foreground"> / {selected.total}</span></>} />
              <MiniStat label="完成率" value={`${selected.percent}%`} />
              <MiniStat label="剩余任务" value={`${selected.remaining} 个`} />
              <MiniStat
                label={selected.status === "ACTIVE" ? "剩余时间" : "周期长度"}
                value={selected.status === "ACTIVE" ? `${detail.time.daysLeft} 天` : selected.status === "ENDED" ? "已结束" : `${detail.time.days} 天`}
              />
            </div>
          </SectionCard>

          <SectionCard
            title="本期需求"
            extra={
              <span className="text-xs text-muted-foreground">
                计划交付 {plannedReqs.length} 条 · 已交付 {deliveredReqs.length} 条
                {carriedOutReqs.length > 0 && ` · 顺延 ${carriedOutReqs.length} 条`}
              </span>
            }
          >
            {plannedReqs.length ? (
              <ul>
                {plannedReqs.map((r) => (
                  <li key={r.id}>
                    <Link
                      href={`/projects/${project.key}/requirements/${r.number}`}
                      className="flex items-center gap-3 border-t py-2.5 text-sm first:border-0 hover:text-accent-text"
                    >
                      <span className="text-xs text-muted-foreground tabular-nums">{r.code}</span>
                      <span className="flex-1 truncate">{r.title}</span>
                      {r.carriedIn && <StatusBadge tone="warn">由「{r.carriedFrom?.name}」顺延</StatusBadge>}
                      {r.carriedOut && <StatusBadge tone="warn">已顺延到「{r.cycle?.name ?? "待排期"}」</StatusBadge>}
                      <RequirementStatusBadge status={r.status} />
                      <ProgressBar value={r.percent} className="w-32" />
                      <span className="w-12 text-right text-xs text-muted-foreground tabular-nums">
                        {r.done}/{r.total}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">还没有需求排入本周期，可以在需求详情中「排入周期」</p>
            )}
          </SectionCard>

          {selected.status !== "PLANNED" && (
            <SectionCard
              title="燃尽图"
              extra={<span className="text-xs text-muted-foreground">每日剩余的未完成任务数</span>}
              action={
                selected.status === "ACTIVE" &&
                (behind > 0 ? <StatusBadge tone="warn">落后计划约 {behind} 个</StatusBadge> : <StatusBadge tone="ok">进度正常</StatusBadge>)
              }
            >
              <BurndownChart points={detail.points} today={now} />
            </SectionCard>
          )}

          <SectionCard title="任务状态分布">
            <div className="flex flex-col gap-2.5">
              <StatusBar counts={selected.counts} />
              <StatusLegend counts={selected.counts} />
            </div>
          </SectionCard>

          <SectionCard title="成员负载" extra={<span className="text-xs text-muted-foreground">已完成 / 分配的任务</span>}>
            {detail.members.length ? (
              <ul className="flex flex-col">
                {detail.members.map((m) => (
                  <li key={m.user.id} className="grid grid-cols-[100px_1fr_64px] items-center gap-3 py-1.5 text-sm">
                    <span className="flex items-center gap-2">
                      <UserAvatar user={m.user} size="sm" />
                      {m.user.name}
                    </span>
                    <StatusBar counts={m.counts} scale={m.total / maxLoad} />
                    <span className="text-right text-xs text-muted-foreground tabular-nums">
                      {m.done} / {m.total}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">本周期还没有分配任务</p>
            )}
          </SectionCard>

          {selected.status === "ENDED" && (
            <SectionCard title="周期回顾">
              <p className="mb-2 text-sm text-muted-foreground">
                计划交付 {plannedReqs.length} 条需求，已交付 {deliveredReqs.length} 条
                {carriedOutReqs.length > 0 && `，顺延 ${carriedOutReqs.length} 条`}；完成 {selected.done}/{selected.total} 个任务，完成率{" "}
                {selected.percent}%。
                {detail.carried.length > 0 && `以下 ${detail.carried.length} 个任务顺延到了后续周期：`}
              </p>
              {detail.carried.map((t) => (
                <Link
                  key={t.id}
                  href={`/projects/${project.key}/tasks?task=${t.number}`}
                  className="flex items-center gap-2.5 border-t py-2 text-sm first:border-0 hover:text-accent-text"
                >
                  <TaskStatusIcon status={t.status} />
                  <span className="text-xs text-muted-foreground tabular-nums">{taskCode(project.key, t.number)}</span>
                  <span className="flex-1 truncate">{t.title}</span>
                  <span className="text-xs text-muted-foreground">{t.cycle?.name ?? "待规划"}</span>
                </Link>
              ))}
              {detail.carried.length === 0 && <p className="text-sm text-muted-foreground">没有顺延任务</p>}
            </SectionCard>
          )}
        </div>
      </div>
    </>
  );
}

function MiniStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-muted/40 px-3.5 py-3">
      <div className="text-xl font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

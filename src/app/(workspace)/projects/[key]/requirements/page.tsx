import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";

import { DocLink } from "@/components/shared/doc-link";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge, type Tone } from "@/components/shared/status-badge";
import { ProgressBar } from "@/components/shared/status-bar";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { NewRequirementButton } from "@/features/requirements/components/requirement-buttons";
import { RequirementStatusBadge } from "@/features/requirements/components/requirement-status-badge";
import { groupByCycle } from "@/features/requirements/grouping";
import { listRequirements } from "@/features/requirements/queries";
import { loadTaskFormOptions } from "@/features/tasks/form-options";
import { CYCLE_STATUS_LABEL } from "@/lib/constants";
import { formatMonthDay, toDateString } from "@/lib/dates";
import { requirementCode } from "@/lib/format";
import { requireProjectByKey } from "@/server/permissions";

export const metadata: Metadata = { title: "需求" };

const CYCLE_TONE: Record<"PLANNED" | "ACTIVE" | "ENDED", Tone> = {
  PLANNED: "neutral",
  ACTIVE: "accent",
  ENDED: "ok",
};

export default async function RequirementsPage({ params }: PageProps<"/projects/[key]/requirements">) {
  const { key } = await params;
  const { user, project } = await requireProjectByKey(key);
  const [requirements, options] = await Promise.all([listRequirements(project.id), loadTaskFormOptions(project)]);
  const groups = groupByCycle(requirements);

  return (
    <>
      <PageHeader
        title="需求"
        description="需求原文保存在飞书 / 腾讯文档，这里只记录链接；需求按计划交付周期分组，并拆解为任务"
        actions={
          <NewRequirementButton
            projectId={project.id}
            projectKey={project.key}
            members={options.members}
            cycles={options.cycles}
            nextCode={requirementCode(project.requirementSeq + 1)}
            currentUserId={user.id}
          />
        }
      />
      {requirements.length === 0 ? (
        <Empty className="bg-card border">
          <EmptyHeader>
            <EmptyTitle>还没有需求</EmptyTitle>
            <EmptyDescription>新建一条需求，贴上飞书或腾讯文档的链接，然后拆解成任务。</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="bg-card overflow-hidden rounded-lg border shadow-xs">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20 pl-4">编号</TableHead>
                <TableHead>需求</TableHead>
                <TableHead>来源文档</TableHead>
                <TableHead className="w-24">状态</TableHead>
                <TableHead className="w-28">负责人</TableHead>
                <TableHead className="w-52">拆解进度</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map((group) => (
                <Fragment key={group.key}>
                  <TableRow className="bg-muted/60 hover:bg-muted/60">
                    <TableCell colSpan={6} className="text-muted-foreground py-1.5 pl-4 text-xs font-medium">
                      <span className="flex items-center gap-2">
                        {group.cycle ? (
                          <>
                            <span className="text-foreground">{group.cycle.name}</span>
                            <span className="tabular-nums">
                              {formatMonthDay(toDateString(group.cycle.startDate))}–
                              {formatMonthDay(toDateString(group.cycle.endDate))}
                            </span>
                            <StatusBadge tone={CYCLE_TONE[group.cycle.status]}>
                              {CYCLE_STATUS_LABEL[group.cycle.status]}
                            </StatusBadge>
                          </>
                        ) : (
                          <span className="text-foreground">待排期</span>
                        )}
                        <span>· {group.items.length} 条</span>
                      </span>
                    </TableCell>
                  </TableRow>
                  {group.items.map((r) => {
                    const href = `/projects/${project.key}/requirements/${r.number}`;
                    return (
                      <TableRow key={r.id} className="relative">
                        <TableCell className="text-muted-foreground pl-4 text-xs tabular-nums">
                          {requirementCode(r.number)}
                        </TableCell>
                        <TableCell className="max-w-96">
                          {/* 整行可点击：链接铺满整行，外部文档链接在其上层 */}
                          <Link href={href} className="hover:text-accent-text font-semibold after:absolute after:inset-0">
                            {r.title}
                          </Link>
                          {r.summary && <div className="text-muted-foreground truncate text-xs">{r.summary}</div>}
                        </TableCell>
                        <TableCell>
                          <div className="relative z-10 flex flex-wrap gap-1.5">
                            {r.docs.length ? (
                              r.docs.map((d) => <DocLink key={d.id} doc={d} />)
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <RequirementStatusBadge status={r.status} />
                        </TableCell>
                        <TableCell>
                          {r.owner ? (
                            <span className="flex items-center gap-1.5">
                              <UserAvatar user={r.owner} size="sm" />
                              {r.owner.name}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">未指定</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {r.taskCount ? (
                            <div className="flex items-center gap-2">
                              <ProgressBar value={r.percent} className="flex-1" />
                              <span className="text-muted-foreground w-20 text-xs tabular-nums">
                                {r.doneCount}/{r.taskCount} 完成
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">尚未拆解</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}

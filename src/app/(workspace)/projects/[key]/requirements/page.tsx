import type { Metadata } from "next";
import Link from "next/link";

import { DocLink } from "@/components/shared/doc-link";
import { PageHeader } from "@/components/shared/page-header";
import { ProgressBar } from "@/components/shared/status-bar";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listProjectMembers } from "@/features/projects/queries";
import { NewRequirementButton } from "@/features/requirements/components/requirement-buttons";
import { RequirementStatusBadge } from "@/features/requirements/components/requirement-status-badge";
import { listRequirements } from "@/features/requirements/queries";
import { requirementCode } from "@/lib/format";
import { requireProjectByKey } from "@/server/permissions";

export const metadata: Metadata = { title: "需求" };

export default async function RequirementsPage({ params }: PageProps<"/projects/[key]/requirements">) {
  const { key } = await params;
  const { user, project } = await requireProjectByKey(key);
  const [requirements, members] = await Promise.all([listRequirements(project.id), listProjectMembers(project.id)]);

  return (
    <>
      <PageHeader
        title="需求"
        description="需求原文保存在飞书 / 腾讯文档，这里只记录链接，并把需求拆解为任务"
        actions={
          <NewRequirementButton
            projectId={project.id}
            projectKey={project.key}
            members={members}
            nextCode={requirementCode(project.requirementSeq + 1)}
            currentUserId={user.id}
          />
        }
      />
      {requirements.length === 0 ? (
        <Empty className="border bg-card">
          <EmptyHeader>
            <EmptyTitle>还没有需求</EmptyTitle>
            <EmptyDescription>新建一条需求，贴上飞书或腾讯文档的链接，然后拆解成任务。</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card shadow-xs">
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
              {requirements.map((r) => {
                const href = `/projects/${project.key}/requirements/${r.number}`;
                return (
                  <TableRow key={r.id} className="relative">
                    <TableCell className="pl-4 text-xs text-muted-foreground tabular-nums">{requirementCode(r.number)}</TableCell>
                    <TableCell className="max-w-96">
                      {/* 整行可点击：链接铺满整行，外部文档链接在其上层 */}
                      <Link href={href} className="font-semibold after:absolute after:inset-0 hover:text-accent-text">
                        {r.title}
                      </Link>
                      {r.summary && <div className="truncate text-xs text-muted-foreground">{r.summary}</div>}
                    </TableCell>
                    <TableCell>
                      <div className="relative z-10 flex flex-wrap gap-1.5">
                        {r.docs.length ? r.docs.map((d) => <DocLink key={d.id} doc={d} />) : <span className="text-xs text-muted-foreground">—</span>}
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
                        <span className="text-xs text-muted-foreground">未指定</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {r.taskCount ? (
                        <div className="flex items-center gap-2">
                          <ProgressBar value={r.percent} className="flex-1" />
                          <span className="w-20 text-xs text-muted-foreground tabular-nums">
                            {r.doneCount}/{r.taskCount} 完成
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">尚未拆解</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}

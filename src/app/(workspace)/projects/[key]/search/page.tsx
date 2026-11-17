import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { TaskStatusIcon } from "@/components/shared/task-status";
import { Badge } from "@/components/ui/badge";
import { TopicStatusBadge } from "@/features/discussions/components/topic-status-badge";
import { MaterialIcon, materialHref } from "@/features/materials/components/material-icon";
import { RequirementStatusBadge } from "@/features/requirements/components/requirement-status-badge";
import { AskAssistantButton } from "@/features/search/components/ask-assistant-button";
import { searchProject } from "@/features/search/queries";
import { requirementCode, taskCode } from "@/lib/format";
import { appConfig } from "@/server/config";
import { requireProjectByKey } from "@/server/permissions";

export const metadata: Metadata = { title: "搜索" };

const rowClass = "flex items-center gap-2.5 border-t py-2 text-sm first:border-0 hover:text-accent-text";

export default async function SearchPage({ params, searchParams }: PageProps<"/projects/[key]/search">) {
  const { key } = await params;
  const { q: raw } = await searchParams;
  const q = (typeof raw === "string" ? raw : "").trim();
  const { project } = await requireProjectByKey(key);
  const result = q ? await searchProject(project.id, q) : null;

  return (
    <>
      <PageHeader
        title={q ? `搜索「${q}」` : "搜索"}
        description={result ? `在「${project.name}」中找到 ${result.total} 条结果` : "在顶栏输入关键字搜索任务、需求、帖子和材料"}
        actions={q && appConfig.assistantEnabled ? <AskAssistantButton question={q} projectKey={project.key} /> : null}
      />
      {result && (
        <div className="flex max-w-4xl flex-col gap-4">
          <Section title="任务" count={result.tasks.length}>
            {result.tasks.map((t) => (
              <Link key={t.id} href={`/projects/${project.key}/tasks?task=${t.number}&cycle=all`} className={rowClass}>
                <TaskStatusIcon status={t.status} />
                <span className="text-xs text-muted-foreground tabular-nums">{taskCode(project.key, t.number)}</span>
                <span className="truncate">{t.title}</span>
              </Link>
            ))}
          </Section>
          <Section title="需求" count={result.requirements.length}>
            {result.requirements.map((r) => (
              <Link key={r.id} href={`/projects/${project.key}/requirements/${r.number}`} className={rowClass}>
                <span className="text-xs text-muted-foreground tabular-nums">{requirementCode(r.number)}</span>
                <span className="flex-1 truncate">{r.title}</span>
                <RequirementStatusBadge status={r.status} />
              </Link>
            ))}
          </Section>
          <Section title="交流区" count={result.topics.length}>
            {result.topics.map((t) => (
              <Link key={t.id} href={`/projects/${project.key}/discussions/${t.id}`} className={rowClass}>
                <TopicStatusBadge status={t.status} />
                <span className="flex-1 truncate">{t.title}</span>
                {t.isFaq && <StatusBadge tone="accent">FAQ</StatusBadge>}
              </Link>
            ))}
          </Section>
          <Section title="材料" count={result.materials.length}>
            {result.materials.map((m) => (
              <a key={m.id} href={materialHref(m)} target={m.kind === "LINK" ? "_blank" : undefined} rel="noopener noreferrer" className={rowClass}>
                <MaterialIcon material={m} small />
                <span className="truncate">{m.name}</span>
              </a>
            ))}
          </Section>
          {result.total === 0 && (
            <p className="rounded-lg border bg-card py-12 text-center text-sm text-muted-foreground">没有找到相关内容，试试换个关键词{appConfig.assistantEnabled && "，或者问问项目助手"}</p>
          )}
        </div>
      )}
    </>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  if (count === 0) return null;
  return (
    <SectionCard title={title} extra={<Badge variant="secondary">{count}</Badge>}>
      {children}
    </SectionCard>
  );
}

import { PinIcon } from "lucide-react";

import { useAppConfig } from "@/components/layout/workspace-context";
import { Markdown } from "@/components/shared/markdown";
import { PageHeader } from "@/components/shared/page-header";
import { PageTitle } from "@/components/shared/page-title";
import { StatusBadge } from "@/components/shared/status-badge";
import { UserAvatar } from "@/components/shared/user-avatar";
import { AnnouncementActions, PublishAnnouncementButton } from "@/features/announcements/components/announcement-controls";
import type { AnnouncementsData } from "@/features/announcements/routes";
import { formatDateTime } from "@/lib/dates";
import { useParams } from "@/lib/navigation";
import { useApi } from "@/lib/query";
import { cn } from "@/lib/utils";

export default function AnnouncementsPage() {
  const { key } = useParams<{ key: string }>();
  const { user, project, announcements } = useApi<AnnouncementsData>(`/api/projects/${key}/announcements`);
  const { timeZone } = useAppConfig();
  const admin = user.role === "ADMIN";

  return (
    <>
      <PageTitle title="公告" />
      <PageHeader
        title="公告"
        description="迭代启动、环境变更、规范调整等重要通知；置顶公告会显示在所有成员的工作台"
        actions={<PublishAnnouncementButton projectId={project.id} />}
      />
      <div className="flex max-w-3xl flex-col gap-3">
        {announcements.length === 0 && <p className="rounded-lg border bg-card py-12 text-center text-sm text-muted-foreground">还没有公告</p>}
        {announcements.map((a) => (
          <article key={a.id} className={cn("rounded-lg border bg-card px-5 py-4 shadow-xs", a.pinned && "border-[#f0dcb4] bg-gradient-to-b from-[#fffdf8] to-card")}>
            <div className="mb-2 flex items-center gap-2">
              {a.pinned && (
                <StatusBadge tone="warn">
                  <PinIcon />
                  置顶
                </StatusBadge>
              )}
              <h2 className="text-base font-semibold">{a.title}</h2>
              <div className="ml-auto">
                <AnnouncementActions
                  projectId={project.id}
                  announcement={{ id: a.id, title: a.title, body: a.body, pinned: a.pinned }}
                  canManage={a.authorId === user.id || admin}
                />
              </div>
            </div>
            <div className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground">
              <UserAvatar user={a.author} size="sm" />
              {a.author.name} · {formatDateTime(a.createdAt, timeZone)}
              {a.editedAt && <span title={`编辑于 ${formatDateTime(a.editedAt, timeZone)}`}>· 已编辑</span>}
            </div>
            <Markdown>{a.body}</Markdown>
          </article>
        ))}
      </div>
    </>
  );
}

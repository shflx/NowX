import { PinIcon } from "lucide-react";
import type { Metadata } from "next";

import { Markdown } from "@/components/shared/markdown";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { UserAvatar } from "@/components/shared/user-avatar";
import { AnnouncementActions, PublishAnnouncementButton } from "@/features/announcements/components/announcement-controls";
import { listAnnouncements } from "@/features/announcements/queries";
import { formatDateTime } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { isAdmin } from "@/server/auth/dal";
import { appConfig } from "@/server/config";
import { requireProjectByKey } from "@/server/permissions";

export const metadata: Metadata = { title: "公告" };

export default async function AnnouncementsPage({ params }: PageProps<"/projects/[key]/announcements">) {
  const { key } = await params;
  const { user, project } = await requireProjectByKey(key);
  const announcements = await listAnnouncements(project.id);
  const admin = isAdmin(user);

  return (
    <>
      <PageHeader
        title="公告"
        description="迭代启动、环境变更、规范调整等重要通知；置顶公告会显示在所有成员的工作台"
        actions={<PublishAnnouncementButton projectId={project.id} canPin={admin} />}
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
                <AnnouncementActions id={a.id} pinned={a.pinned} canPin={admin} canDelete={a.authorId === user.id || admin} />
              </div>
            </div>
            <div className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground">
              <UserAvatar user={a.author} size="sm" />
              {a.author.name} · {formatDateTime(a.createdAt, appConfig.timeZone)}
            </div>
            <Markdown>{a.body}</Markdown>
          </article>
        ))}
      </div>
    </>
  );
}

import { Suspense, useEffect, useRef } from "react";
import { Outlet, useLocation } from "react-router";

import { AppSidebar } from "@/components/layout/app-sidebar";
import { LiveUpdates } from "@/components/layout/live-updates";
import { Topbar } from "@/components/layout/topbar";
import { useWorkspaceData, WorkspaceProvider, type WorkspaceValue } from "@/components/layout/workspace-context";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { AssistantLauncher } from "@/features/assistant/components/assistant-launcher";
import { AssistantProvider } from "@/features/assistant/components/assistant-provider";
import { LAST_PROJECT_COOKIE } from "@/lib/cookies";
import { formatRelative } from "@/lib/dates";
import { type NavigationState, useParams } from "@/lib/navigation";

/**
 * 已登录页面的外壳。侧边栏、顶栏、助手入口各自在 Suspense 中加载，
 * 页面内容在独立的边界中加载，导航时不会被外壳的数据请求阻塞。
 */
export function WorkspaceLayout() {
  const location = useLocation();
  const projectKey = useParams<{ key?: string }>().key;
  const mainRef = useRef<HTMLElement>(null);

  // 记录最近访问的项目，工作台据此决定侧边栏展示哪个项目
  useEffect(() => {
    if (projectKey) document.cookie = `${LAST_PROJECT_COOKIE}=${projectKey.toUpperCase()}; Path=/; SameSite=Lax; Max-Age=31536000`;
  }, [projectKey]);

  // 页面在 main 内滚动：导航后回到顶部，scroll={false} 的导航保留位置
  useEffect(() => {
    if (!(location.state as NavigationState | null)?.preserveScroll) mainRef.current?.scrollTo(0, 0);
  }, [location]);

  return (
    <AssistantProvider>
      <div className="grid h-screen grid-cols-[232px_minmax(0,1fr)]">
        <Suspense fallback={<SidebarSkeleton />}>
          <WorkspaceSection>
            <AppSidebar />
          </WorkspaceSection>
        </Suspense>
        <div className="flex min-w-0 flex-col overflow-hidden">
          <Suspense fallback={<div className="h-14 shrink-0 border-b bg-card" />}>
            <TopbarSection />
          </Suspense>
          <main ref={mainRef} id="main" className="flex-1 overflow-y-auto px-7 pt-6 pb-12">
            {/* 换页时显示骨架屏；同一页面内切换筛选条件则保留当前内容直到新数据返回 */}
            <Suspense key={location.pathname} fallback={<PageSkeleton />}>
              <Outlet />
            </Suspense>
          </main>
        </div>
      </div>
      <Suspense>
        <AssistantSection />
      </Suspense>
      <LiveUpdates />
    </AssistantProvider>
  );
}

function useWorkspaceValue(): WorkspaceValue {
  const { notifications: _notifications, config, ...value } = useWorkspaceData();
  return { ...value, assistantEnabled: config.assistantEnabled };
}

function WorkspaceSection({ children }: { children: React.ReactNode }) {
  return <WorkspaceProvider value={useWorkspaceValue()}>{children}</WorkspaceProvider>;
}

/** 顶栏：面包屑、搜索、通知 */
function TopbarSection() {
  const { notifications, config } = useWorkspaceData();
  const now = new Date();
  const items = notifications.items.map((n) => ({
    id: n.id,
    text: n.text,
    href: n.href,
    read: Boolean(n.readAt),
    time: formatRelative(n.createdAt, config.timeZone, now),
  }));
  return (
    <WorkspaceSection>
      <Topbar notifications={items} unread={notifications.unread} />
    </WorkspaceSection>
  );
}

/** 项目助手悬浮入口：未配置助手时不显示 */
function AssistantSection() {
  return useWorkspaceData().config.assistantEnabled ? <AssistantLauncher /> : null;
}

function SidebarSkeleton() {
  return (
    <div className="flex flex-col gap-3 border-r bg-sidebar p-3">
      <Skeleton className="h-6 w-24" />
      <Skeleton className="h-12" />
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} className="h-7" />
      ))}
    </div>
  );
}

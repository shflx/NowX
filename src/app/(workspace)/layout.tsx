import { type ReactNode, Suspense } from "react";

import { LiveUpdates } from "@/components/layout/live-updates";
import { Skeleton } from "@/components/ui/skeleton";
import { AssistantPanel } from "@/features/assistant/components/assistant-panel";
import { AssistantProvider } from "@/features/assistant/components/assistant-provider";

import { SidebarSection, TopbarSection } from "./workspace-shell";

/**
 * 已登录页面的外壳。布局本身不读取会话：侧边栏、顶栏各自在 Suspense 中加载，
 * 页面内容由各页面的 loading 边界流式渲染，导航时不会被外壳的数据请求阻塞。
 */
export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <AssistantProvider>
      <div className="grid h-screen grid-cols-[232px_minmax(0,1fr)] has-data-assistant-open:grid-cols-[232px_minmax(0,1fr)_400px]">
        <Suspense fallback={<SidebarSkeleton />}>
          <SidebarSection />
        </Suspense>
        <div className="flex min-w-0 flex-col overflow-hidden">
          <Suspense fallback={<div className="h-14 shrink-0 border-b bg-card" />}>
            <TopbarSection />
          </Suspense>
          <main id="main" className="flex-1 overflow-y-auto px-7 pt-6 pb-12">
            {children}
          </main>
        </div>
        {/* 这两个客户端组件读取 URL 参数，需要在 Suspense 内 */}
        <Suspense>
          <AssistantPanel />
        </Suspense>
      </div>
      <Suspense>
        <LiveUpdates />
      </Suspense>
    </AssistantProvider>
  );
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

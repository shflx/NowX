import { AppSidebar } from "@/components/layout/app-sidebar";
import { Topbar } from "@/components/layout/topbar";
import { WorkspaceProvider } from "@/components/layout/workspace-context";
import { AssistantLauncher } from "@/features/assistant/components/assistant-launcher";

import { loadWorkspace } from "./workspace-data";

/** 侧边栏：读取会话与项目列表（在布局的 Suspense 内流式渲染） */
export async function SidebarSection() {
  const { value } = await loadWorkspace();
  return (
    <WorkspaceProvider value={value}>
      <AppSidebar />
    </WorkspaceProvider>
  );
}

/** 顶栏：面包屑、搜索、通知 */
export async function TopbarSection() {
  const { value, bell } = await loadWorkspace();
  return (
    <WorkspaceProvider value={value}>
      <Topbar notifications={bell.items} unread={bell.unread} />
    </WorkspaceProvider>
  );
}

/** 项目助手悬浮入口：未配置助手时不显示 */
export async function AssistantSection() {
  const { value } = await loadWorkspace();
  return value.assistantEnabled ? <AssistantLauncher /> : null;
}

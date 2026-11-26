import { createContext, type ReactNode, use } from "react";

import { useParams } from "@/lib/navigation";
import { useApi } from "@/lib/query";
import type { WorkspaceData } from "@/server/api/workspace";

export type WorkspaceValue = Omit<WorkspaceData, "notifications" | "config"> & {
  assistantEnabled: boolean;
};

const WorkspaceContext = createContext<WorkspaceValue | null>(null);

export function WorkspaceProvider({ value, children }: { value: WorkspaceValue; children: ReactNode }) {
  return <WorkspaceContext value={value}>{children}</WorkspaceContext>;
}

export function useWorkspace() {
  const value = use(WorkspaceContext);
  if (!value) throw new Error("useWorkspace 需要在 WorkspaceProvider 内使用");
  return value;
}

/** 工作区数据（侧边栏、顶栏、页面共用同一份缓存） */
export function useWorkspaceData() {
  return useApi<WorkspaceData>("/api/workspace");
}

/** 运行时配置：应用时区、站点地址、是否启用项目助手 */
export function useAppConfig() {
  return useWorkspaceData().config;
}

/** 当前项目：优先取 URL 中的项目编号，其次是最近访问的项目 */
export function useCurrentProject() {
  const { projects, fallbackProjectKey } = useWorkspace();
  const params = useParams<{ key?: string }>();
  const key = params.key?.toUpperCase() ?? fallbackProjectKey;
  return projects.find((p) => p.key === key) ?? null;
}

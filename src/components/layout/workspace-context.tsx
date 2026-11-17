"use client";

import { useParams } from "next/navigation";
import { createContext, type ReactNode, use } from "react";

import type { NavProject } from "@/features/projects/queries";
import type { CurrentUser } from "@/server/auth/dal";

export type WorkspaceValue = {
  user: CurrentUser;
  projects: NavProject[];
  /** 没有处在项目页面时（如工作台），侧边栏展示的项目 */
  fallbackProjectKey: string | null;
  assistantEnabled: boolean;
  /** 全部正常状态的账号（仅管理员加载，用于新建项目、添加成员） */
  directory: { id: string; name: string; title: string; color: string }[];
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

/** 当前项目：优先取 URL 中的项目编号，其次是最近访问的项目 */
export function useCurrentProject() {
  const { projects, fallbackProjectKey } = useWorkspace();
  const params = useParams<{ key?: string }>();
  const key = params.key?.toUpperCase() ?? fallbackProjectKey;
  return projects.find((p) => p.key === key) ?? null;
}

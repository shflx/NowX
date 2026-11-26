import { lazy } from "react";
import { createBrowserRouter, Navigate, useParams, useRouteError } from "react-router";

import { NotFoundView } from "@/components/shared/not-found-view";
import { NotFoundError, setRedirectHandler } from "@/lib/api";

import { RootLayout } from "./root-layout";
import { WorkspaceLayout } from "./workspace-layout";

// 页面按路由拆分代码，加载期间由外层 Suspense 展示骨架屏
const AccessTokensPage = lazy(() => import("@/pages/access-tokens"));
const AdminAccountsPage = lazy(() => import("@/pages/admin-accounts"));
const AdminProjectsPage = lazy(() => import("@/pages/admin-projects"));
const ChangePasswordPage = lazy(() => import("@/pages/change-password"));
const DashboardPage = lazy(() => import("@/pages/dashboard"));
const LoginPage = lazy(() => import("@/pages/login"));
const NotFoundPage = lazy(() => import("@/pages/not-found"));
const AnnouncementsPage = lazy(() => import("@/pages/project/announcements"));
const CyclesPage = lazy(() => import("@/pages/project/cycles"));
const DiscussionsPage = lazy(() => import("@/pages/project/discussions"));
const MaterialsPage = lazy(() => import("@/pages/project/materials"));
const RequirementPage = lazy(() => import("@/pages/project/requirement"));
const RequirementsPage = lazy(() => import("@/pages/project/requirements"));
const SearchPage = lazy(() => import("@/pages/project/search"));
const ProjectSettingsPage = lazy(() => import("@/pages/project/settings"));
const TasksPage = lazy(() => import("@/pages/project/tasks"));
const TopicPage = lazy(() => import("@/pages/project/topic"));

/** 页面数据不存在或无权访问时，在工作区内展示 404；其余错误交给上层 */
function PageError() {
  const error = useRouteError();
  if (error instanceof NotFoundError) return <NotFoundView />;
  throw error;
}

/** 项目首页默认进入任务页 */
function ProjectIndex() {
  const { key } = useParams();
  return <Navigate to={`/projects/${key}/tasks`} replace />;
}

const page = (path: string, Component: React.ComponentType) => ({ path, Component, errorElement: <PageError /> });

export const router = createBrowserRouter([
  {
    Component: RootLayout,
    children: [
      { path: "/login", Component: LoginPage },
      { path: "/change-password", Component: ChangePasswordPage },
      {
        Component: WorkspaceLayout,
        children: [
          page("/", DashboardPage),
          page("/account/access-tokens", AccessTokensPage),
          page("/admin/projects", AdminProjectsPage),
          page("/admin/accounts", AdminAccountsPage),
          { path: "/projects/:key", Component: ProjectIndex },
          page("/projects/:key/tasks", TasksPage),
          page("/projects/:key/cycles", CyclesPage),
          page("/projects/:key/requirements", RequirementsPage),
          page("/projects/:key/requirements/:number", RequirementPage),
          page("/projects/:key/discussions", DiscussionsPage),
          page("/projects/:key/discussions/:topicId", TopicPage),
          page("/projects/:key/materials", MaterialsPage),
          page("/projects/:key/announcements", AnnouncementsPage),
          page("/projects/:key/settings", ProjectSettingsPage),
          page("/projects/:key/search", SearchPage),
        ],
      },
      { path: "*", Component: NotFoundPage },
    ],
  },
]);

setRedirectHandler((to) => void router.navigate(to, { replace: true }));

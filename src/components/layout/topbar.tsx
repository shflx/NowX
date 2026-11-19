"use client";

import { ChevronRightIcon, SearchIcon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";

import { type BellNotification, NotificationBell } from "./notification-bell";
import { useCurrentProject } from "./workspace-context";

const SECTION_TITLES: Record<string, string> = {
  tasks: "任务",
  cycles: "周期",
  requirements: "需求",
  discussions: "交流区",
  materials: "材料库",
  announcements: "公告",
  settings: "项目设置",
  search: "搜索结果",
};

/** 根据路径生成面包屑：项目名 > 栏目 */
function useBreadcrumb() {
  const pathname = usePathname();
  const project = useCurrentProject();
  if (pathname === "/") return [project?.name ?? "NowX", "工作台"];
  if (pathname.startsWith("/admin/accounts")) return ["系统", "账号管理"];
  if (pathname.startsWith("/admin/projects")) return ["系统", "项目管理"];
  const section = pathname.split("/")[3];
  const detail = pathname.split("/")[4];
  const crumbs = [project?.name ?? "项目", SECTION_TITLES[section] ?? ""];
  if (detail) crumbs.push(section === "discussions" ? "帖子详情" : "详情");
  return crumbs;
}

export function Topbar({ notifications, unread }: { notifications: BellNotification[]; unread: number }) {
  const crumbs = useBreadcrumb();
  const project = useCurrentProject();
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);

  // ⌘K / Ctrl+K 聚焦搜索框
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const q = searchRef.current?.value.trim();
    if (q && project) router.push(`/projects/${project.key}/search?q=${encodeURIComponent(q)}`);
  }

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-card px-6">
      <nav aria-label="面包屑" className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
        {crumbs.map((crumb, i) => (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRightIcon className="size-3.5" />}
            <span className={cn("truncate", i === crumbs.length - 1 && "font-semibold text-foreground")}>{crumb}</span>
          </span>
        ))}
      </nav>

      <form onSubmit={handleSearch} className="ml-auto" role="search">
        <label className="flex w-72 items-center gap-2 rounded-lg border border-transparent bg-background px-2.5 py-1.5 text-muted-foreground focus-within:border-input focus-within:bg-card">
          <SearchIcon className="size-4" />
          <input
            ref={searchRef}
            name="q"
            placeholder={project ? "搜索任务、需求、帖子、材料" : "加入项目后可以搜索"}
            disabled={!project}
            className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none"
            autoComplete="off"
          />
          <Kbd>⌘K</Kbd>
        </label>
      </form>

      <NotificationBell items={notifications} unread={unread} />
    </header>
  );
}

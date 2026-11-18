"use client";

import {
  CircleCheckBigIcon,
  FileTextIcon,
  FolderIcon,
  HouseIcon,
  LogOutIcon,
  MegaphoneIcon,
  MessagesSquareIcon,
  RefreshCwIcon,
  SlidersHorizontalIcon,
  UsersIcon,
  KeyRoundIcon,
  FolderCogIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType, ReactNode } from "react";

import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { logout } from "@/features/auth/actions";
import { cn } from "@/lib/utils";

import { ProjectSwitcher } from "./project-switcher";
import { useCurrentProject, useWorkspace } from "./workspace-context";

type NavItemProps = {
  href: string;
  icon: ComponentType<{ className?: string }>;
  children: ReactNode;
  count?: number;
  /** 需要提醒的数字用强调色 */
  highlight?: boolean;
  exact?: boolean;
};

function NavItem({ href, icon: Icon, children, count, highlight, exact }: NavItemProps) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground",
        active && "bg-card font-medium text-foreground shadow-xs hover:bg-card",
      )}
    >
      <Icon className="size-4" />
      {children}
      {Boolean(count) && (
        <span
          className={cn(
            "ml-auto text-xs tabular-nums",
            highlight ? "rounded-full bg-primary px-1.5 leading-[18px] text-primary-foreground" : "text-muted-foreground",
          )}
        >
          {count}
        </span>
      )}
    </Link>
  );
}

const SectionLabel = ({ children }: { children: ReactNode }) => (
  <div className="px-2.5 pt-3 pb-1 text-[11px] tracking-wide text-muted-foreground">{children}</div>
);

export function AppSidebar() {
  const { user } = useWorkspace();
  const project = useCurrentProject();
  const isAdmin = user.role === "ADMIN";
  const base = project ? `/projects/${project.key}` : "";

  return (
    <aside className="flex h-screen flex-col gap-1 overflow-y-auto border-r bg-sidebar px-2.5 py-3">
      <Link href="/" className="flex items-center gap-2 px-2 pb-3 text-base font-bold">
        <span className="grid size-6.5 place-items-center rounded-md bg-primary text-[13px] font-extrabold text-primary-foreground">
          N
        </span>
        NowX
      </Link>

      <ProjectSwitcher />

      <nav className="mt-2 flex flex-col gap-0.5" aria-label="主导航">
        <NavItem href="/" icon={HouseIcon} exact>
          工作台
        </NavItem>

        {project && (
          <>
            <SectionLabel>项目</SectionLabel>
            <NavItem href={`${base}/tasks`} icon={CircleCheckBigIcon} count={project.myOpenTasks}>
              任务
            </NavItem>
            <NavItem href={`${base}/cycles`} icon={RefreshCwIcon}>
              周期
            </NavItem>
            <NavItem href={`${base}/requirements`} icon={FileTextIcon}>
              需求
            </NavItem>
            <SectionLabel>协作</SectionLabel>
            <NavItem href={`${base}/discussions`} icon={MessagesSquareIcon} count={project.waitingForMe} highlight>
              交流区
            </NavItem>
            <NavItem href={`${base}/materials`} icon={FolderIcon}>
              材料库
            </NavItem>
            <NavItem href={`${base}/announcements`} icon={MegaphoneIcon}>
              公告
            </NavItem>
          </>
        )}

        {/* 管理功能只对管理员可见 */}
        {isAdmin && (
          <>
            <SectionLabel>管理</SectionLabel>
            {project && (
              <NavItem href={`${base}/settings`} icon={SlidersHorizontalIcon}>
                项目设置
              </NavItem>
            )}
            <NavItem href="/admin/projects" icon={FolderCogIcon}>
              项目管理
            </NavItem>
            <NavItem href="/admin/accounts" icon={UsersIcon}>
              账号管理
            </NavItem>
          </>
        )}
      </nav>

      <div className="mt-auto flex items-center gap-2 border-t pt-3">
        <UserAvatar user={user} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{user.name}</div>
          <div className="truncate text-xs text-muted-foreground">
            {user.title}
            {isAdmin && " · 管理员"}
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="账号菜单">
              <LogOutIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top">
            <DropdownMenuItem asChild>
              <Link href="/change-password">
                <KeyRoundIcon />
                修改密码
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => logout()}>
              <LogOutIcon />
              退出登录
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}

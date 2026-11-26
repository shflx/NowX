import {
  ChevronUpIcon,
  CircleCheckBigIcon,
  FileTextIcon,
  FolderIcon,
  HouseIcon,
  LogOutIcon,
  KeySquareIcon,
  MegaphoneIcon,
  MessagesSquareIcon,
  RefreshCwIcon,
  SlidersHorizontalIcon,
  UsersIcon,
  KeyRoundIcon,
  FolderCogIcon,
} from "lucide-react";
import { useRef, type ComponentType, type ReactNode } from "react";

import { UserAvatar } from "@/components/shared/user-avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { logout } from "@/features/auth/actions";
import { Link, usePathname } from "@/lib/navigation";
import { routes } from "@/lib/routes";
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

  // 记录账号菜单是否由指针打开：指针打开时关闭菜单不把焦点还给触发器，避免残留焦点框；键盘操作仍保留焦点归还
  const openedByPointerRef = useRef(false);

  return (
    <aside className="flex h-screen flex-col gap-1 overflow-y-auto border-r bg-sidebar px-2.5 py-3">
      <ProjectSwitcher />

      <nav className="mt-2 flex flex-col gap-0.5" aria-label="主导航">
        <NavItem href="/" icon={HouseIcon} exact>
          工作台
        </NavItem>

        {project && (
          <>
            <SectionLabel>项目</SectionLabel>
            <NavItem href={routes.tasks(project.key)} icon={CircleCheckBigIcon} count={project.myOpenTasks}>
              任务
            </NavItem>
            <NavItem href={routes.cycles(project.key)} icon={RefreshCwIcon}>
              周期
            </NavItem>
            <NavItem href={routes.requirements(project.key)} icon={FileTextIcon}>
              需求
            </NavItem>
            <SectionLabel>协作</SectionLabel>
            <NavItem href={routes.discussions(project.key)} icon={MessagesSquareIcon} count={project.waitingForMe} highlight>
              交流区
            </NavItem>
            <NavItem href={routes.materials(project.key)} icon={FolderIcon}>
              材料库
            </NavItem>
            <NavItem href={routes.announcements(project.key)} icon={MegaphoneIcon}>
              公告
            </NavItem>
          </>
        )}

        {/* 管理功能只对管理员可见 */}
        {isAdmin && (
          <>
            <SectionLabel>管理</SectionLabel>
            {project && (
              <NavItem href={routes.settings(project.key)} icon={SlidersHorizontalIcon}>
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

      {/* 整个用户区作为账号菜单入口，承载修改密码、访问令牌和退出登录 */}
      <div className="mt-auto border-t pt-3">
        <DropdownMenu>
          <DropdownMenuTrigger
            asChild
            onPointerDown={() => (openedByPointerRef.current = true)}
            onKeyDown={() => (openedByPointerRef.current = false)}
          >
            <button
              type="button"
              aria-label="账号菜单"
              className="flex w-full items-center gap-2 rounded-md p-1 text-left transition-colors outline-none hover:bg-sidebar-accent focus-visible:ring-3 focus-visible:ring-ring/50 data-[state=open]:bg-sidebar-accent"
            >
              <UserAvatar user={user} size="lg" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{user.name}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {user.title}
                  {isAdmin && " · 管理员"}
                </div>
              </div>
              <ChevronUpIcon className="size-4 shrink-0 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            side="top"
            onCloseAutoFocus={(event) => {
              if (openedByPointerRef.current) event.preventDefault();
            }}
          >
            <DropdownMenuItem asChild>
              <Link href="/change-password">
                <KeyRoundIcon />
                修改密码
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/account/access-tokens">
                <KeySquareIcon />
                个人访问令牌
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
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

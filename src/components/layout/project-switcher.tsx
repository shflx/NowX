import { CheckIcon, ChevronsUpDownIcon, FolderCogIcon, PlusIcon } from "lucide-react";
import { useState } from "react";

import { ProjectDot } from "@/components/shared/project-dot";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CreateProjectDialog } from "@/features/projects/components/create-project-dialog";
import { useRouter } from "@/lib/navigation";
import { routes } from "@/lib/routes";

import { useCurrentProject, useWorkspace } from "./workspace-context";

export function ProjectSwitcher() {
  const { projects, user, directory } = useWorkspace();
  const current = useCurrentProject();
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  const joined = projects.filter((p) => p.joined && !p.archived);
  const others = projects.filter((p) => !p.joined && !p.archived);
  const archived = projects.filter((p) => p.archived);
  const isAdmin = user.role === "ADMIN";

  const renderItem = (p: (typeof projects)[number]) => (
    <DropdownMenuItem key={p.id} onSelect={() => router.push(routes.tasks(p.key))}>
      <ProjectDot project={p} />
      <span className="flex-1 truncate">{p.name}</span>
      {p.id === current?.id && <CheckIcon />}
    </DropdownMenuItem>
  );

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="flex w-full items-center gap-2 rounded-lg border bg-card p-2 text-left transition-colors outline-none hover:border-input focus-visible:ring-3 focus-visible:ring-ring/50">
          {current ? (
            <>
              <ProjectDot project={current} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{current.name}</span>
                <span className="block text-xs text-muted-foreground">{current.memberCount} 名成员</span>
              </span>
            </>
          ) : (
            <span className="flex-1 text-sm text-muted-foreground">暂无项目</span>
          )}
          <ChevronsUpDownIcon className="size-4 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-(--radix-dropdown-menu-trigger-width) min-w-56">
          <DropdownMenuLabel>我参与的项目</DropdownMenuLabel>
          {joined.length ? joined.map(renderItem) : <div className="px-2 py-1.5 text-sm text-muted-foreground">还没有加入任何项目</div>}
          {others.length > 0 && (
            <>
              <DropdownMenuLabel>其他项目</DropdownMenuLabel>
              {others.map(renderItem)}
            </>
          )}
          {archived.length > 0 && (
            <>
              <DropdownMenuLabel>已归档</DropdownMenuLabel>
              {archived.map(renderItem)}
            </>
          )}
          {isAdmin && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setCreating(true)}>
                <PlusIcon />
                新建项目
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => router.push("/admin/projects")}>
                <FolderCogIcon />
                管理项目
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {isAdmin && <CreateProjectDialog open={creating} onOpenChange={setCreating} currentUserId={user.id} directory={directory} />}
    </>
  );
}

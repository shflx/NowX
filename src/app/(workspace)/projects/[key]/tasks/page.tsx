import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { loadTaskFormOptions } from "@/features/tasks/form-options";
import { getTaskDetail, listTasks } from "@/features/tasks/queries";
import { toTaskCard } from "@/features/tasks/serialize";
import { toTaskSheetData } from "@/features/tasks/sheet-data";
import { TaskBoard } from "@/features/tasks/components/task-board";
import { TaskFilters, TaskViewToggle } from "@/features/tasks/components/task-filters";
import { NewTaskButton } from "@/features/tasks/components/task-form-dialog";
import { TaskList } from "@/features/tasks/components/task-list";
import { TaskSheet } from "@/features/tasks/components/task-sheet";
import { today } from "@/server/config";
import { requireProjectByKey } from "@/server/permissions";

export const metadata: Metadata = { title: "任务" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function TasksPage({ params, searchParams }: PageProps<"/projects/[key]/tasks">) {
  const { key } = await params;
  const sp = await searchParams;
  const { user, project } = await requireProjectByKey(key);
  const options = await loadTaskFormOptions(project);

  // 默认展示进行中的周期；URL 中的周期无效时同样回退
  const active = options.cycles.find((c) => c.status === "ACTIVE");
  const requested = one(sp.cycle);
  const cycle =
    requested && (requested === "all" || requested === "backlog" || options.cycles.some((c) => c.id === requested))
      ? requested
      : (active?.id ?? "all");
  const filter = { cycle, assignee: one(sp.assignee) ?? "all", q: one(sp.q) ?? "" };
  const view = one(sp.view) === "list" ? "list" : "board";
  const taskNumber = Number(one(sp.task));

  const now = today();
  const [tasks, detail] = await Promise.all([
    listTasks(project.id, filter, user.id),
    Number.isInteger(taskNumber) && taskNumber > 0 ? getTaskDetail(project.id, taskNumber) : null,
  ]);
  const cards = tasks.map((t) => toTaskCard(t, project.key, now));
  const me = { id: user.id, name: user.name, color: user.color };

  return (
    <>
      <PageHeader
        title="任务"
        description="拖动卡片即可变更状态；点击卡片查看详情、子任务与评论"
        actions={
          <>
            <TaskViewToggle view={view} />
            <NewTaskButton {...options} currentUserId={user.id} openAfterCreate />
          </>
        }
      />
      <TaskFilters
        cycles={options.cycles}
        members={options.members}
        currentUser={me}
        value={filter}
        summary={`${cards.filter((c) => !c.parentId).length} 个任务`}
      />
      {view === "board" ? <TaskBoard tasks={cards} today={now} /> : <TaskList tasks={cards} />}
      {detail && <TaskSheet task={toTaskSheetData(detail, project.key, now, user)} options={options} currentUser={me} />}
    </>
  );
}

import { useAppConfig } from "@/components/layout/workspace-context";
import { PageHeader } from "@/components/shared/page-header";
import { PageTitle } from "@/components/shared/page-title";
import { TaskBoard } from "@/features/tasks/components/task-board";
import { TaskFilters, TaskViewToggle } from "@/features/tasks/components/task-filters";
import { NewTaskButton } from "@/features/tasks/components/task-form-dialog";
import { TaskList } from "@/features/tasks/components/task-list";
import { TaskSheet } from "@/features/tasks/components/task-sheet";
import type { TasksPageData } from "@/features/tasks/routes";
import { toTaskCard } from "@/features/tasks/serialize";
import { toTaskSheetData } from "@/features/tasks/sheet-data";
import { todayIn } from "@/lib/dates";
import { useParams, useSearchParams } from "@/lib/navigation";
import { useApi } from "@/lib/query";

/** 页面数据只取决于筛选条件与打开的任务，视图切换不需要重新请求 */
const DATA_PARAMS = ["cycle", "assignee", "q", "task"];

export default function TasksPage() {
  const { key } = useParams<{ key: string }>();
  const searchParams = useSearchParams();
  const query = new URLSearchParams([...searchParams].filter(([name]) => DATA_PARAMS.includes(name)));
  const { user, project, options, filter, tasks, detail } = useApi<TasksPageData>(`/api/projects/${key}/tasks?${query}`);
  const { timeZone } = useAppConfig();

  const view = searchParams.get("view") === "list" ? "list" : "board";
  const now = todayIn(timeZone);
  const cards = tasks.map((t) => toTaskCard(t, project.key, now, timeZone));
  const me = { id: user.id, name: user.name, color: user.color };

  return (
    <>
      <PageTitle title="任务" />
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
      {detail && <TaskSheet task={toTaskSheetData(detail, project.key, now, user, timeZone)} options={options} currentUser={me} />}
    </>
  );
}

import { Hono } from "hono";

import { requireProjectByKey } from "@/server/permissions";

import { getTaskDetail, listTasks, loadTaskFormOptions } from "./queries";

export const routes = new Hono();

/** 任务页：筛选后的任务、表单选项，以及 ?task= 指定的任务详情 */
async function loadTasksPage(key: string, params: { cycle?: string; assignee?: string; q?: string; task?: string }) {
  const { user, project } = await requireProjectByKey(key);
  const options = await loadTaskFormOptions(project);

  // 默认展示进行中的周期；URL 中的周期无效时同样回退
  const active = options.cycles.find((c) => c.status === "ACTIVE");
  const requested = params.cycle;
  const cycle =
    requested && (requested === "all" || requested === "backlog" || options.cycles.some((c) => c.id === requested))
      ? requested
      : (active?.id ?? "all");
  const filter = { cycle, assignee: params.assignee ?? "all", q: params.q ?? "" };
  const taskNumber = Number(params.task);

  const [tasks, detail] = await Promise.all([
    listTasks(project.id, filter, user.id),
    Number.isInteger(taskNumber) && taskNumber > 0 ? getTaskDetail(project.id, taskNumber) : null,
  ]);
  return { user, project: { id: project.id, key: project.key }, options, filter, tasks, detail };
}

export type TasksPageData = Awaited<ReturnType<typeof loadTasksPage>>;

routes.get("/projects/:key/tasks", async (c) => c.json(await loadTasksPage(c.req.param("key"), c.req.query())));

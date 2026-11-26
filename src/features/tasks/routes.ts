import { Hono } from "hono";

import { db } from "@/server/db";
import { jsonArrayFrom, jsonObjectFrom } from "@/server/db/json";
import { requireProjectByKey } from "@/server/permissions";

import { loadTaskFormOptions, taskDetailQuery, taskListQuery } from "./queries";

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

  // 任务列表与打开的任务详情合并为一条查询
  const { tasks, detail } = await db
    .selectNoFrom(() => [
      jsonArrayFrom(taskListQuery(project.id, filter, user.id)).as("tasks"),
      jsonObjectFrom(taskDetailQuery(project.id, Number.isInteger(taskNumber) && taskNumber > 0 ? taskNumber : 0)).as("detail"),
    ])
    .executeTakeFirstOrThrow();
  return { user, project: { id: project.id, key: project.key }, options, filter, tasks, detail };
}

export type TasksPageData = Awaited<ReturnType<typeof loadTasksPage>>;

routes.get("/projects/:key/tasks", async (c) => c.json(await loadTasksPage(c.req.param("key"), c.req.query())));

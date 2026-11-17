import "server-only";

import { listProjectMembers } from "@/features/projects/queries";
import { toDateString } from "@/lib/dates";

import type { TaskFormOptions } from "./components/types";
import { getTaskFormOptions } from "./queries";

/** 组装任务表单需要的成员、周期、需求选项（已序列化） */
export async function loadTaskFormOptions(project: { id: string; key: string }): Promise<TaskFormOptions> {
  const [members, { cycles, requirements }] = await Promise.all([listProjectMembers(project.id), getTaskFormOptions(project.id)]);
  return {
    projectId: project.id,
    projectKey: project.key,
    members: members.filter((m) => m.status === "ACTIVE").map(({ id, name, color }) => ({ id, name, color })),
    cycles: cycles.map((c) => ({ ...c, startDate: toDateString(c.startDate), endDate: toDateString(c.endDate) })),
    requirements,
  };
}

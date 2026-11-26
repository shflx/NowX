import { OPEN_TASK_STATUSES } from "@/lib/constants";
import { toDateString } from "@/lib/dates";
import { db } from "@/server/db";
import { jsonArrayFrom, jsonObjectFrom } from "@/server/db/json";

import { countByStatus, summarize } from "./stats";

/** 项目的全部周期及各自的进度（按顶层任务统计） */
export async function listCycles(projectId: string) {
  const cycles = await db
    .selectFrom("Cycle as c")
    .selectAll("c")
    .select((eb) => [
      jsonArrayFrom(
        eb
          .selectFrom("Task as t")
          .select("t.status")
          .whereRef("t.cycleId", "=", "c.id")
          .where("t.projectId", "=", projectId)
          .where("t.parentId", "is", null),
      ).as("tasks"),
    ])
    .where("c.projectId", "=", projectId)
    .orderBy("c.startDate", "asc")
    .execute();

  return cycles.map(({ tasks, ...cycle }) => {
    const counts = countByStatus(tasks);
    return {
      ...cycle,
      startDate: toDateString(cycle.startDate),
      endDate: toDateString(cycle.endDate),
      counts,
      ...summarize(counts),
    };
  });
}

export type CycleListItem = Awaited<ReturnType<typeof listCycles>>[number];

/** 周期详情的原始数据：顶层任务、顺延出去的任务、本期需求，统计在页面中按当天日期计算 */
export async function getCycleDetailData(cycle: { id: string; status: string }) {
  const [tasks, carried, requirements, unfinished] = await Promise.all([
    db
      .selectFrom("Task as t")
      .select((eb) => [
        "t.status",
        "t.createdAt",
        "t.completedAt",
        jsonObjectFrom(eb.selectFrom("User as u").select(["u.id", "u.name", "u.color"]).whereRef("u.id", "=", "t.assigneeId")).as(
          "assignee",
        ),
      ])
      .where("t.cycleId", "=", cycle.id)
      .where("t.parentId", "is", null)
      .execute(),
    db
      .selectFrom("Task as t")
      .select((eb) => [
        "t.id",
        "t.number",
        "t.title",
        "t.status",
        jsonObjectFrom(eb.selectFrom("Cycle as c").select("c.name").whereRef("c.id", "=", "t.cycleId")).as("cycle"),
      ])
      .where("t.carriedFromCycleId", "=", cycle.id)
      .where("t.parentId", "is", null)
      .orderBy("t.number", "asc")
      .execute(),
    // 本期需求：计划在本周期交付的需求，加上从本周期顺延出去的需求（用于周期回顾）
    db
      .selectFrom("Requirement as r")
      .select((eb) => [
        "r.id",
        "r.number",
        "r.title",
        "r.status",
        "r.cycleId",
        "r.carriedFromCycleId",
        jsonObjectFrom(eb.selectFrom("Cycle as c").select("c.name").whereRef("c.id", "=", "r.carriedFromCycleId")).as(
          "carriedFrom",
        ),
        jsonObjectFrom(eb.selectFrom("Cycle as c").select("c.name").whereRef("c.id", "=", "r.cycleId")).as("cycle"),
        jsonArrayFrom(
          eb.selectFrom("Task as t").select("t.status").whereRef("t.requirementId", "=", "r.id").where("t.parentId", "is", null),
        ).as("tasks"),
      ])
      .where((eb) => eb.or([eb("r.cycleId", "=", cycle.id), eb("r.carriedFromCycleId", "=", cycle.id)]))
      .orderBy("r.number", "asc")
      .execute(),
    // 结束周期时需要处理的未完成顶层任务
    cycle.status === "ACTIVE"
      ? db
          .selectFrom("Task as t")
          .select((eb) => [
            "t.id",
            "t.number",
            "t.title",
            "t.status",
            jsonObjectFrom(eb.selectFrom("User as u").select(["u.name", "u.color"]).whereRef("u.id", "=", "t.assigneeId")).as(
              "assignee",
            ),
          ])
          .where("t.cycleId", "=", cycle.id)
          .where("t.parentId", "is", null)
          .where("t.status", "in", OPEN_TASK_STATUSES)
          .orderBy("t.number", "asc")
          .execute()
      : [],
  ]);
  return { tasks, carried, requirements, unfinished };
}

export type CycleDetailData = Awaited<ReturnType<typeof getCycleDetailData>>;

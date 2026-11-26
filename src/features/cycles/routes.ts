import { Hono } from "hono";

import { requireProjectByKey } from "@/server/permissions";

import { getCycleDetailData, listCycles } from "./queries";

export const routes = new Hono();

/** 周期页：全部周期，以及选中周期（默认进行中 → 计划中 → 最后一个）的详情数据 */
async function loadCyclesPage(key: string, selectedId: string | undefined) {
  const { project } = await requireProjectByKey(key);
  const cycles = await listCycles(project.id);
  const selected =
    cycles.find((c) => c.id === selectedId) ??
    cycles.find((c) => c.status === "ACTIVE") ??
    cycles.find((c) => c.status === "PLANNED") ??
    cycles.at(-1);
  const detail = selected ? await getCycleDetailData(selected) : null;
  return { project: { id: project.id, key: project.key }, cycles, selectedId: selected?.id ?? null, detail };
}

export type CyclesPageData = Awaited<ReturnType<typeof loadCyclesPage>>;

routes.get("/projects/:key/cycles", async (c) => c.json(await loadCyclesPage(c.req.param("key"), c.req.query("cycle"))));

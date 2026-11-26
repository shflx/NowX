import { z } from "zod";

import { behindPlan, countByStatus, summarize, timeline } from "@/features/cycles/stats";
import { searchProject } from "@/features/search/queries";
import { BLOCK_COMMENT_PREFIX } from "@/features/tasks/status-flow";
import { ASSISTANT_NAME, OPEN_TASK_STATUSES, REQUIREMENT_STATUS_LABEL, TASK_STATUS_LABEL, TOPIC_STATUS_LABEL } from "@/lib/constants";
import { fromDateString, toDateString, todayIn } from "@/lib/dates";
import { requirementCode, taskCode } from "@/lib/format";
import { routes } from "@/lib/routes";
import type { CurrentUser } from "@/server/auth/dal";
import { appConfig, today } from "@/server/config";
import { db } from "@/server/db";
import { jsonArrayFrom, jsonObjectFrom } from "@/server/db/json";

import { defineTool } from "./tool-definition";

type Scope = { user: CurrentUser; project: { id: string; key: string; name: string } };

// 项目助手可用的工具：全部只读，且查询范围固定在当前项目、权限由调用方保证。
// 返回紧凑的 JSON，附带站内链接，便于模型在回答中引用。

export function buildAssistantTools({ user, project }: Scope) {
  const taskLink = (n: number) => routes.task(project.key, n, { allCycles: true });
  const now = () => today();

  const listTasks = defineTool({
    name: "list_tasks",
    description:
      "查询当前项目的任务。可按负责人（me 表示提问者本人，或成员姓名）、状态范围（open 未完成 / overdue 已逾期 / blocked 阻塞中 / done 已完成 / all 全部）、周期范围（active 进行中的周期 / all 全部）筛选。只返回顶层任务。阻塞中的任务会附带阻塞原因与开始阻塞的日期。",
    inputSchema: z.object({
      assignee: z.string().optional().describe("me、成员姓名，留空表示所有人"),
      status: z.enum(["open", "overdue", "blocked", "done", "all"]).default("open"),
      cycle: z.enum(["active", "all"]).default("active"),
    }),
    run: async ({ assignee, status, cycle }) => {
      let assigneeId: string | undefined;
      if (assignee === "me") assigneeId = user.id;
      else if (assignee) {
        const member = await db
          .selectFrom("User as u")
          .innerJoin("ProjectMember as m", "m.userId", "u.id")
          .select("u.id")
          .where("u.name", "=", assignee)
          .where("m.projectId", "=", project.id)
          .executeTakeFirst();
        if (!member) return JSON.stringify({ error: `项目中没有名为「${assignee}」的成员` });
        assigneeId = member.id;
      }

      let query = db
        .selectFrom("Task as t")
        .select((eb) => [
          "t.number",
          "t.title",
          "t.status",
          "t.priority",
          "t.dueDate",
          "t.blockedAt",
          jsonObjectFrom(eb.selectFrom("User as u").select("u.name").whereRef("u.id", "=", "t.assigneeId")).as("assignee"),
          jsonObjectFrom(eb.selectFrom("Cycle as c").select("c.name").whereRef("c.id", "=", "t.cycleId")).as("cycle"),
          jsonObjectFrom(eb.selectFrom("Requirement as r").select("r.number").whereRef("r.id", "=", "t.requirementId")).as("requirement"),
          // 最近一次标记阻塞时填写的原因
          eb
            .selectFrom("TaskComment as c")
            .select("c.body")
            .whereRef("c.taskId", "=", "t.id")
            .where("c.body", "like", `${BLOCK_COMMENT_PREFIX}%`)
            .orderBy("c.createdAt", "desc")
            .limit(1)
            .as("blockReason"),
        ])
        .where("t.projectId", "=", project.id)
        .where("t.parentId", "is", null);
      if (assigneeId) query = query.where("t.assigneeId", "=", assigneeId);
      if (cycle === "active") {
        query = query.where((eb) => eb.exists(eb.selectFrom("Cycle as c").whereRef("c.id", "=", "t.cycleId").where("c.status", "=", "ACTIVE")));
      }
      if (status === "open" || status === "overdue") query = query.where("t.status", "in", OPEN_TASK_STATUSES);
      if (status === "blocked") query = query.where("t.status", "=", "BLOCKED");
      if (status === "done") query = query.where("t.status", "=", "DONE");
      if (status === "overdue") query = query.where("t.dueDate", "<", fromDateString(now()));

      const tasks = await query.orderBy("t.dueDate", (ob) => ob.asc().nullsLast()).limit(50).execute();
      return JSON.stringify({
        today: now(),
        count: tasks.length,
        tasks: tasks.map((t) => ({
          code: taskCode(project.key, t.number),
          title: t.title,
          status: TASK_STATUS_LABEL[t.status],
          priority: t.priority,
          assignee: t.assignee?.name ?? "未指派",
          due: t.dueDate ? toDateString(t.dueDate) : null,
          cycle: t.cycle?.name ?? "待规划",
          requirement: t.requirement ? requirementCode(t.requirement.number) : null,
          ...(t.status === "BLOCKED" && {
            blocked: {
              since: t.blockedAt ? todayIn(appConfig.timeZone, t.blockedAt) : null,
              reason: t.blockReason?.slice(BLOCK_COMMENT_PREFIX.length) ?? null,
            },
          }),
          link: taskLink(t.number),
        })),
      });
    },
  });

  const cycleProgress = defineTool({
    name: "get_cycle_progress",
    description: "查询当前项目进行中周期的进度：完成率、剩余任务、剩余天数、与理想燃尽线相比落后多少、各成员的完成情况，以及计划在本期交付的需求及其状态。",
    inputSchema: z.object({}),
    run: async () => {
      const cycle = await db
        .selectFrom("Cycle as c")
        .selectAll("c")
        .select((eb) => [
          jsonArrayFrom(
            eb
              .selectFrom("Task as t")
              .select((t) => ["t.status", jsonObjectFrom(t.selectFrom("User as u").select("u.name").whereRef("u.id", "=", "t.assigneeId")).as("assignee")])
              .whereRef("t.cycleId", "=", "c.id")
              .where("t.parentId", "is", null),
          ).as("tasks"),
          jsonArrayFrom(
            eb
              .selectFrom("Requirement as r")
              .select((r) => [
                "r.number",
                "r.title",
                "r.status",
                jsonArrayFrom(r.selectFrom("Task as t").select("t.status").whereRef("t.requirementId", "=", "r.id").where("t.parentId", "is", null)).as(
                  "tasks",
                ),
              ])
              .whereRef("r.cycleId", "=", "c.id"),
          ).as("requirements"),
        ])
        .where("c.projectId", "=", project.id)
        .where("c.status", "=", "ACTIVE")
        .executeTakeFirst();
      if (!cycle) return JSON.stringify({ error: "当前项目没有进行中的周期" });
      const start = toDateString(cycle.startDate);
      const end = toDateString(cycle.endDate);
      const stats = summarize(countByStatus(cycle.tasks));
      const byMember = new Map<string, { status: (typeof cycle.tasks)[number]["status"] }[]>();
      for (const t of cycle.tasks) {
        const name = t.assignee?.name ?? "未指派";
        byMember.set(name, [...(byMember.get(name) ?? []), t]);
      }
      return JSON.stringify({
        cycle: cycle.name,
        start,
        end,
        goal: cycle.goal,
        today: now(),
        ...timeline(start, end, now()),
        ...stats,
        behindPlan: behindPlan(stats.total, stats.remaining, start, end, now()),
        members: [...byMember.entries()].map(([name, tasks]) => ({ name, ...summarize(countByStatus(tasks)) })),
        requirements: cycle.requirements.map((r) => ({
          code: requirementCode(r.number),
          title: r.title,
          status: REQUIREMENT_STATUS_LABEL[r.status],
          tasks: summarize(countByStatus(r.tasks)),
        })),
        link: routes.cycle(project.key, cycle.id),
      });
    },
  });

  const requirement = defineTool({
    name: "get_requirement",
    description: "按编号（如 R-101）或标题关键字查询需求，返回需求状态、计划交付周期、外部文档链接和拆解出的任务。",
    inputSchema: z.object({ query: z.string().describe("需求编号如 R-101，或标题关键字") }),
    run: async ({ query }) => {
      const number = Number(query.replace(/^R-?/i, ""));
      const found = await db
        .selectFrom("Requirement as r")
        .selectAll("r")
        .select((eb) => [
          jsonObjectFrom(eb.selectFrom("User as u").select("u.name").whereRef("u.id", "=", "r.ownerId")).as("owner"),
          jsonObjectFrom(eb.selectFrom("Cycle as c").select("c.name").whereRef("c.id", "=", "r.cycleId")).as("cycle"),
          jsonArrayFrom(eb.selectFrom("RequirementDoc as d").select(["d.name", "d.url"]).whereRef("d.requirementId", "=", "r.id")).as("docs"),
          jsonArrayFrom(
            eb
              .selectFrom("Task as t")
              .select((t) => [
                "t.number",
                "t.title",
                "t.status",
                jsonObjectFrom(t.selectFrom("User as u").select("u.name").whereRef("u.id", "=", "t.assigneeId")).as("assignee"),
              ])
              .whereRef("t.requirementId", "=", "r.id")
              .where("t.parentId", "is", null),
          ).as("tasks"),
        ])
        .where("r.projectId", "=", project.id)
        .where((eb) => eb.or([...(Number.isInteger(number) && number > 0 ? [eb("r.number", "=", number)] : []), eb("r.title", "ilike", `%${query}%`)]))
        .executeTakeFirst();
      if (!found) return JSON.stringify({ error: `没有找到需求「${query}」` });
      return JSON.stringify({
        code: requirementCode(found.number),
        title: found.title,
        status: REQUIREMENT_STATUS_LABEL[found.status],
        owner: found.owner?.name ?? null,
        plannedCycle: found.cycle?.name ?? "待排期",
        summary: found.summary,
        docs: found.docs,
        progress: summarize(countByStatus(found.tasks)),
        tasks: found.tasks.map((t) => ({
          code: taskCode(project.key, t.number),
          title: t.title,
          status: TASK_STATUS_LABEL[t.status],
          assignee: t.assignee?.name ?? "未指派",
          link: taskLink(t.number),
        })),
        link: routes.requirement(project.key, found.number),
      });
    },
  });

  const topics = defineTool({
    name: "list_topics",
    description: "查询交流区的帖子：waiting_for_me 等提问者回答的帖子，open 所有待回答的帖子，faq 精选 FAQ。",
    inputSchema: z.object({ filter: z.enum(["waiting_for_me", "open", "faq"]) }),
    run: async ({ filter }) => {
      let query = db
        .selectFrom("Topic as o")
        .select((eb) => [
          "o.id",
          "o.title",
          "o.status",
          jsonObjectFrom(eb.selectFrom("User as u").select("u.name").whereRef("u.id", "=", "o.authorId"))
            .$notNull()
            .as("author"),
          jsonObjectFrom(eb.selectFrom("User as u").select("u.name").whereRef("u.id", "=", "o.assigneeId")).as("assignee"),
        ])
        .where("o.projectId", "=", project.id);
      if (filter === "waiting_for_me") query = query.where("o.assigneeId", "=", user.id).where("o.status", "=", "OPEN");
      else if (filter === "open") query = query.where("o.status", "=", "OPEN");
      else query = query.where("o.isFaq", "=", true);

      const rows = await query.orderBy("o.lastActivityAt", "desc").limit(30).execute();
      return JSON.stringify(
        rows.map((t) => ({
          title: t.title,
          status: TOPIC_STATUS_LABEL[t.status],
          author: t.author.name,
          assignee: t.assignee?.name ?? null,
          link: routes.topic(project.key, t.id),
        })),
      );
    },
  });

  const search = defineTool({
    name: "search_project",
    description: "在当前项目中按关键字搜索任务、需求、交流区帖子（含回复）和材料名称。用于回答业务或技术问题前查找线索。",
    inputSchema: z.object({ query: z.string().min(1).describe("关键字，尽量简短，如「手机号」「测试环境」") }),
    run: async ({ query }) => {
      const r = await searchProject(project.id, query);
      return JSON.stringify({
        tasks: r.tasks.map((t) => ({ code: taskCode(project.key, t.number), title: t.title, link: taskLink(t.number) })),
        requirements: r.requirements.map((q) => ({ code: requirementCode(q.number), title: q.title, link: routes.requirement(project.key, q.number) })),
        topics: r.topics.map((t) => ({ title: t.title, status: TOPIC_STATUS_LABEL[t.status], faq: t.isFaq, link: routes.topic(project.key, t.id) })),
        materials: r.materials.map((m) => ({ name: m.name, link: routes.materials(project.key) })),
      });
    },
  });

  const topicDetail = defineTool({
    name: "read_topic",
    description: "读取交流区某个帖子的正文和全部回复（含被采纳的答案）。link 来自 list_topics 或 search_project 的结果。",
    inputSchema: z.object({ link: z.string().describe("帖子链接，如 /projects/CRM/discussions/xxx") }),
    run: async ({ link }) => {
      const id = link.split("/").pop() ?? "";
      const topic = await db
        .selectFrom("Topic as o")
        .selectAll("o")
        .select((eb) => [
          jsonObjectFrom(eb.selectFrom("User as u").select("u.name").whereRef("u.id", "=", "o.authorId"))
            .$notNull()
            .as("author"),
          jsonArrayFrom(
            eb
              .selectFrom("Reply as p")
              .select((p) => [
                "p.body",
                "p.isAssistant",
                "p.isAccepted",
                jsonObjectFrom(p.selectFrom("User as u").select("u.name").whereRef("u.id", "=", "p.authorId")).as("author"),
              ])
              .whereRef("p.topicId", "=", "o.id")
              .orderBy("p.createdAt", "asc"),
          ).as("replies"),
        ])
        .where("o.id", "=", id)
        .where("o.projectId", "=", project.id)
        .executeTakeFirst();
      if (!topic) return JSON.stringify({ error: "帖子不存在" });
      return JSON.stringify({
        title: topic.title,
        body: topic.body,
        author: topic.author.name,
        status: TOPIC_STATUS_LABEL[topic.status],
        replies: topic.replies.map((r) => ({ author: r.isAssistant ? ASSISTANT_NAME : r.author?.name, body: r.body, accepted: r.isAccepted })),
      });
    },
  });

  const members = defineTool({
    name: "list_members",
    description: "列出当前项目的成员（姓名与职能）。",
    inputSchema: z.object({}),
    run: async () => {
      const rows = await db
        .selectFrom("ProjectMember as m")
        .innerJoin("User as u", "u.id", "m.userId")
        .select(["u.name", "u.title"])
        .where("m.projectId", "=", project.id)
        .execute();
      return JSON.stringify(rows);
    },
  });

  return [listTasks, cycleProgress, requirement, topics, topicDetail, search, members];
}

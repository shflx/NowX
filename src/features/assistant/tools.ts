import "server-only";

import { z } from "zod";

import { behindPlan, countByStatus, summarize, timeline } from "@/features/cycles/stats";
import { searchProject } from "@/features/search/queries";
import { OPEN_TASK_STATUSES, REQUIREMENT_STATUS_LABEL, TASK_STATUS_LABEL, TOPIC_STATUS_LABEL } from "@/lib/constants";
import { toDateString } from "@/lib/dates";
import { requirementCode, taskCode } from "@/lib/format";
import { routes } from "@/lib/routes";
import type { CurrentUser } from "@/server/auth/dal";
import { today } from "@/server/config";
import { db } from "@/server/db";

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
      "查询当前项目的任务。可按负责人（me 表示提问者本人，或成员姓名）、状态范围（open 未完成 / overdue 已逾期 / done 已完成 / all 全部）、周期范围（active 进行中的周期 / all 全部）筛选。只返回顶层任务。",
    inputSchema: z.object({
      assignee: z.string().optional().describe("me、成员姓名，留空表示所有人"),
      status: z.enum(["open", "overdue", "done", "all"]).default("open"),
      cycle: z.enum(["active", "all"]).default("active"),
    }),
    run: async ({ assignee, status, cycle }) => {
      let assigneeId: string | undefined;
      if (assignee === "me") assigneeId = user.id;
      else if (assignee) {
        const member = await db.user.findFirst({ where: { name: assignee, memberships: { some: { projectId: project.id } } } });
        if (!member) return JSON.stringify({ error: `项目中没有名为「${assignee}」的成员` });
        assigneeId = member.id;
      }
      const tasks = await db.task.findMany({
        where: {
          projectId: project.id,
          parentId: null,
          assigneeId,
          ...(cycle === "active" ? { cycle: { status: "ACTIVE" } } : {}),
          ...(status === "done" ? { status: "DONE" } : status === "all" ? {} : { status: { in: OPEN_TASK_STATUSES } }),
          ...(status === "overdue" ? { dueDate: { lt: new Date(`${now()}T00:00:00Z`) } } : {}),
        },
        orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }],
        take: 50,
        select: {
          number: true,
          title: true,
          status: true,
          priority: true,
          dueDate: true,
          assignee: { select: { name: true } },
          cycle: { select: { name: true } },
          requirement: { select: { number: true } },
        },
      });
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
      const cycle = await db.cycle.findFirst({
        where: { projectId: project.id, status: "ACTIVE" },
        include: {
          tasks: { where: { parentId: null }, select: { status: true, assignee: { select: { name: true } } } },
          requirements: { select: { number: true, title: true, status: true, tasks: { where: { parentId: null }, select: { status: true } } } },
        },
      });
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
      const found = await db.requirement.findFirst({
        where: {
          projectId: project.id,
          OR: [...(Number.isInteger(number) && number > 0 ? [{ number }] : []), { title: { contains: query, mode: "insensitive" } }],
        },
        include: {
          owner: { select: { name: true } },
          cycle: { select: { name: true } },
          docs: true,
          tasks: { where: { parentId: null }, select: { number: true, title: true, status: true, assignee: { select: { name: true } } } },
        },
      });
      if (!found) return JSON.stringify({ error: `没有找到需求「${query}」` });
      return JSON.stringify({
        code: requirementCode(found.number),
        title: found.title,
        status: REQUIREMENT_STATUS_LABEL[found.status],
        owner: found.owner?.name ?? null,
        plannedCycle: found.cycle?.name ?? "待排期",
        summary: found.summary,
        docs: found.docs.map((d) => ({ name: d.name, url: d.url })),
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
      const rows = await db.topic.findMany({
        where: {
          projectId: project.id,
          ...(filter === "waiting_for_me" ? { assigneeId: user.id, status: "OPEN" } : filter === "open" ? { status: "OPEN" } : { isFaq: true }),
        },
        orderBy: { lastActivityAt: "desc" },
        take: 30,
        select: { id: true, title: true, status: true, author: { select: { name: true } }, assignee: { select: { name: true } } },
      });
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
      const topic = await db.topic.findFirst({
        where: { id, projectId: project.id },
        include: { author: { select: { name: true } }, replies: { orderBy: { createdAt: "asc" }, include: { author: { select: { name: true } } } } },
      });
      if (!topic) return JSON.stringify({ error: "帖子不存在" });
      return JSON.stringify({
        title: topic.title,
        body: topic.body,
        author: topic.author.name,
        status: TOPIC_STATUS_LABEL[topic.status],
        replies: topic.replies.map((r) => ({ author: r.isAssistant ? "项目助手" : r.author?.name, body: r.body, accepted: r.isAccepted })),
      });
    },
  });

  const members = defineTool({
    name: "list_members",
    description: "列出当前项目的成员（姓名与职能）。",
    inputSchema: z.object({}),
    run: async () => {
      const rows = await db.projectMember.findMany({ where: { projectId: project.id }, select: { user: { select: { name: true, title: true } } } });
      return JSON.stringify(rows.map((r) => r.user));
    },
  });

  return [listTasks, cycleProgress, requirement, topics, topicDetail, search, members];
}

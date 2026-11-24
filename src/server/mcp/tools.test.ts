import { randomUUID } from "node:crypto";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { CurrentUser } from "@/server/auth/dal";

vi.mock("server-only", () => ({}));

const testDatabaseUrl = process.env.NOWX_MCP_TEST_DATABASE_URL;

describe.skipIf(!testDatabaseUrl)("MCP 工具（PostgreSQL）", () => {
  let db: typeof import("@/server/db").db;
  let member: CurrentUser;
  let admin: CurrentUser;
  let memberClient: Client;
  let adminClient: Client;
  let cycleId: string;
  let projectId: string;
  const prefix = randomUUID().replace(/[\d-]/g, "").toUpperCase().padEnd(4, "X").slice(0, 4);
  const joined = `${prefix}A`;
  const privateProject = `${prefix}B`;
  const archived = `${prefix}C`;

  beforeAll(async () => {
    vi.stubEnv("DATABASE_URL", testDatabaseUrl);
    ({ db } = await import("@/server/db"));
    const { createMcpServer } = await import("./tools");
    const account = { name: "工具测试", passwordHash: "unused", mustChangePassword: false, color: "#fff" };
    member = await db.user.create({ data: { ...account, login: `test-${randomUUID()}` } });
    admin = await db.user.create({ data: { ...account, login: `test-${randomUUID()}`, role: "ADMIN" } });
    const project = await db.project.create({
      data: { key: joined, name: "已加入项目", color: "#fff", requirementSeq: 2, taskSeq: 2, members: { create: { userId: member.id } } },
    });
    projectId = project.id;
    await db.project.create({ data: { key: privateProject, name: "未加入项目", color: "#fff" } });
    await db.project.create({
      data: {
        key: archived,
        name: "已归档项目",
        color: "#fff",
        archivedAt: new Date(),
        members: { create: { userId: member.id } },
        requirements: { create: { number: 1, title: "归档需求" } },
        tasks: { create: { number: 1, title: "归档任务", creatorId: member.id } },
      },
    });
    const cycle = await db.cycle.create({
      data: {
        projectId: project.id,
        name: "一期",
        goal: "交付登录",
        status: "ACTIVE",
        startDate: new Date("2026-11-01"),
        endDate: new Date("2026-11-15"),
      },
    });
    cycleId = cycle.id;
    const requirement = await db.requirement.create({
      data: {
        projectId: project.id,
        number: 1,
        title: "登录流程",
        summary: "说明登录流程",
        status: "DESIGN",
        ownerId: member.id,
        cycleId,
        docs: { create: { type: "OTHER", name: "登录设计", url: "https://example.com/login" } },
      },
    });
    await db.requirement.create({ data: { projectId: project.id, number: 2, title: "待排期需求 100%" } });
    const task = await db.task.create({
      data: {
        projectId: project.id,
        number: 1,
        title: "Login Flow",
        description: "实现登录流程",
        status: "IN_PROGRESS",
        priority: "HIGH",
        assigneeId: member.id,
        creatorId: member.id,
        cycleId,
        requirementId: requirement.id,
      },
    });
    await db.task.create({
      data: { projectId: project.id, number: 2, title: "子任务 release_1", creatorId: member.id, parentId: task.id },
    });

    async function connect(user: CurrentUser) {
      const client = new Client({ name: "nowx-test", version: "1.0.0" });
      const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
      await createMcpServer(user).connect(serverTransport);
      await client.connect(clientTransport);
      return client;
    }
    memberClient = await connect(member);
    adminClient = await connect(admin);
  });

  afterAll(async () => {
    await memberClient?.close();
    await adminClient?.close();
    if (db) {
      await db.project.deleteMany({ where: { key: { in: [joined, privateProject, archived] } } });
      await db.user.deleteMany({ where: { id: { in: [member?.id, admin?.id].filter(Boolean) } } });
      await db.$disconnect();
    }
    vi.unstubAllEnvs();
  });

  it("标注工具的读写权限，并按角色返回活跃项目", async () => {
    const { tools } = await memberClient.listTools();
    expect(tools.map((tool) => tool.name)).toEqual([
      "list_projects",
      "list_tasks",
      "get_task",
      "list_requirements",
      "get_requirement",
      "list_cycles",
      "create_requirement",
      "update_requirement",
      "create_task",
      "update_task",
    ]);
    for (const tool of tools) {
      expect(tool.annotations?.readOnlyHint).toBe(/^(list|get)_/.test(tool.name));
    }
    const projects = async (client: Client) => {
      const result = await client.callTool({ name: "list_projects", arguments: {} });
      expect(result.isError).toBeFalsy();
      const items = (result.structuredContent as { items: { key: string }[] }).items;
      return items.filter(({ key }) => [joined, privateProject, archived].includes(key)).map(({ key }) => key);
    };
    expect(await projects(memberClient)).toEqual([joined]);
    expect(await projects(adminClient)).toEqual([joined, privateProject]);
  });

  it("按项目、周期、状态、负责人和关键字筛选任务，按页返回", async () => {
    const call = (args: Record<string, unknown>) =>
      memberClient.callTool({ name: "list_tasks", arguments: { projectKey: joined.toLowerCase(), ...args } });
    for (const args of [
      { cycle: cycleId },
      { cycle: "active" },
      { status: "IN_PROGRESS" },
      { assigneeId: "me" },
      { q: "login" },
      { q: `${joined}-1` },
    ]) {
      expect((await call(args)).structuredContent).toEqual({
        items: [expect.objectContaining({ code: `${joined}-1`, priority: "HIGH" })],
        nextOffset: null,
      });
    }
    expect((await call({ limit: 1 })).structuredContent).toMatchObject({ nextOffset: 1, items: [{ number: 1 }] });
    expect((await call({ offset: 1, limit: 1 })).structuredContent).toMatchObject({ nextOffset: null, items: [{ number: 2 }] });
    expect((await call({ limit: 101 })).isError).toBe(true);
  });

  it("返回任务描述、子任务和关联需求", async () => {
    const result = await memberClient.callTool({ name: "get_task", arguments: { projectKey: joined, number: `${joined}-1` } });
    expect(result.structuredContent).toMatchObject({
      code: `${joined}-1`,
      description: "实现登录流程",
      status: "IN_PROGRESS",
      priority: "HIGH",
      assignee: { id: member.id },
      requirement: { code: "R-1" },
      subtasks: [{ code: `${joined}-2`, title: "子任务 release_1" }],
    });
  });

  it("按交付周期、状态、负责人和关键字筛选需求，返回需求详情", async () => {
    for (const args of [{ cycle: cycleId }, { status: "DESIGN" }, { ownerId: member.id }, { q: "登录" }, { q: "r-1" }]) {
      const result = await memberClient.callTool({ name: "list_requirements", arguments: { projectKey: joined, ...args } });
      expect(result.structuredContent).toEqual({
        items: [expect.objectContaining({ code: "R-1", status: "DESIGN" })],
        nextOffset: null,
      });
    }
    const result = await memberClient.callTool({ name: "get_requirement", arguments: { projectKey: joined, number: "R-1" } });
    expect(result.structuredContent).toMatchObject({
      code: "R-1",
      summary: "说明登录流程",
      status: "DESIGN",
      plannedCycle: { id: cycleId, name: "一期" },
      docs: [{ name: "登录设计", url: "https://example.com/login" }],
      tasks: [{ code: `${joined}-1` }],
    });
  });

  it.each([
    ["list_tasks", "_"],
    ["list_requirements", "%"],
  ])("%s 按字面匹配标题中的 %s", async (name, q) => {
    const result = await memberClient.callTool({ name, arguments: { projectKey: joined, q } });
    expect(result.structuredContent).toEqual({ items: [expect.objectContaining({ number: 2 })], nextOffset: null });
  });

  it("返回可用于任务筛选的周期 ID 和进度", async () => {
    const result = await memberClient.callTool({ name: "list_cycles", arguments: { projectKey: joined } });
    expect(result.structuredContent).toMatchObject({
      items: [{ id: cycleId, name: "一期", status: "ACTIVE", startDate: "2026-11-01", endDate: "2026-11-15", goal: "交付登录", counts: { IN_PROGRESS: 1 }, total: 1, done: 0, remaining: 1, percent: 0 }],
    });
    const { items: [cycle] } = result.structuredContent as { items: { id: string }[] };
    const tasks = await memberClient.callTool({ name: "list_tasks", arguments: { projectKey: joined, cycle: cycle.id } });
    expect(tasks.structuredContent).toMatchObject({ items: [{ code: `${joined}-1` }] });
  });

  it("项目记录工具统一隐藏无权、归档和不存在的项目", async () => {
    for (const name of ["list_tasks", "get_task", "list_requirements", "get_requirement", "list_cycles"]) {
      const args = (projectKey: string) => ({ projectKey, ...(name.startsWith("get_") ? { number: 1 } : {}) });
      for (const [client, key] of [
        [memberClient, privateProject],
        [memberClient, archived],
        [adminClient, archived],
        [adminClient, `${prefix}D`],
      ] as const) {
        expect(await client.callTool({ name, arguments: args(key) })).toMatchObject({
          isError: true,
          content: [{ type: "text", text: "项目不存在或无权访问" }],
        });
      }
    }
    expect(
      (await adminClient.callTool({ name: "list_tasks", arguments: { projectKey: privateProject } })).structuredContent,
    ).toEqual({ items: [], nextOffset: null });
  });

  it("新建需求，部分更新保留摘要和链接，调整周期只移动未完成任务", async () => {
    const call = (name: string, args: Record<string, unknown>) =>
      memberClient.callTool({ name, arguments: { projectKey: joined, ...args } });
    const doc = { url: "https://example.com/design", name: "设计" };
    expect((await call("create_requirement", { title: "周期交付", summary: "验收摘要", ownerId: "me", cycleId, docs: [doc] })).structuredContent)
      .toEqual({ number: 3, code: "R-3" });
    const number = "R-3";
    expect((await call("update_requirement", { number, status: "DESIGN" })).isError).toBeFalsy();
    expect((await call("get_requirement", { number })).structuredContent).toMatchObject({
      title: "周期交付", summary: "验收摘要", status: "DESIGN", owner: { id: member.id }, plannedCycle: { id: cycleId }, docs: [doc],
    });
    const requirement = await db.requirement.findUniqueOrThrow({ where: { projectId_number: { projectId, number: 3 } } });
    const target = await db.cycle.create({ data: { projectId, name: "下期", startDate: new Date("2026-11-16"), endDate: new Date("2026-11-30") } });
    await db.task.createMany({ data: [
      { projectId, number: 100, title: "未完成", creatorId: member.id, cycleId, requirementId: requirement.id },
      { projectId, number: 101, title: "已完成", creatorId: member.id, cycleId, requirementId: requirement.id, status: "DONE" },
    ] });
    expect((await call("update_requirement", { number, cycleId: target.id, docs: [], ownerId: null })).structuredContent)
      .toMatchObject({ code: number, moved: 1, targetName: "下期" });
    expect(await db.requirement.findUnique({ where: { id: requirement.id } })).toMatchObject({ cycleId: target.id, carriedFromCycleId: cycleId });
    expect((await call("get_requirement", { number })).structuredContent).toMatchObject({
      docs: [], owner: null, tasks: [{ cycle: { id: target.id } }, { cycle: { id: cycleId } }],
    });
    expect(await db.activity.findFirst({ where: { projectId, verb: "把需求排入「下期」" } })).toMatchObject({ actorId: member.id });
  });

  it("需求写入按项目授权并拒绝无效排期、负责人和编号", async () => {
    const ended = await db.cycle.create({ data: { projectId, name: "已结束", status: "ENDED", startDate: new Date("2026-10-01"), endDate: new Date("2026-10-15") } });
    const title = "授权与校验";
    for (const [client, name, args, message] of [
      [memberClient, "create_requirement", { projectKey: privateProject, title }, "项目不存在或无权访问"],
      [adminClient, "update_requirement", { projectKey: archived, number: 1, title }, "项目不存在或无权访问"],
      [memberClient, "create_requirement", { projectKey: joined, title, ownerId: admin.id }, "所选成员不在该项目中"],
      [memberClient, "update_requirement", { projectKey: joined, number: 1, title, cycleId: ended.id }, "不能把需求排入已结束的周期"],
      [memberClient, "update_requirement", { projectKey: joined, number: 99, title }, "需求不存在"],
    ] as const) {
      expect(await client.callTool({ name, arguments: args })).toMatchObject({ isError: true, content: [{ type: "text", text: message }] });
    }
    expect(await db.requirement.findUnique({ where: { projectId_number: { projectId, number: 1 } } })).toMatchObject({ title: "登录流程" });
    expect((await adminClient.callTool({ name: "create_requirement", arguments: { projectKey: privateProject, title } })).structuredContent)
      .toEqual({ number: 1, code: "R-1" });
  });

  it("在需求下新建任务，完成后写入时间和动态，并通知新负责人", async () => {
    const created = await memberClient.callTool({
      name: "create_task",
      arguments: { projectKey: joined, title: "MCP 任务", description: "保留描述", cycleId, requirement: "R-1", assigneeId: "me" },
    });
    const number = `${joined}-3`;
    expect(created.structuredContent).toEqual({ number: 3, code: number });
    const result = await adminClient.callTool({ name: "update_task", arguments: { projectKey: joined, number, status: "DONE" } });
    expect(result.structuredContent).toMatchObject({ code: number, status: "DONE" });
    expect((await memberClient.callTool({ name: "get_task", arguments: { projectKey: joined, number } })).structuredContent)
      .toMatchObject({ description: "保留描述", requirement: { code: "R-1" }, cycle: { id: cycleId }, assignee: { id: member.id }, status: "DONE" });
    const where = { projectId_number: { projectId, number: 3 } };
    expect(await db.task.findUnique({ where })).toMatchObject({ completedAt: expect.any(Date) });
    expect(await db.activity.findFirst({ where: { projectId, verb: "完成了任务", target: `${number} MCP 任务` } })).toMatchObject({ actorId: admin.id });

    await memberClient.callTool({ name: "update_task", arguments: { projectKey: joined, number, status: "IN_PROGRESS", assigneeId: null } });
    await adminClient.callTool({ name: "update_task", arguments: { projectKey: joined, number, assigneeId: member.id } });
    expect(await db.task.findUnique({ where })).toMatchObject({ completedAt: null, assigneeId: member.id });
    expect(await db.notification.findFirst({ where: { userId: member.id, text: { contains: `把任务 ${number}` } } })).not.toBeNull();
  });

  it("拒绝跨项目引用和直接阻塞，允许恢复进行中并留下评论", async () => {
    const other = await db.project.findUniqueOrThrow({ where: { key: privateProject } });
    const otherCycle = await db.cycle.create({ data: { projectId: other.id, name: "外部周期", startDate: new Date("2026-11-01"), endDate: new Date("2026-11-15") } });
    await db.requirement.create({ data: { projectId: other.id, number: 200, title: "外部需求" } });
    const title = "校验引用";
    const call = (name: string, args: Record<string, unknown>) =>
      memberClient.callTool({ name, arguments: { projectKey: joined, ...args } });
    for (const [name, args, message] of [
      ["create_task", { projectKey: privateProject, title }, "项目不存在或无权访问"],
      ["update_task", { projectKey: archived, number: 1, title }, "项目不存在或无权访问"],
      ["create_task", { title, cycleId: otherCycle.id }, "所选周期不存在"],
      ["update_task", { number: 1, requirement: "R-200" }, "所选需求不存在"],
      ["create_task", { title, assigneeId: admin.id }, "所选成员不在该项目中"],
      ["create_task", { title, status: "BLOCKED" }, "新建的任务不能直接标记阻塞"],
      ["update_task", { number: 1, status: "BLOCKED" }, "标记阻塞需要填写原因"],
    ] as const) {
      expect(await call(name, args)).toMatchObject({ isError: true, content: [{ type: "text", text: message }] });
    }
    const task = await db.task.create({ data: { projectId, number: 102, title: "恢复任务", creatorId: member.id, status: "BLOCKED", blockedAt: new Date() } });
    expect(await call("update_task", { number: task.number, status: "DONE" })).toMatchObject({
      isError: true, content: [{ type: "text", text: "阻塞中的任务只能恢复为进行中" }],
    });
    expect((await call("update_task", { number: task.number, status: "IN_PROGRESS" })).structuredContent).toMatchObject({ status: "IN_PROGRESS" });
    expect(await db.task.findUnique({ where: { id: task.id } })).toMatchObject({ blockedAt: null });
    expect(await db.taskComment.findFirst({ where: { taskId: task.id } })).toMatchObject({
      authorId: member.id, body: expect.stringContaining("解除阻塞"),
    });
  });
});

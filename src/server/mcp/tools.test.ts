import { randomUUID } from "node:crypto";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { CurrentUser } from "@/server/auth/dal";

vi.mock("server-only", () => ({}));

const testDatabaseUrl = process.env.NOWX_MCP_TEST_DATABASE_URL;

describe.skipIf(!testDatabaseUrl)("MCP 查询工具（PostgreSQL）", () => {
  let db: typeof import("@/server/db").db;
  let member: CurrentUser;
  let admin: CurrentUser;
  let memberClient: Client;
  let adminClient: Client;
  let cycleId: string;
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
      data: { key: joined, name: "已加入项目", color: "#fff", members: { create: { userId: member.id } } },
    });
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
    await db.requirement.create({ data: { projectId: project.id, number: 2, title: "待排期需求" } });
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
      data: { projectId: project.id, number: 2, title: "子任务", creatorId: member.id, parentId: task.id },
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

  it("只注册五个只读工具，并按角色返回活跃项目", async () => {
    const { tools } = await memberClient.listTools();
    expect(tools.map((tool) => tool.name)).toEqual([
      "list_projects",
      "list_tasks",
      "get_task",
      "list_requirements",
      "get_requirement",
    ]);
    expect(tools.every((tool) => tool.annotations?.readOnlyHint)).toBe(true);
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
      subtasks: [{ code: `${joined}-2`, title: "子任务" }],
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

  it("四个记录工具统一隐藏无权、归档和不存在的项目", async () => {
    for (const name of ["list_tasks", "get_task", "list_requirements", "get_requirement"]) {
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
});

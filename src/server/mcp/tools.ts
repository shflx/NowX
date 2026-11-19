import "server-only";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import { RequirementStatus, TaskStatus } from "@/generated/prisma/enums";
import { ActionError } from "@/lib/action-result";
import type { CurrentUser } from "@/server/auth/dal";

import { getRequirement, getTask, listProjects, listRequirements, listTasks } from "./queries";

const maxInt = 2_147_483_647;
const recordNumber = z.union([z.number().int().positive().max(maxInt), z.string().regex(/^(?:[A-Za-z]{1,6}-)?[1-9]\d{0,9}$/)]);
const projectKey = z
  .string()
  .trim()
  .regex(/^[A-Za-z]{2,6}$/)
  .describe("项目编号前缀，例如 CRM");
const pageSchema = z.strictObject({
  limit: z.number().int().min(1).max(100).default(50).describe("每页条数，默认 50，最多 100"),
  offset: z
    .number()
    .int()
    .min(0)
    .max(maxInt - 100)
    .default(0)
    .describe("从上一页的 nextOffset 继续"),
});
const listSchema = pageSchema.extend({
  projectKey,
  cycle: z
    .union([z.enum(["active", "backlog"]), z.cuid()])
    .optional()
    .describe("周期 ID、active（进行中）或 backlog（未排期）"),
  q: z.string().trim().min(1).max(120).optional().describe("标题关键字或业务编号"),
});
const person = z
  .union([z.literal("me"), z.cuid(), z.null()])
  .optional()
  .describe("账号 ID、me（本人）或 null（未指派）");
const readOnly = { readOnlyHint: true, destructiveHint: false, openWorldHint: false };

async function toolResult(read: () => Promise<Record<string, unknown>>): Promise<CallToolResult> {
  try {
    const data = await read();
    return { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: data };
  } catch (error) {
    if (!(error instanceof ActionError)) console.error("[mcp tool]", error);
    return {
      isError: true,
      content: [{ type: "text", text: error instanceof ActionError ? error.message : "查询失败，请稍后重试" }],
    };
  }
}

export function createMcpServer(user: CurrentUser) {
  const server = new McpServer({ name: "NowX", version: "1.0.0" });

  server.registerTool(
    "list_projects",
    { description: "列出当前账号可访问的未归档项目。", inputSchema: pageSchema, annotations: readOnly },
    (input) => toolResult(() => listProjects(user, input)),
  );
  server.registerTool(
    "list_tasks",
    {
      description: "按项目查询任务（含子任务），可按周期、状态、负责人或关键字筛选。",
      inputSchema: listSchema.extend({ status: z.enum(TaskStatus).optional(), assigneeId: person }),
      annotations: readOnly,
    },
    (input) => toolResult(() => listTasks(user, input)),
  );
  server.registerTool(
    "get_task",
    {
      description: "读取项目任务的描述、负责人、子任务和关联需求。",
      inputSchema: z.strictObject({ projectKey, number: recordNumber.describe("数字编号或任务编号，例如 CRM-12") }),
      annotations: readOnly,
    },
    (input) => toolResult(() => getTask(user, input)),
  );
  server.registerTool(
    "list_requirements",
    {
      description: "按项目查询需求，可按计划交付周期、状态、负责人或关键字筛选。",
      inputSchema: listSchema.extend({ status: z.enum(RequirementStatus).optional(), ownerId: person }),
      annotations: readOnly,
    },
    (input) => toolResult(() => listRequirements(user, input)),
  );
  server.registerTool(
    "get_requirement",
    {
      description: "读取项目需求的摘要、计划交付周期、文档链接和关联任务。",
      inputSchema: z.strictObject({ projectKey, number: recordNumber.describe("数字编号或需求编号，例如 R-3") }),
      annotations: readOnly,
    },
    (input) => toolResult(() => getRequirement(user, input)),
  );

  return server;
}

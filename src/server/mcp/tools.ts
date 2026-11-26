import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import { requirementSchema } from "@/features/requirements/schemas";
import { taskFieldsSchema } from "@/features/tasks/schemas";
import { ActionError } from "@/lib/action-result";
import { RequirementStatus, TaskStatus } from "@/lib/enums";
import type { CurrentUser } from "@/server/auth/dal";

import { createProjectRequirement, createProjectTask, updateProjectRequirement, updateProjectTask } from "./mutations";
import { getRequirement, getTask, listProjectCycles, listProjects, listRequirements, listTasks } from "./queries";

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
const cycleId = z.cuid().nullable().describe("list_cycles 返回的周期 ID，或 null（未排期）");
const requirementNumber = recordNumber.describe("数字编号或需求编号，例如 R-3");
const requirementWriteFields = {
  ...requirementSchema.shape,
  ownerId: person,
  cycleId,
};
const createRequirementInput = z.strictObject({
  ...requirementWriteFields,
  projectKey,
  status: requirementSchema.shape.status.default("BACKLOG"),
  ownerId: person.default(null),
  cycleId: cycleId.default(null),
});
const updateRequirementInput = z
  .strictObject({
    ...requirementWriteFields,
    summary: requirementSchema.shape.summary.removeDefault(),
    docs: requirementSchema.shape.docs.removeDefault(),
  })
  .partial()
  .extend({ projectKey, number: requirementNumber });

const taskNumber = recordNumber.describe("数字编号或任务编号，例如 CRM-12");
const taskWriteFields = z.strictObject({
  ...taskFieldsSchema.omit({ requirementId: true }).shape,
  assigneeId: person,
  dueDate: z.iso.date().nullable().describe("截止日期（YYYY-MM-DD），或 null"),
  cycleId,
  requirement: requirementNumber.nullable().describe("同项目的需求编号，例如 R-3；null 表示不关联"),
});
const createTaskInput = taskWriteFields.extend({
  projectKey,
  status: taskWriteFields.shape.status.default("TODO"),
  priority: taskWriteFields.shape.priority.default("MEDIUM"),
  assigneeId: person.default(null),
  dueDate: taskWriteFields.shape.dueDate.default(null),
  cycleId: cycleId.default(null),
  requirement: taskWriteFields.shape.requirement.default(null),
});
const updateTaskInput = taskWriteFields
  .extend({
    description: taskWriteFields.shape.description.removeDefault(),
  })
  .partial()
  .extend({ projectKey, number: taskNumber });

const toolAnnotations = {
  read: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  write: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
};

async function toolResult(
  run: () => Promise<Record<string, unknown>>,
  operation: "read" | "write" = "read",
): Promise<CallToolResult> {
  try {
    const data = await run();
    return { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: data };
  } catch (error) {
    if (!(error instanceof ActionError)) console.error("[mcp tool]", error);
    const fallback = operation === "write" ? "写入失败，请检查记录状态" : "查询失败，请稍后重试";
    return { isError: true, content: [{ type: "text", text: error instanceof ActionError ? error.message : fallback }] };
  }
}

export function createMcpServer(user: CurrentUser) {
  const server = new McpServer({ name: "NowX", version: "1.0.0" });

  server.registerTool(
    "list_projects",
    { description: "列出当前账号可访问的未归档项目。", inputSchema: pageSchema, annotations: toolAnnotations.read },
    (input) => toolResult(() => listProjects(user, input)),
  );
  server.registerTool(
    "list_tasks",
    {
      description: "按项目查询任务（含子任务），可按周期、状态、负责人或关键字筛选。",
      inputSchema: listSchema.extend({ status: z.enum(TaskStatus).optional(), assigneeId: person }),
      annotations: toolAnnotations.read,
    },
    (input) => toolResult(() => listTasks(user, input)),
  );
  server.registerTool(
    "get_task",
    {
      description: "读取项目任务的描述、负责人、子任务和关联需求。",
      inputSchema: z.strictObject({ projectKey, number: taskNumber }),
      annotations: toolAnnotations.read,
    },
    (input) => toolResult(() => getTask(user, input)),
  );
  server.registerTool(
    "list_requirements",
    {
      description: "按项目查询需求，可按计划交付周期、状态、负责人或关键字筛选。",
      inputSchema: listSchema.extend({ status: z.enum(RequirementStatus).optional(), ownerId: person }),
      annotations: toolAnnotations.read,
    },
    (input) => toolResult(() => listRequirements(user, input)),
  );
  server.registerTool(
    "get_requirement",
    {
      description: "读取项目需求的摘要、计划交付周期、文档链接和关联任务。",
      inputSchema: z.strictObject({ projectKey, number: requirementNumber }),
      annotations: toolAnnotations.read,
    },
    (input) => toolResult(() => getRequirement(user, input)),
  );
  server.registerTool(
    "list_cycles",
    {
      description: "列出项目周期及顶层任务进度，返回可用于筛选和排期的周期 ID。",
      inputSchema: z.strictObject({ projectKey }),
      annotations: toolAnnotations.read,
    },
    (input) => toolResult(() => listProjectCycles(user, input)),
  );
  server.registerTool(
    "create_requirement",
    {
      description: "在项目中新建需求，返回需求编号。",
      inputSchema: createRequirementInput,
      annotations: toolAnnotations.write,
    },
    (input) => toolResult(() => createProjectRequirement(user, input), "write"),
  );
  server.registerTool(
    "update_requirement",
    {
      description: "修改指定需求的部分字段。docs 整体替换链接列表。更换周期时同时移动原周期中未完成的关联任务。",
      inputSchema: updateRequirementInput,
      annotations: toolAnnotations.write,
    },
    (input) => toolResult(() => updateProjectRequirement(user, input), "write"),
  );
  server.registerTool(
    "create_task",
    {
      description: "在项目中新建任务，可填写同项目的需求编号，返回任务编号。",
      inputSchema: createTaskInput,
      annotations: toolAnnotations.write,
    },
    (input) => toolResult(() => createProjectTask(user, input), "write"),
  );
  server.registerTool(
    "update_task",
    {
      description: "修改指定任务的部分字段。任务不能直接设为 BLOCKED。",
      inputSchema: updateTaskInput,
      annotations: toolAnnotations.write,
    },
    (input) => toolResult(() => updateProjectTask(user, input), "write"),
  );

  return server;
}

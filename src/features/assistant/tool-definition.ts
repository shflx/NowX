import "server-only";

import type { z } from "zod";

/**
 * 与协议无关的助手工具：用 Zod 描述参数，由各协议的适配层转换为对应的工具格式。
 * run 接收未经校验的参数，内部先按 inputSchema 校验并补齐默认值。
 */
export type AssistantTool = {
  name: string;
  description: string;
  inputSchema: z.ZodObject;
  run: (input: unknown) => Promise<string>;
};

export function defineTool<Schema extends z.ZodObject>(tool: {
  name: string;
  description: string;
  inputSchema: Schema;
  run: (input: z.infer<Schema>) => Promise<string>;
}): AssistantTool {
  return { ...tool, run: (input) => tool.run(tool.inputSchema.parse(input)) };
}

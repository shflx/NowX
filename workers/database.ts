import { AsyncLocalStorage } from "node:async_hooks";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "./.generated/prisma/client";

type RequestDatabase = {
  connectionString: string;
  client?: PrismaClient;
};

const requestDatabase = new AsyncLocalStorage<RequestDatabase>();

function getDatabase() {
  const state = requestDatabase.getStore();
  if (!state) throw new Error("数据库只能在请求内访问");
  state.client ??= new PrismaClient({
    adapter: new PrismaPg({ connectionString: state.connectionString, max: 1 }),
  });
  return state.client;
}

export const db = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = getDatabase();
    const value = Reflect.get(client, property, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

export type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];

export async function withDatabase(connectionString: string, run: () => Promise<Response>, ctx: ExecutionContext) {
  const state: RequestDatabase = { connectionString };

  return requestDatabase.run(state, async () => {
    const disconnect = () => {
      if (state.client) ctx.waitUntil(state.client.$disconnect());
    };

    try {
      const response = await run();
      if (!response.body) {
        disconnect();
        return response;
      }

      // SSR 可在响应流开始后继续查库。响应读完或取消后再释放连接。
      const reader = response.body.getReader();
      const body = new ReadableStream({
        async pull(controller) {
          try {
            const { value, done } = await reader.read();
            if (done) {
              disconnect();
              controller.close();
            } else {
              controller.enqueue(value);
            }
          } catch (error) {
            disconnect();
            controller.error(error);
          }
        },
        async cancel(reason) {
          try {
            await reader.cancel(reason);
          } finally {
            disconnect();
          }
        },
      });

      return new Response(body, response);
    } catch (error) {
      disconnect();
      throw error;
    }
  });
}

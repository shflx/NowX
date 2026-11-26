import { AsyncLocalStorage } from "node:async_hooks";

import { Kysely, PostgresDialect, type Transaction } from "kysely";
import pg from "pg";

import { reviveDates } from "@/lib/json-dates";

import type { DB } from "./schema";

// 与 Prisma 保持一致：timestamp(3) 按 UTC 存取，@db.Date 读出为 UTC 零点的 Date。
// Workers 运行在 UTC，这里显式设置是为了本地脚本和测试在其他时区下行为一致。
pg.types.setTypeParser(pg.types.builtins.TIMESTAMP, (value) => new Date(`${value.replace(" ", "T")}Z`));
pg.types.setTypeParser(pg.types.builtins.DATE, (value) => new Date(`${value}T00:00:00Z`));
pg.defaults.parseInputDatesAsUTC = true;
// 嵌套对象（见 ./json.ts）中的时间同样还原为 Date
pg.types.setTypeParser(pg.types.builtins.JSON, (value) => JSON.parse(value, reviveDates));
pg.types.setTypeParser(pg.types.builtins.JSONB, (value) => JSON.parse(value, reviveDates));

export type Database = Kysely<DB>;
export type Tx = Transaction<DB>;

type RequestDatabase = { connectionString: string; db?: Database };

const storage = new AsyncLocalStorage<RequestDatabase>();

/**
 * 每个请求使用独立的连接池：Hyperdrive 负责与数据库之间的连接复用，
 * Worker 内的连接只在本次请求中有效。允许少量并发连接，让同一页面的多次查询并行执行。
 */
function current() {
  const state = storage.getStore();
  if (!state) throw new Error("数据库只能在请求内访问");
  state.db ??= new Kysely<DB>({
    dialect: new PostgresDialect({ pool: new pg.Pool({ connectionString: state.connectionString, max: 4 }) }),
  });
  return state.db;
}

/** 当前请求的数据库实例 */
export const db = new Proxy({} as Database, {
  get(_target, property) {
    const instance = current();
    const value = Reflect.get(instance, property, instance);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});

/** 在指定数据库上执行 fn，结束后释放连接（请求入口与测试使用） */
export async function withDatabase<T>(
  connectionString: string,
  fn: () => Promise<T>,
  release: (task: Promise<void>) => void = () => {},
) {
  const state: RequestDatabase = { connectionString };
  return storage.run(state, async () => {
    try {
      return await fn();
    } finally {
      if (state.db) release(state.db.destroy());
    }
  });
}

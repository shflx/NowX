// 由 PostgreSQL 组装嵌套对象（替代 Prisma 的 include / select 关联）。
// 与 kysely/helpers/postgres 相同，只是保留 Date 类型：数据库返回的 JSON 在解析时
// 已经把时间还原为 Date（见 ./index.ts 中的 json 类型解析），前端收到响应后同样会还原。
// 注意：JSON 中的 date 列（如周期起止日期）需先转为 timestamp，才能还原为 UTC 零点的 Date。

import { type Expression, type RawBuilder, type Simplify, sql } from "kysely";
import * as postgres from "kysely/helpers/postgres";

export function jsonArrayFrom<O>(expr: Expression<O>) {
  return postgres.jsonArrayFrom(expr) as unknown as RawBuilder<Simplify<O>[]>;
}

export function jsonObjectFrom<O>(expr: Expression<O>) {
  return postgres.jsonObjectFrom(expr) as unknown as RawBuilder<Simplify<O> | null>;
}

export function jsonBuildObject<O extends Record<string, Expression<unknown>>>(obj: O) {
  return postgres.jsonBuildObject(obj) as unknown as RawBuilder<
    Simplify<{ [K in keyof O]: O[K] extends Expression<infer V> ? V : never }>
  >;
}

/** JSON 中的 date 列（Cycle 起止日期、Task 截止日期）转为 timestamp，解析后还原为 UTC 零点的 Date */
export function jsonDate<T extends Date | null = Date>(column: string) {
  return sql<T>`${sql.ref(column)}::timestamp`;
}

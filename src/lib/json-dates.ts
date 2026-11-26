// JSON 中的时间还原为 Date（前后端共用）。
// 接口响应中的时间是带 Z 的 ISO 字符串；数据库 JSON 聚合中的 timestamp 没有时区后缀，按 UTC 处理。

const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(Z|[+-]00:?00)?$/;

export function reviveDates(_key: string, value: unknown) {
  if (typeof value === "string" && ISO_DATETIME.test(value)) {
    return new Date(/(Z|[+-]00:?00)$/.test(value) ? value : `${value}Z`);
  }
  return value;
}

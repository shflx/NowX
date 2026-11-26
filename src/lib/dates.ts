// 日期工具。业务上的「日期」（周期起止、截止日期）统一用 yyyy-MM-dd 字符串在应用内传递，
// 数据库中以 @db.Date 存储（读出为 UTC 零点的 Date）。

export const DAY_MS = 24 * 60 * 60 * 1000;

/** 指定时区下的今天，格式 yyyy-MM-dd */
export function todayIn(timeZone: string, now = new Date()) {
  // en-CA 的日期格式恰好是 yyyy-MM-dd
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** @db.Date 读出的 Date → yyyy-MM-dd */
export function toDateString(date: Date) {
  return date.toISOString().slice(0, 10);
}

/** yyyy-MM-dd → 写入 @db.Date 的 Date */
export function fromDateString(value: string) {
  return new Date(`${value}T00:00:00Z`);
}

export function addDays(value: string, days: number) {
  return toDateString(new Date(fromDateString(value).getTime() + days * DAY_MS));
}

/** 开始日期起一个月（例如 11-08 → 12-07） */
export function addOneMonth(value: string) {
  const date = fromDateString(value);
  date.setUTCMonth(date.getUTCMonth() + 1);
  date.setUTCDate(date.getUTCDate() - 1);
  return toDateString(date);
}

/** 两个日期相差的天数（b - a） */
export function diffDays(a: string, b: string) {
  return Math.round((fromDateString(b).getTime() - fromDateString(a).getTime()) / DAY_MS);
}

/** 11/20 */
export function formatMonthDay(value: string) {
  const [, m, d] = value.split("-");
  return `${Number(m)}/${Number(d)}`;
}

/** 11 月 17 日 星期二 */
export function formatLongDate(value: string) {
  const [, m, d] = value.split("-");
  const week = "日一二三四五六"[fromDateString(value).getUTCDay()];
  return `${Number(m)} 月 ${Number(d)} 日 星期${week}`;
}

/** 时间点在指定时区的日期与时分 */
// 通知与帖子共用应用时区，只保留最近一个格式化器，避免每行都初始化 ICU。
let partsFormatter: { timeZone: string; format: Intl.DateTimeFormat } | undefined;

function partsIn(date: Date, timeZone: string) {
  if (partsFormatter?.timeZone !== timeZone) {
    partsFormatter = {
      timeZone,
      format: new Intl.DateTimeFormat("en-CA", {
        timeZone, year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", hourCycle: "h23",
      }),
    };
  }
  const parts = partsFormatter.format.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}

/** 相对时间：刚刚 / 5 分钟前 / 3 小时前 / 昨天 18:20 / 11-14 17:20 / 2025-11-14 */
export function formatRelative(date: Date, timeZone: string, now = new Date()) {
  const diff = now.getTime() - date.getTime();
  if (diff < 60_000) return "刚刚";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;

  const target = partsIn(date, timeZone);
  const today = partsIn(now, timeZone);
  if (target.date === today.date) return `${Math.floor(diff / 3_600_000)} 小时前`;
  if (target.date === addDays(today.date, -1)) return `昨天 ${target.time}`;
  if (target.date.slice(0, 4) === today.date.slice(0, 4)) return `${target.date.slice(5)} ${target.time}`;
  return target.date;
}

/** 完整时间：2026-11-17 09:05 */
export function formatDateTime(date: Date, timeZone: string) {
  const { date: d, time } = partsIn(date, timeZone);
  return `${d} ${time}`;
}

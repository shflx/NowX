import "server-only";

import { todayIn } from "@/lib/dates";

/** 运行时配置（来自环境变量） */
export const appConfig = {
  timeZone: process.env.APP_TIMEZONE || "Asia/Shanghai",
  appUrl: (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, ""),
  assistantEnabled: Boolean(process.env.ANTHROPIC_API_KEY),
};

/** 应用时区下的今天（yyyy-MM-dd） */
export const today = () => todayIn(appConfig.timeZone);

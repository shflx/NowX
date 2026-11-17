"use client";

import { usePathname, useSearchParams } from "next/navigation";

/** 生成打开任务详情的链接（保留当前筛选条件） */
export function useTaskLink() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  return (number: number | null) => {
    const params = new URLSearchParams(searchParams);
    if (number === null) params.delete("task");
    else params.set("task", String(number));
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };
}

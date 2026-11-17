"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * 订阅服务端事件（SSE）：项目内数据变化或收到新通知时刷新当前页面。
 * 多个事件在短时间内到达时合并为一次刷新。
 */
export function LiveUpdates() {
  const router = useRouter();
  const projectKey = useParams<{ key?: string }>().key;

  useEffect(() => {
    const url = projectKey ? `/api/events?project=${encodeURIComponent(projectKey)}` : "/api/events";
    const source = new EventSource(url);
    let timer: ReturnType<typeof setTimeout> | undefined;

    source.onmessage = () => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 300);
    };

    return () => {
      clearTimeout(timer);
      source.close();
    };
  }, [projectKey, router]);

  return null;
}

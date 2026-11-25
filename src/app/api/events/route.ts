import type { NextRequest } from "next/server";

import { getCurrentUser } from "@/server/auth/dal";
import { db } from "@/server/db";
import { type LiveEvent, projectChannel, subscribe, userChannel } from "@/server/events";
import { canAccessProject } from "@/server/permissions";

/**
 * 服务端事件流（SSE）：推送当前用户的通知事件，以及当前项目的数据变化事件。
 * 浏览器收到后刷新页面数据，见 components/layout/live-updates.tsx。
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new Response("未登录", { status: 401 });

  // 可选：同时订阅某个项目（按项目编号）
  const projectKey = request.nextUrl.searchParams.get("project");
  let projectId: string | null = null;
  if (projectKey) {
    const project = await db.project.findUnique({ where: { key: projectKey.toUpperCase() }, select: { id: true } });
    if (!project || !(await canAccessProject(user, project.id))) {
      return new Response("无权访问", { status: 403 });
    }
    projectId = project.id;
  }

  if (process.env.NOWX_WORKERS_BUILD === "1") {
    const channel = projectId ? projectChannel(projectId) : userChannel(user.id);
    return new Response(null, { status: 204, headers: { "X-NowX-Channel": channel } });
  }

  const encoder = new TextEncoder();
  const cleanups: (() => void)[] = [];

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: LiveEvent) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));

      cleanups.push(subscribe(userChannel(user.id), send));
      if (projectId) cleanups.push(subscribe(projectChannel(projectId), send));

      // 定期发送注释行保活，避免被代理当作空闲连接断开
      const heartbeat = setInterval(() => controller.enqueue(encoder.encode(": ping\n\n")), 25_000);
      cleanups.push(() => clearInterval(heartbeat));

      request.signal.addEventListener("abort", () => {
        cleanups.forEach((fn) => fn());
        controller.close();
      });
    },
    cancel() {
      cleanups.forEach((fn) => fn());
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

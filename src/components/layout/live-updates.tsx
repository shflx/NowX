import { useEffect } from "react";

import { useParams } from "@/lib/navigation";
import { queryClient } from "@/lib/query";

/**
 * 订阅实时推送（WebSocket）：项目内数据变化或收到新通知时刷新页面数据。
 * 多个事件在短时间内到达时合并为一次刷新；连接断开后自动重连。
 */
export function LiveUpdates() {
  const projectKey = useParams<{ key?: string }>().key;

  useEffect(() => {
    let refreshTimer: ReturnType<typeof setTimeout>;
    const refresh = () => {
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => void queryClient.invalidateQueries(), 300);
    };

    const connect = (project?: string) => {
      const url = new URL("/api/events", location.href);
      url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
      if (project) url.searchParams.set("project", project);
      let socket: WebSocket;
      let reconnectTimer: ReturnType<typeof setTimeout>;

      function open() {
        socket = new WebSocket(url);
        socket.onmessage = refresh;
        socket.onclose = () => {
          reconnectTimer = setTimeout(open, 5000);
        };
      }
      open();

      return () => {
        clearTimeout(reconnectTimer);
        socket.onclose = null;
        socket.close();
      };
    };

    const closeUser = connect();
    const closeProject = projectKey ? connect(projectKey) : undefined;
    return () => {
      closeUser();
      closeProject?.();
      clearTimeout(refreshTimer);
    };
  }, [projectKey]);

  return null;
}

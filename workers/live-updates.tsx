"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

export function LiveUpdates() {
  const router = useRouter();
  const projectKey = useParams<{ key?: string }>().key;

  useEffect(() => {
    let refreshTimer: ReturnType<typeof setTimeout>;
    const refresh = () => {
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => router.refresh(), 300);
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
  }, [projectKey, router]);

  return null;
}

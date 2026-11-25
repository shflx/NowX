import { env, waitUntil } from "cloudflare:workers";

import { projectChannel } from "../src/server/event-channels";
import type { LiveEvents } from "./events";

export { projectChannel, userChannel } from "../src/server/event-channels";
export type { LiveEvent } from "../src/server/event-channels";

export function publish(channel: string) {
  const { LIVE_EVENTS } = env as { LIVE_EVENTS: DurableObjectNamespace<LiveEvents> };
  const notification = LIVE_EVENTS.getByName(channel).broadcast();
  waitUntil(
    notification.catch((error) => {
      console.error("[events] 推送失败", error);
    }),
  );
}

export function publishProjectChange(projectId: string) {
  publish(projectChannel(projectId));
}

export function subscribe(): () => void {
  throw new Error("Workers 实时推送使用 WebSocket");
}

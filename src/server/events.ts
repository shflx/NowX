import { requestContext } from "./context";
import { projectChannel } from "./event-channels";

export { projectChannel, userChannel } from "./event-channels";

/**
 * 通知频道内的在线浏览器刷新数据。每个频道对应一个 LiveEvents Durable Object，
 * 浏览器通过 /api/events 的 WebSocket 订阅；推送在响应之后完成，不阻塞请求。
 */
export function publish(channel: string) {
  const { env, waitUntil } = requestContext();
  waitUntil(
    env.LIVE_EVENTS.getByName(channel)
      .broadcast()
      .catch((error) => {
        console.error("[events] 推送失败", error);
      }),
  );
}

/** 通知项目内所有在线成员刷新数据 */
export function publishProjectChange(projectId: string) {
  publish(projectChannel(projectId));
}

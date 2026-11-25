import "server-only";

import { EventEmitter } from "node:events";

import { type LiveEvent, projectChannel } from "./event-channels";

export { type LiveEvent, projectChannel, userChannel } from "./event-channels";

// 进程内事件总线，用于向浏览器推送「数据已变化」的信号（SSE）。
// 只适用于单实例部署；如需多实例，需要换成 Postgres LISTEN/NOTIFY 或 Redis。

const globalForEvents = globalThis as unknown as { liveEvents?: EventEmitter };
const emitter = globalForEvents.liveEvents ?? new EventEmitter();
emitter.setMaxListeners(0);
globalForEvents.liveEvents = emitter;

export function publish(channel: string, event: LiveEvent) {
  emitter.emit(channel, event);
}

/** 通知项目内所有在线成员刷新数据 */
export function publishProjectChange(projectId: string) {
  publish(projectChannel(projectId), { type: "changed" });
}

export function subscribe(channel: string, listener: (event: LiveEvent) => void) {
  emitter.on(channel, listener);
  return () => {
    emitter.off(channel, listener);
  };
}

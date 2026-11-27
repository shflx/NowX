// Worker 绑定在服务端代码中的最小接口：只声明用到的方法，
// 使 src/server 不依赖 Workers 运行时类型，也能在 Node 中测试。
// 入口（workers/entry.ts）把真实的 env 传入，由类型检查保证与 Durable Object 的实现一致。

type Stub<T> = { getByName(name: string): T };

export interface Bindings {
  HYPERDRIVE: { connectionString: string };
  /** 实时推送频道（每个频道一个 LiveEvents） */
  LIVE_EVENTS: Stub<{ broadcast(): Promise<void> }>;
  RATE_LIMIT: Stub<{
    hit(limit: number, windowMs: number): Promise<boolean>;
    isLimited(limit: number): Promise<boolean>;
    reset(): Promise<void>;
  }>;
  PASSWORD_HASH: Stub<{
    hash(password: string): Promise<string>;
    verify(passwordHash: string, password: string): Promise<boolean>;
  }>;
  ATTACHMENTS: {
    put(key: string, value: ReadableStream): Promise<unknown>;
    get(key: string): Promise<{ size: number; body: ReadableStream } | null>;
    delete(key: string): Promise<void>;
  };
  /** 执行 MCP 与项目助手（见 workers/agent-runner.ts） */
  AGENT_RUNNER: Stub<{ fetch(request: Request): Promise<Response>; replyToTopic(topicId: string): Promise<void> }>;
  ATTACHMENT_QUOTA: Stub<{
    reserve(key: string, size: number): Promise<"ok" | "capacity" | "daily">;
    allowRead(): Promise<boolean>;
    release(key: string): Promise<void>;
  }>;
}

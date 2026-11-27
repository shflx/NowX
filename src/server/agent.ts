import type { Bindings } from "./bindings";

/** AgentRunner 实例数：请求随机分散到这些实例上，避免同一实例排队 */
const INSTANCES = 8;

/** 选一个 AgentRunner 实例执行 MCP 或项目助手 */
export function agentRunner(env: Pick<Bindings, "AGENT_RUNNER">) {
  return env.AGENT_RUNNER.getByName(`agent-${Math.floor(Math.random() * INSTANCES)}`);
}

// 站内页面地址：统一在这里拼接路径与查询参数（前后端共用，也用于通知、动态和助手返回的链接）

const projectBase = (key: string) => `/projects/${key}`;

export const routes = {
  project: projectBase,

  tasks: (key: string) => `${projectBase(key)}/tasks`,
  /**
   * 打开任务详情。allCycles 让背后的任务列表展示全部周期，
   * 用于从其他页面跳转、任务可能不在进行中周期的场景
   */
  task: (key: string, number: number, { allCycles = false } = {}) =>
    `${projectBase(key)}/tasks?task=${number}${allCycles ? "&cycle=all" : ""}`,

  cycles: (key: string) => `${projectBase(key)}/cycles`,
  cycle: (key: string, cycleId: string) => `${projectBase(key)}/cycles?cycle=${cycleId}`,

  requirements: (key: string) => `${projectBase(key)}/requirements`,
  requirement: (key: string, number: number) => `${projectBase(key)}/requirements/${number}`,

  discussions: (key: string) => `${projectBase(key)}/discussions`,
  topic: (key: string, topicId: string) => `${projectBase(key)}/discussions/${topicId}`,

  materials: (key: string) => `${projectBase(key)}/materials`,
  announcements: (key: string) => `${projectBase(key)}/announcements`,
  settings: (key: string) => `${projectBase(key)}/settings`,
  search: (key: string, q: string) => `${projectBase(key)}/search?q=${encodeURIComponent(q)}`,
};

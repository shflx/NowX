// 任务相关客户端组件共用的数据形状（由服务端组件序列化后传入）

export type MemberLite = { id: string; name: string; color: string };

export type CycleLite = { id: string; name: string; status: "PLANNED" | "ACTIVE" | "ENDED"; startDate: string; endDate: string };

export type RequirementLite = {
  id: string;
  number: number;
  title: string;
  /** 需求的计划交付周期 */
  cycleId?: string | null;
};

export type TaskFormOptions = {
  projectId: string;
  projectKey: string;
  members: MemberLite[];
  cycles: CycleLite[];
  requirements: RequirementLite[];
};

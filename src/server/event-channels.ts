export type LiveEvent = { type: "changed" } | { type: "notification" };

export const projectChannel = (projectId: string) => `project:${projectId}`;
export const userChannel = (userId: string) => `user:${userId}`;

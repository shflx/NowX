// 实时推送的频道名：项目内数据变化推送到项目频道，个人通知推送到用户频道

export const projectChannel = (projectId: string) => `project:${projectId}`;
export const userChannel = (userId: string) => `user:${userId}`;

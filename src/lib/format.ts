// 业务编号与文件大小等展示格式

export const taskCode = (projectKey: string, number: number) => `${projectKey}-${number}`;

export const requirementCode = (number: number) => `R-${number}`;

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

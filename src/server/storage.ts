import { AttachmentLimitError } from "@/lib/attachment-limit";

import { requestContext } from "./context";

// 附件存储在 R2。全团队共用一个 AttachmentQuota 实例，控制总容量与每日读写次数。

function bindings() {
  const { ATTACHMENTS, ATTACHMENT_QUOTA } = requestContext().env;
  return { bucket: ATTACHMENTS, quota: ATTACHMENT_QUOTA.getByName("nowx-team") };
}

export async function saveFile(file: Blob) {
  const { bucket, quota } = bindings();
  const key = "files/" + crypto.randomUUID();
  const result = await quota.reserve(key, file.size);
  if (result === "capacity") throw new AttachmentLimitError("团队附件容量已达 8 GB，请先删除不需要的附件", 507);
  if (result === "daily") throw new AttachmentLimitError("今天的附件上传次数已用完，北京时间次日 08:00 恢复", 429);
  try {
    await bucket.put(key, file.stream());
  } catch (error) {
    // 写入结果不确定时先确认对象已删除，再释放预留，避免低估占用。
    await deleteFile(key);
    throw error;
  }
  return key;
}

export async function openFile(key: string) {
  const { bucket, quota } = bindings();
  if (!(await quota.allowRead())) {
    throw new AttachmentLimitError("今天的附件读取次数已用完，北京时间次日 08:00 恢复", 429);
  }
  const object = await bucket.get(key);
  if (!object) throw new Error("附件不存在");
  return { size: object.size, stream: object.body };
}

export async function deleteFile(key: string) {
  const { bucket, quota } = bindings();
  await bucket.delete(key);
  await quota.release(key);
}

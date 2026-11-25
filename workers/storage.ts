import { env } from "cloudflare:workers";
import { AttachmentLimitError } from "../src/lib/attachment-limit";
import type { AttachmentQuota } from "./attachment-quota";

const { ATTACHMENTS, ATTACHMENT_QUOTA } = env as {
  ATTACHMENTS: R2Bucket;
  ATTACHMENT_QUOTA: DurableObjectNamespace<AttachmentQuota>;
};

function quota() {
  return ATTACHMENT_QUOTA.getByName("nowx-team");
}

export async function saveFile(file: Blob, _originalName: string) {
  const key = "files/" + crypto.randomUUID();
  const result = await quota().reserve(key, file.size);
  if (result === "capacity") throw new AttachmentLimitError("团队附件容量已达 8 GB，请先删除不需要的附件", 507);
  if (result === "daily") throw new AttachmentLimitError("今天的附件上传次数已用完，北京时间次日 08:00 恢复", 429);
  try {
    await ATTACHMENTS.put(key, file.stream());
  } catch (error) {
    // 写入结果不确定时先确认对象已删除，再释放预留，避免低估占用。
    await deleteFile(key);
    throw error;
  }
  return key;
}

export async function openFile(key: string) {
  if (!(await quota().allowRead())) {
    throw new AttachmentLimitError("今天的附件读取次数已用完，北京时间次日 08:00 恢复", 429);
  }
  const object = await ATTACHMENTS.get(key);
  if (!object) throw new Error("附件不存在");
  return { size: object.size, stream: object.body };
}

export async function deleteFile(key: string) {
  await ATTACHMENTS.delete(key);
  await quota().release(key);
}

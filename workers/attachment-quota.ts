import { DurableObject } from "cloudflare:workers";

const MAX_BYTES = 8_000_000_000;
const DAILY_READS = 50_000;
const DAILY_UPLOADS = 5_000;

// 全团队共用一个实例。同步事务确保两次并发上传不能同时占用最后一份剩余容量。
export class AttachmentQuota extends DurableObject {
  private consume(kind: "read" | "upload", limit: number) {
    const kv = this.ctx.storage.kv;
    const day = Math.floor(Date.now() / 86_400_000);
    const previous = kv.get<{ day: number; count: number }>(kind);
    const count = previous?.day === day ? previous.count : 0;
    if (count >= limit) return false;
    kv.put(kind, { day, count: count + 1 });
    return true;
  }

  allowRead() {
    return this.ctx.storage.transactionSync(() => this.consume("read", DAILY_READS));
  }

  reserve(key: string, size: number): "ok" | "capacity" | "daily" {
    if (!Number.isSafeInteger(size) || size <= 0) throw new Error("无效的附件大小");
    const kv = this.ctx.storage.kv;
    return this.ctx.storage.transactionSync(() => {
      const used = kv.get<number>("bytes") ?? 0;
      if (used + size > MAX_BYTES) return "capacity";
      if (kv.get(key) !== undefined) throw new Error("重复的附件标识");
      if (!this.consume("upload", DAILY_UPLOADS)) return "daily";
      kv.put(key, size);
      kv.put("bytes", used + size);
      return "ok";
    });
  }

  release(key: string) {
    const kv = this.ctx.storage.kv;
    this.ctx.storage.transactionSync(() => {
      const size = kv.get<number>(key);
      if (size === undefined) return;
      kv.put("bytes", kv.get<number>("bytes")! - size);
      kv.delete(key);
    });
  }
}

import { DurableObject } from "cloudflare:workers";

type Bucket = { count: number; resetAt: number };

export class RateLimit extends DurableObject {
  async hit(limit: number, windowMs: number) {
    const now = Date.now();
    const bucket = await this.ctx.storage.get<Bucket>("bucket");
    const next =
      bucket && bucket.resetAt > now
        ? { count: bucket.count + 1, resetAt: bucket.resetAt }
        : { count: 1, resetAt: now + windowMs };
    await this.ctx.storage.put("bucket", next);
    if (!bucket || bucket.resetAt <= now) await this.ctx.storage.setAlarm(next.resetAt);
    return next.count > limit;
  }

  async isLimited(limit: number) {
    const bucket = await this.ctx.storage.get<Bucket>("bucket");
    return Boolean(bucket && bucket.resetAt > Date.now() && bucket.count >= limit);
  }

  async reset() {
    await this.ctx.storage.delete("bucket");
    await this.ctx.storage.deleteAlarm();
  }

  async alarm() {
    const bucket = await this.ctx.storage.get<Bucket>("bucket");
    if (bucket && bucket.resetAt <= Date.now()) await this.ctx.storage.delete("bucket");
  }
}

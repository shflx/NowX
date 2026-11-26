import { type Database, db, type Tx } from "@/server/db";
import { cuid } from "@/server/db/id";

type ActivityInput = {
  projectId: string;
  actorId: string;
  /** 动作描述，如「完成了任务」 */
  verb: string;
  /** 对象描述，如「CRM-22 修复：客户详情页偶发白屏」 */
  target: string;
  href?: string;
};

/** 记录项目动态（工作台「最近动态」的数据来源） */
export async function recordActivity(input: ActivityInput, tx: Database | Tx = db) {
  await tx
    .insertInto("Activity")
    .values({ id: cuid(), ...input })
    .execute();
}

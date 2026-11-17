import { z } from "zod";

export const announcementSchema = z.object({
  title: z.string().trim().min(1, "请填写标题").max(80, "标题不能超过 80 个字"),
  body: z.string().trim().min(1, "请填写内容").max(10000, "内容太长了"),
  pinned: z.boolean().default(false),
});

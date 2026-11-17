import { z } from "zod";

/** 关联对象：task:<id> / req:<id> */
const linkSchema = z
  .string()
  .regex(/^(task|req):.+$/, "关联对象不正确")
  .nullable();

export const topicSchema = z.object({
  title: z.string().trim().min(1, "请填写问题标题").max(100, "标题不能超过 100 个字"),
  body: z.string().trim().min(1, "请补充问题描述").max(10000, "描述太长了"),
  assigneeId: z.string().min(1).nullable(),
  link: linkSchema,
});

export const replySchema = z.object({
  body: z.string().trim().min(1, "回复不能为空").max(10000, "回复太长了"),
  markSolved: z.boolean().default(false),
});

export const TOPIC_FILTERS = ["all", "mine", "asked", "open", "solved", "faq"] as const;
export type TopicFilter = (typeof TOPIC_FILTERS)[number];

export const TOPIC_FILTER_LABEL: Record<TopicFilter, string> = {
  all: "全部",
  mine: "待我回答",
  asked: "我发起的",
  open: "待回答",
  solved: "已解决",
  faq: "FAQ 精选",
};

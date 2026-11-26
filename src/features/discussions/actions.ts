import { action } from "@/lib/action-client";

import type * as mutations from "./mutations";

export const createTopic = action<typeof mutations.createTopic>("discussions.createTopic");
export const replyToTopic = action<typeof mutations.replyToTopic>("discussions.replyToTopic");
export const acceptReply = action<typeof mutations.acceptReply>("discussions.acceptReply");
export const setTopicFaq = action<typeof mutations.setTopicFaq>("discussions.setTopicFaq");
export const setTopicStatus = action<typeof mutations.setTopicStatus>("discussions.setTopicStatus");
export const suggestSimilarTopics = action<typeof mutations.suggestSimilarTopics>("discussions.suggestSimilarTopics", {
  refresh: false,
});
export const getTopicLinkOptions = action<typeof mutations.getTopicLinkOptions>("discussions.getTopicLinkOptions", {
  refresh: false,
});

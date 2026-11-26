import { action } from "@/lib/action-client";

import type * as mutations from "./mutations";

export const markNotificationRead = action<typeof mutations.markNotificationRead>("notifications.markNotificationRead");
export const markAllNotificationsRead = action<typeof mutations.markAllNotificationsRead>(
  "notifications.markAllNotificationsRead",
);

import { action } from "@/lib/action-client";

import type * as mutations from "./mutations";

export const publishAnnouncement = action<typeof mutations.publishAnnouncement>("announcements.publishAnnouncement");
export const updateAnnouncement = action<typeof mutations.updateAnnouncement>("announcements.updateAnnouncement");
export const setAnnouncementPinned = action<typeof mutations.setAnnouncementPinned>("announcements.setAnnouncementPinned");
export const deleteAnnouncement = action<typeof mutations.deleteAnnouncement>("announcements.deleteAnnouncement");

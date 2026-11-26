import { action } from "@/lib/action-client";

import type * as mutations from "./mutations";

export const createProject = action<typeof mutations.createProject>("projects.createProject");
export const updateProject = action<typeof mutations.updateProject>("projects.updateProject");
export const setProjectArchived = action<typeof mutations.setProjectArchived>("projects.setProjectArchived");
export const addProjectMembers = action<typeof mutations.addProjectMembers>("projects.addProjectMembers");
export const removeProjectMember = action<typeof mutations.removeProjectMember>("projects.removeProjectMember");
export const deleteProject = action<typeof mutations.deleteProject>("projects.deleteProject");

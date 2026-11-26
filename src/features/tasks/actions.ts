import { action } from "@/lib/action-client";

import type * as mutations from "./mutations";

export const createTask = action<typeof mutations.createTask>("tasks.createTask");
export const updateTask = action<typeof mutations.updateTask>("tasks.updateTask");
export const blockTask = action<typeof mutations.blockTask>("tasks.blockTask");
export const createSubtask = action<typeof mutations.createSubtask>("tasks.createSubtask");
export const deleteTask = action<typeof mutations.deleteTask>("tasks.deleteTask");
export const addTaskComment = action<typeof mutations.addTaskComment>("tasks.addTaskComment");

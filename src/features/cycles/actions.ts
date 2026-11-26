import { action } from "@/lib/action-client";

import type * as mutations from "./mutations";

export const createCycle = action<typeof mutations.createCycle>("cycles.createCycle");
export const updateCycle = action<typeof mutations.updateCycle>("cycles.updateCycle");
export const startCycle = action<typeof mutations.startCycle>("cycles.startCycle");
export const endCycle = action<typeof mutations.endCycle>("cycles.endCycle");
export const deleteCycle = action<typeof mutations.deleteCycle>("cycles.deleteCycle");

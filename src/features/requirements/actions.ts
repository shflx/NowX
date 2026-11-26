import { action } from "@/lib/action-client";

import type * as mutations from "./mutations";

export const createRequirement = action<typeof mutations.createRequirement>("requirements.createRequirement");
export const updateRequirement = action<typeof mutations.updateRequirement>("requirements.updateRequirement");
export const deleteRequirement = action<typeof mutations.deleteRequirement>("requirements.deleteRequirement");
export const moveRequirement = action<typeof mutations.moveRequirement>("requirements.moveRequirement");
export const setRequirementStatus = action<typeof mutations.setRequirementStatus>("requirements.setRequirementStatus");

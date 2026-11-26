import { action } from "@/lib/action-client";

import type * as mutations from "./mutations";

export type { Credentials } from "./mutations";

export const createAccount = action<typeof mutations.createAccount>("accounts.createAccount");
export const updateAccount = action<typeof mutations.updateAccount>("accounts.updateAccount");
export const resetAccountPassword = action<typeof mutations.resetAccountPassword>("accounts.resetAccountPassword");
export const setAccountStatus = action<typeof mutations.setAccountStatus>("accounts.setAccountStatus");
export const deleteAccount = action<typeof mutations.deleteAccount>("accounts.deleteAccount");

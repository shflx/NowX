import { action } from "@/lib/action-client";

import type * as mutations from "./mutations";

export const createMyAccessToken = action<typeof mutations.createMyAccessToken>("accessTokens.createMyAccessToken");
export const revokeMyAccessToken = action<typeof mutations.revokeMyAccessToken>("accessTokens.revokeMyAccessToken");

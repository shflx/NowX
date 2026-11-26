import { StatusBadge, type Tone } from "@/components/shared/status-badge";
import { REQUIREMENT_STATUS_LABEL } from "@/lib/constants";
import type { RequirementStatus } from "@/lib/enums";

const TONE: Record<RequirementStatus, Tone> = { BACKLOG: "neutral", DESIGN: "warn", DEVELOPING: "accent", DELIVERED: "ok" };

export function RequirementStatusBadge({ status }: { status: RequirementStatus }) {
  return <StatusBadge tone={TONE[status]}>{REQUIREMENT_STATUS_LABEL[status]}</StatusBadge>;
}

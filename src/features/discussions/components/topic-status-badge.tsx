import { StatusBadge, type Tone } from "@/components/shared/status-badge";
import type { TopicStatus } from "@/generated/prisma/enums";
import { TOPIC_STATUS_LABEL } from "@/lib/constants";

const TONE: Record<TopicStatus, Tone> = { OPEN: "warn", SOLVED: "ok", CLOSED: "neutral" };

export function TopicStatusBadge({ status }: { status: TopicStatus }) {
  return <StatusBadge tone={TONE[status]}>{TOPIC_STATUS_LABEL[status]}</StatusBadge>;
}

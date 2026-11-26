import { StatusBadge, type Tone } from "@/components/shared/status-badge";
import { TOPIC_STATUS_LABEL } from "@/lib/constants";
import type { TopicStatus } from "@/lib/enums";

const TONE: Record<TopicStatus, Tone> = { OPEN: "warn", SOLVED: "ok", CLOSED: "neutral" };

export function TopicStatusBadge({ status }: { status: TopicStatus }) {
  return <StatusBadge tone={TONE[status]}>{TOPIC_STATUS_LABEL[status]}</StatusBadge>;
}

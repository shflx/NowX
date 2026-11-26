import { SparklesIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAssistant } from "@/features/assistant/components/assistant-provider";

/** 搜索结果页：把搜索词直接交给项目助手 */
export function AskAssistantButton({ question, projectKey }: { question: string; projectKey: string }) {
  const { ask } = useAssistant();
  return (
    <Button variant="outline" onClick={() => ask(question, projectKey)}>
      <SparklesIcon />
      问问项目助手
    </Button>
  );
}

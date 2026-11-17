"use client";

import { createContext, type ReactNode, use, useState } from "react";

export type Turn = { role: "user" | "assistant"; content: string };

/** 对话按项目隔离：切换项目后，面板只展示该项目的对话 */
type Conversation = { projectKey: string | undefined; turns: Turn[] };

type AssistantState = {
  open: boolean;
  setOpen: (open: boolean) => void;
  conversation: Conversation;
  loading: boolean;
  /** 打开面板并提问（面板输入框、搜索页等入口共用） */
  ask: (question: string, projectKey: string | undefined) => void;
  clear: () => void;
};

const AssistantContext = createContext<AssistantState | null>(null);

export function AssistantProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [conversation, setConversation] = useState<Conversation>({ projectKey: undefined, turns: [] });
  const [loading, setLoading] = useState(false);

  async function ask(question: string, projectKey: string | undefined) {
    const q = question.trim();
    if (!q || loading) return;
    setOpen(true);

    const base = conversation.projectKey === projectKey ? conversation.turns : [];
    const history: Turn[] = [...base, { role: "user", content: q }];
    setConversation({ projectKey, turns: history });
    setLoading(true);

    let answer: string;
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // 只带最近 10 轮，控制请求大小
        body: JSON.stringify({ project: projectKey, messages: history.slice(-20) }),
      });
      const data = await res.json().catch(() => ({}));
      answer = res.ok ? data.answer : (data.error ?? "项目助手暂时不可用");
    } catch {
      answer = "网络异常，请稍后重试。";
    }
    setConversation((c) => (c.projectKey === projectKey ? { ...c, turns: [...c.turns, { role: "assistant", content: answer }] } : c));
    setLoading(false);
  }

  const value: AssistantState = {
    open,
    setOpen,
    conversation,
    loading,
    ask: (question, projectKey) => void ask(question, projectKey),
    clear: () => setConversation((c) => ({ ...c, turns: [] })),
  };

  return <AssistantContext value={value}>{children}</AssistantContext>;
}

export function useAssistant() {
  const value = use(AssistantContext);
  if (!value) throw new Error("useAssistant 需要在 AssistantProvider 内使用");
  return value;
}

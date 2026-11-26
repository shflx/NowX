import { ArrowUpIcon, BotIcon, RotateCcwIcon, XIcon } from "lucide-react";
import { type CSSProperties, useEffect, useRef, useState } from "react";

import { Markdown } from "@/components/shared/markdown";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { useParams } from "@/lib/navigation";
import { cn } from "@/lib/utils";

import { useAssistant } from "./assistant-provider";

const SUGGESTIONS = ["我的任务有哪些？", "有逾期的任务吗？", "本期进度怎么样？", "有哪些问题等我回答？", "最近有哪些 FAQ？"];

/** 项目助手对话框：在当前项目范围内只读地回答问题；位置由悬浮入口计算后传入 */
export function AssistantPanel({ style }: { style: CSSProperties }) {
  const { setOpen, conversation, loading, ask, clear } = useAssistant();
  const projectKey = useParams<{ key?: string }>().key;
  const [input, setInput] = useState("");
  const bottom = useRef<HTMLDivElement>(null);
  const turns = conversation.projectKey === projectKey ? conversation.turns : [];

  // 新消息出现时滚动到底部（同步 DOM，属于 effect 的正当用途）。
  // 使用语句体：新版浏览器的 scrollIntoView 会返回 Promise，不能作为 effect 的返回值
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns.length, loading]);

  function submit(question: string) {
    ask(question, projectKey);
    setInput("");
  }

  return (
    <section
      role="dialog"
      aria-label="项目助手"
      style={style}
      className="fixed z-50 flex min-w-0 flex-col overflow-hidden rounded-xl border bg-card shadow-2xl"
    >
      <header className="flex items-center gap-2.5 border-b px-4 py-3">
        <UserAvatar user={null} assistant size="lg" />
        <div className="min-w-0 flex-1">
          <div className="font-semibold">项目助手</div>
          <div className="truncate text-xs text-muted-foreground">只读查询当前项目的任务、周期、需求和交流区</div>
        </div>
        <Button variant="ghost" size="icon-sm" aria-label="清空对话" onClick={clear}>
          <RotateCcwIcon />
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label="关闭" onClick={() => setOpen(false)}>
          <XIcon />
        </Button>
      </header>

      <div className="flex flex-1 flex-col gap-3.5 overflow-y-auto bg-muted/30 p-4" aria-live="polite">
        {turns.length === 0 && (
          <div className="flex gap-2">
            <UserAvatar user={null} assistant size="sm" />
            <div className="rounded-xl rounded-tl-sm border bg-card px-3 py-2 text-sm leading-relaxed">
              你好，我可以帮你查任务、周期进度、需求拆解和交流区的情况。试试下面的问题 👇
            </div>
          </div>
        )}
        {turns.map((t, i) =>
          t.role === "user" ? (
            <div key={i} className="ml-auto max-w-[85%] rounded-xl rounded-tr-sm bg-primary px-3 py-2 text-sm text-primary-foreground">
              {t.content}
            </div>
          ) : (
            <div key={i} className="flex gap-2">
              <UserAvatar user={null} assistant size="sm" />
              <div className="min-w-0 flex-1 rounded-xl rounded-tl-sm border bg-card px-3 py-2">
                <Markdown className="text-sm leading-relaxed">{t.content}</Markdown>
              </div>
            </div>
          ),
        )}
        {loading && (
          <div className="flex gap-2">
            <UserAvatar user={null} assistant size="sm" />
            <div className="flex items-center gap-1 rounded-xl rounded-tl-sm border bg-card px-3 py-3" aria-label="正在查询">
              {[0, 1, 2].map((i) => (
                <i key={i} className="size-1.5 animate-pulse rounded-full bg-muted-foreground" style={{ animationDelay: `${i * 150}ms` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottom} />
      </div>

      <footer className="border-t p-3">
        <div className="mb-2.5 flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              disabled={loading}
              onClick={() => submit(s)}
              className="rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground hover:border-input hover:text-foreground disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(input);
          }}
          className={cn("flex items-center gap-2 rounded-full border py-1 pr-1 pl-3.5 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50")}
        >
          <BotIcon className="size-4 text-muted-foreground" />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="问点什么，比如：陈晓手上有哪些任务？"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            aria-label="向项目助手提问"
          />
          <Button type="submit" size="icon-sm" className="rounded-full" disabled={loading || !input.trim()} aria-label="发送">
            <ArrowUpIcon />
          </Button>
        </form>
      </footer>
    </section>
  );
}

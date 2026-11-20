"use client";

import { CheckIcon, StarIcon, StarOffIcon } from "lucide-react";
import { useState } from "react";

import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useAction } from "@/hooks/use-action";
import { ASSISTANT_MENTION } from "@/lib/constants";

import { acceptReply, replyToTopic, setTopicFaq, setTopicStatus } from "../actions";

/** 帖子右上角的管理操作：设为 FAQ、关闭 / 重新打开 */
export function TopicManageActions({ topicId, isFaq, status }: { topicId: string; isFaq: boolean; status: "OPEN" | "SOLVED" | "CLOSED" }) {
  const faq = useAction(setTopicFaq.bind(null, topicId), { successMessage: isFaq ? "已移出 FAQ" : "已加入 FAQ 精选" });
  const toggle = useAction(setTopicStatus.bind(null, topicId), { successMessage: status === "CLOSED" ? "已重新打开" : "帖子已关闭" });
  return (
    <>
      <Button variant="outline" disabled={faq.pending} onClick={() => faq.run(!isFaq)}>
        {isFaq ? <StarOffIcon /> : <StarIcon />}
        {isFaq ? "取消 FAQ" : "设为 FAQ"}
      </Button>
      {status !== "SOLVED" && (
        <Button variant="outline" disabled={toggle.pending} onClick={() => toggle.run(status === "CLOSED" ? "OPEN" : "CLOSED")}>
          {status === "CLOSED" ? "重新打开" : "关闭"}
        </Button>
      )}
    </>
  );
}

export function AcceptReplyButton({ replyId }: { replyId: string }) {
  const accept = useAction(acceptReply, { successMessage: "已采纳，帖子标记为已解决" });
  return (
    <Button variant="ghost" size="sm" disabled={accept.pending} onClick={() => accept.run(replyId)}>
      <CheckIcon />
      采纳为答案
    </Button>
  );
}

type ComposerProps = {
  topicId: string;
  currentUser: { name: string; color: string };
  /** 是否显示「回复后标记为已解决」 */
  canSolve: boolean;
  assistantEnabled: boolean;
};

export function ReplyComposer({ topicId, currentUser, canSolve, assistantEnabled }: ComposerProps) {
  const [body, setBody] = useState("");
  const [solve, setSolve] = useState(false);
  const reply = useAction(replyToTopic.bind(null, topicId), {
    onSuccess: () => {
      setBody("");
      setSolve(false);
    },
  });
  const submit = () => body.trim() && reply.run({ body, markSolved: solve });

  return (
    <div className="flex gap-3">
      <UserAvatar user={currentUser} size="lg" />
      <div className="flex-1 overflow-hidden rounded-lg border bg-card focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.metaKey || e.ctrlKey) && submit()}
          placeholder={assistantEnabled ? `写下你的回答或补充…  输入 ${ASSISTANT_MENTION} 让助手帮忙查找` : "写下你的回答或补充…（⌘ + Enter 发送）"}
          className="min-h-24 resize-y border-0 shadow-none focus-visible:ring-0"
          aria-label="回复内容"
        />
        <div className="flex items-center gap-3 border-t bg-muted/40 px-3 py-1.5">
          <span className="text-xs text-muted-foreground">支持 Markdown，@姓名 提及成员</span>
          {canSolve && (
            <span className="ml-auto flex items-center gap-1.5">
              <Checkbox id="mark-solved" checked={solve} onCheckedChange={(c) => setSolve(c === true)} />
              <Label htmlFor="mark-solved" className="text-xs font-normal text-muted-foreground">
                回复后标记为已解决
              </Label>
            </span>
          )}
          <Button size="sm" className={canSolve ? "" : "ml-auto"} disabled={reply.pending || !body.trim()} onClick={submit}>
            {reply.pending && <Spinner />}
            回复
          </Button>
        </div>
      </div>
    </div>
  );
}

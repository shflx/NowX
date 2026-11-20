"use client";

import { useState } from "react";

import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useAction } from "@/hooks/use-action";

import { blockTask } from "../actions";

/** 标记阻塞：填写卡在哪里、在等谁，原因会作为一条评论保存 */
export function BlockTaskDialog({ task, onClose }: { task: { id: string; code: string }; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const block = useAction(blockTask.bind(null, task.id), { successMessage: `${task.code} 已标记为阻塞`, onSuccess: onClose });

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    block.run({ reason });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>标记 {task.code} 为阻塞</DialogTitle>
          <DialogDescription>说明卡在哪里、在等谁提供什么。原因会作为评论保存，并通知任务负责人；可以 @ 成员。</DialogDescription>
        </DialogHeader>
        <form id="block-task-form" onSubmit={handleSubmit}>
          <FormField label="阻塞原因" htmlFor="block-reason" error={block.fieldErrors.reason}>
            <Textarea
              id="block-reason"
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="例如：等待支付团队提供对账接口的测试数据，预计周三给到"
              autoFocus
            />
          </FormField>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button type="submit" form="block-task-form" disabled={block.pending || !reason.trim()}>
            {block.pending && <Spinner />}
            标记阻塞
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

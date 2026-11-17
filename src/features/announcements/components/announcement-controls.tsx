"use client";

import { PinIcon, PinOffIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";

import { ConfirmButton } from "@/components/shared/confirm-button";
import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useAction } from "@/hooks/use-action";

import { deleteAnnouncement, publishAnnouncement, setAnnouncementPinned } from "../actions";

export function PublishAnnouncementButton({ projectId, canPin }: { projectId: string; canPin: boolean }) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(true);
  const publish = useAction(publishAnnouncement.bind(null, projectId), {
    successMessage: "公告已发布，成员会收到通知",
    onSuccess: () => setOpen(false),
  });

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    publish.run({ title: form.get("title"), body: form.get("body"), pinned: canPin && pinned });
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <PlusIcon />
        发布公告
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>发布公告</DialogTitle>
          </DialogHeader>
          <form id="announcement-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
            <FormField label="标题" htmlFor="ann-title" error={publish.fieldErrors.title}>
              <Input id="ann-title" name="title" placeholder="例如：第 3 期迭代启动" autoFocus />
            </FormField>
            <FormField label="内容" htmlFor="ann-body" error={publish.fieldErrors.body}>
              <Textarea id="ann-body" name="body" rows={7} placeholder="支持 Markdown" />
            </FormField>
            {canPin && (
              <div className="flex items-center gap-2">
                <Checkbox id="ann-pin" checked={pinned} onCheckedChange={(c) => setPinned(c === true)} />
                <Label htmlFor="ann-pin" className="font-normal">
                  置顶（显示在所有成员的工作台）
                </Label>
              </div>
            )}
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button type="submit" form="announcement-form" disabled={publish.pending}>
              {publish.pending && <Spinner />}
              发布
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function AnnouncementActions({ id, pinned, canPin, canDelete }: { id: string; pinned: boolean; canPin: boolean; canDelete: boolean }) {
  const pin = useAction(setAnnouncementPinned.bind(null, id), { successMessage: pinned ? "已取消置顶" : "已置顶" });
  const remove = useAction(deleteAnnouncement, { successMessage: "公告已删除" });
  return (
    <div className="flex items-center">
      {canPin && (
        <Button variant="ghost" size="sm" disabled={pin.pending} onClick={() => pin.run(!pinned)}>
          {pinned ? <PinOffIcon /> : <PinIcon />}
          {pinned ? "取消置顶" : "置顶"}
        </Button>
      )}
      {canDelete && (
        <ConfirmButton
          trigger={
            <Button variant="ghost" size="sm" aria-label="删除公告">
              <Trash2Icon />
            </Button>
          }
          title="删除这条公告？"
          confirmLabel="删除"
          destructive
          onConfirm={() => remove.run(id)}
        />
      )}
    </div>
  );
}

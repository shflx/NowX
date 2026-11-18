"use client";

import { PencilIcon, PinIcon, PinOffIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";

import { ActionMenu } from "@/components/shared/action-menu";
import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useAction } from "@/hooks/use-action";

import { deleteAnnouncement, publishAnnouncement, setAnnouncementPinned, updateAnnouncement } from "../actions";

type AnnouncementData = { id: string; title: string; body: string; pinned: boolean };

type FormProps = {
  projectId: string;
  canPin: boolean;
  /** 传入则为编辑 */
  announcement?: AnnouncementData;
  onClose: () => void;
};

/** 发布 / 编辑公告 */
function AnnouncementFormDialog({ projectId, canPin, announcement, onClose }: FormProps) {
  const editing = Boolean(announcement);
  const [pinned, setPinned] = useState(announcement?.pinned ?? true);
  const publish = useAction(publishAnnouncement.bind(null, projectId), {
    successMessage: "公告已发布，成员会收到通知",
    onSuccess: onClose,
  });
  const update = useAction(updateAnnouncement.bind(null, announcement?.id ?? ""), { successMessage: "公告已更新", onSuccess: onClose });
  const { pending, fieldErrors } = editing ? update : publish;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const input = { title: form.get("title"), body: form.get("body"), pinned: canPin && pinned };
    if (editing) update.run(input);
    else publish.run(input);
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{editing ? "编辑公告" : "发布公告"}</DialogTitle>
        </DialogHeader>
        <form id="announcement-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
          <FormField label="标题" htmlFor="ann-title" error={fieldErrors.title}>
            <Input id="ann-title" name="title" defaultValue={announcement?.title} placeholder="例如：第 3 期迭代启动" autoFocus />
          </FormField>
          <FormField label="内容" htmlFor="ann-body" error={fieldErrors.body}>
            <Textarea id="ann-body" name="body" rows={8} defaultValue={announcement?.body} placeholder="支持 Markdown" />
          </FormField>
          {canPin && (
            <div className="flex items-center gap-2">
              <Checkbox id="ann-pin" checked={pinned} onCheckedChange={(c) => setPinned(c === true)} />
              <Label htmlFor="ann-pin" className="font-normal">
                置顶（显示在所有成员的工作台）
              </Label>
            </div>
          )}
          {editing && <p className="text-xs text-muted-foreground">编辑后不会再次通知成员，公告上会标注「已编辑」。</p>}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button type="submit" form="announcement-form" disabled={pending}>
            {pending && <Spinner />}
            {editing ? "保存" : "发布"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PublishAnnouncementButton({ projectId, canPin }: { projectId: string; canPin: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <PlusIcon />
        发布公告
      </Button>
      {open && <AnnouncementFormDialog projectId={projectId} canPin={canPin} onClose={() => setOpen(false)} />}
    </>
  );
}

type ActionsProps = {
  projectId: string;
  announcement: AnnouncementData;
  canPin: boolean;
  /** 发布人或管理员 */
  canManage: boolean;
};

/** 单条公告的操作：编辑、置顶放在菜单上部，删除放在底部并二次确认 */
export function AnnouncementActions({ projectId, announcement, canPin, canManage }: ActionsProps) {
  const [editing, setEditing] = useState(false);
  const pin = useAction(setAnnouncementPinned.bind(null, announcement.id), { successMessage: announcement.pinned ? "已取消置顶" : "已置顶" });
  const remove = useAction(deleteAnnouncement, { successMessage: "公告已删除" });

  return (
    <>
      <ActionMenu
        label="公告操作"
        items={[
          { label: "编辑", icon: PencilIcon, onSelect: () => setEditing(true), hidden: !canManage },
          {
            label: announcement.pinned ? "取消置顶" : "置顶",
            icon: announcement.pinned ? PinOffIcon : PinIcon,
            onSelect: () => pin.run(!announcement.pinned),
            hidden: !canPin,
          },
          {
            label: "删除公告",
            icon: Trash2Icon,
            destructive: true,
            hidden: !canManage,
            onSelect: () => remove.run(announcement.id),
            confirm: { title: `删除公告「${announcement.title}」？`, description: "删除后无法恢复。", confirmLabel: "删除" },
          },
        ]}
      />
      {editing && <AnnouncementFormDialog projectId={projectId} canPin={canPin} announcement={announcement} onClose={() => setEditing(false)} />}
    </>
  );
}

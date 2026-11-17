"use client";

import { XIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAction } from "@/hooks/use-action";
import { TAG_COLOR_KEYS, TAG_COLORS, type TagColor } from "@/lib/constants";

import { createTag, deleteTag, updateTag } from "../actions";

type Tag = { id: string; name: string; color: string; count: number };

/** 管理标签：改名（失焦或回车提交）、点色块切换颜色、删除、新建 */
export function TagManagerDialog({ projectId, tags, onClose }: { projectId: string; tags: Tag[]; onClose: () => void }) {
  const [name, setName] = useState("");
  const create = useAction(createTag.bind(null, projectId), { successMessage: (t) => `已创建标签「${t.name}」`, onSuccess: () => setName("") });
  const update = useAction(updateTag);
  const remove = useAction(deleteTag, {
    successMessage: ({ name, used }) => `已删除标签「${name}」${used ? `，${used} 个材料已移除该标签` : ""}`,
  });

  const nextColor = (color: string) => TAG_COLOR_KEYS[(TAG_COLOR_KEYS.indexOf(color as TagColor) + 1) % TAG_COLOR_KEYS.length];

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>管理标签</DialogTitle>
          <DialogDescription>标签在项目内共享。点击色块切换颜色，直接修改名称即可重命名。</DialogDescription>
        </DialogHeader>
        <ul className="flex max-h-80 flex-col gap-1.5 overflow-y-auto">
          {tags.map((t) => (
            <li key={t.id} className="grid grid-cols-[22px_minmax(0,1fr)_64px_32px] items-center gap-2.5">
              <button
                type="button"
                aria-label={`切换「${t.name}」的颜色`}
                className="size-4.5 rounded-full transition-transform hover:scale-110"
                style={{ background: TAG_COLORS[t.color as TagColor]?.[1] ?? "#888" }}
                onClick={() => update.run(t.id, { color: nextColor(t.color) })}
              />
              <Input
                defaultValue={t.name}
                maxLength={12}
                aria-label="标签名称"
                onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== t.name && update.run(t.id, { name: e.target.value.trim() })}
                onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
              />
              <span className="text-right text-xs text-muted-foreground tabular-nums">{t.count} 个材料</span>
              <Button variant="ghost" size="icon-sm" aria-label={`删除标签「${t.name}」`} onClick={() => remove.run(t.id)}>
                <XIcon />
              </Button>
            </li>
          ))}
          {tags.length === 0 && <li className="text-sm text-muted-foreground">还没有标签</li>}
        </ul>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) create.run(name.trim());
          }}
        >
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="新标签名称" maxLength={12} className="max-w-64" aria-label="新标签名称" />
          <Button type="submit" variant="outline" disabled={create.pending || !name.trim()}>
            创建标签
          </Button>
        </form>
        <DialogFooter>
          <Button onClick={onClose}>完成</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

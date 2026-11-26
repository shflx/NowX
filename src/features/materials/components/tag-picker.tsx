import { CheckIcon, PlusIcon } from "lucide-react";
import { useState } from "react";

import { tagColors } from "@/components/shared/tag-chip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAction } from "@/hooks/use-action";
import { cn } from "@/lib/utils";

import { createTag } from "../actions";

export type TagLite = { id: string; name: string; color: string };

type Props = {
  projectId: string;
  tags: TagLite[];
  value: string[];
  onChange: (ids: string[]) => void;
};

/** 标签多选：点击切换，也可以当场输入新标签名创建并选中 */
export function TagPicker({ projectId, tags: initial, value, onChange }: Props) {
  const [tags, setTags] = useState(initial);
  const [name, setName] = useState("");
  const create = useAction(createTag.bind(null, projectId), {
    onSuccess: (tag) => {
      setTags((prev) => (prev.some((t) => t.id === tag.id) ? prev : [...prev, tag]));
      if (!value.includes(tag.id)) onChange([...value, tag.id]);
      setName("");
    },
  });

  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  const submit = () => name.trim() && create.run(name.trim());

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap gap-1.5">
        {tags.length === 0 && <span className="text-xs text-muted-foreground">还没有标签，在下方创建一个</span>}
        {tags.map((t) => {
          const on = value.includes(t.id);
          const [bg, fg] = tagColors(t.color);
          return (
            <button
              key={t.id}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(t.id)}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-sm text-muted-foreground transition-colors hover:border-input",
                on && "border-transparent font-medium",
              )}
              style={on ? { background: bg, color: fg } : undefined}
            >
              {on && <CheckIcon className="size-3" />}
              {t.name}
            </button>
          );
        })}
      </div>
      <div className="flex max-w-80 gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="新标签名称，回车创建"
          maxLength={12}
          aria-label="新标签名称"
        />
        <Button type="button" variant="outline" size="sm" className="h-8" disabled={create.pending || !name.trim()} onClick={submit}>
          <PlusIcon />
          创建
        </Button>
      </div>
    </div>
  );
}

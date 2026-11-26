import { UserAvatar } from "@/components/shared/user-avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

type Person = { id: string; name: string; title: string; color: string };

type UserChecklistProps = {
  users: Person[];
  value: string[];
  onChange: (ids: string[]) => void;
  /** 固定勾选、不可取消的人（例如创建者本人） */
  lockedIds?: string[];
};

/** 成员多选：两列卡片式复选框 */
export function UserChecklist({ users, value, onChange, lockedIds = [] }: UserChecklistProps) {
  const toggle = (id: string, checked: boolean) =>
    onChange(checked ? [...new Set([...value, id])] : value.filter((v) => v !== id));

  return (
    <div className="grid max-h-56 grid-cols-2 gap-1.5 overflow-y-auto">
      {users.map((u) => {
        const locked = lockedIds.includes(u.id);
        const checked = locked || value.includes(u.id);
        return (
          <label
            key={u.id}
            className={cn(
              "flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-2 text-sm transition-colors hover:border-input",
              checked && "border-primary/30 bg-accent-soft",
            )}
          >
            <Checkbox checked={checked} disabled={locked} onCheckedChange={(c) => toggle(u.id, c === true)} />
            <UserAvatar user={u} size="sm" />
            <span>{u.name}</span>
            <span className="ml-auto truncate text-xs text-muted-foreground">{u.title}</span>
          </label>
        );
      })}
    </div>
  );
}

import { EllipsisIcon } from "lucide-react";
import { type ComponentType, Fragment, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

import { ConfirmDialog, type ConfirmOptions } from "./confirm-dialog";

export type ActionMenuItem = {
  label: string;
  icon?: ComponentType;
  onSelect: () => void;
  /** 危险操作：统一排在菜单底部、红色显示 */
  destructive?: boolean;
  /** 需要二次确认时提供；危险操作建议都提供 */
  confirm?: Omit<ConfirmOptions, "destructive">;
  disabled?: boolean;
  /** 不可用时的原因，显示在菜单项下方 */
  hint?: string;
  hidden?: boolean;
};

type Props = {
  items: ActionMenuItem[];
  label?: string;
  size?: "icon-sm" | "icon-xs" | "icon";
  className?: string;
};

/**
 * 「⋯」更多操作菜单。删除、移出等危险操作放在这里而不是直接摆按钮，
 * 与常用操作隔开，并在执行前二次确认，避免误触。
 */
export function ActionMenu({ items, label = "更多操作", size = "icon-sm", className }: Props) {
  const [pending, setPending] = useState<ActionMenuItem | null>(null);
  const visible = items.filter((i) => !i.hidden);
  const normal = visible.filter((i) => !i.destructive);
  const danger = visible.filter((i) => i.destructive);
  if (visible.length === 0) return null;

  function select(item: ActionMenuItem) {
    if (item.confirm) setPending(item);
    else item.onSelect();
  }

  const render = (item: ActionMenuItem) => {
    const Icon = item.icon;
    return (
      <DropdownMenuItem
        key={item.label}
        variant={item.destructive ? "destructive" : "default"}
        disabled={item.disabled}
        onSelect={() => select(item)}
        className={cn(item.hint && "flex-wrap")}
      >
        {Icon && <Icon />}
        {item.label}
        {item.hint && <span className="basis-full pl-5.5 text-xs text-muted-foreground">{item.hint}</span>}
      </DropdownMenuItem>
    );
  };

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size={size} aria-label={label} className={className}>
            <EllipsisIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-36">
          {normal.map(render)}
          {normal.length > 0 && danger.length > 0 && <DropdownMenuSeparator />}
          {danger.map((item) => (
            <Fragment key={item.label}>{render(item)}</Fragment>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {pending?.confirm && (
        <ConfirmDialog
          {...pending.confirm}
          destructive={pending.destructive}
          open
          onOpenChange={(open) => !open && setPending(null)}
          onConfirm={() => {
            pending.onSelect();
            setPending(null);
          }}
        />
      )}
    </>
  );
}

"use client";

import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { type ReactNode, useId, useState } from "react";

import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

/** Radix Select 不允许空字符串作为选项值，「无」统一用该哨兵值表示 */
export const NONE = "__none__";

export type Option = {
  value: string;
  /** 用于无障碍与搜索的纯文本 */
  label: string;
  /** 富文本展示（头像、状态图标等），缺省时显示 label */
  render?: ReactNode;
};

type BaseProps = {
  options: Option[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** 提供 name 时可直接参与表单提交 */
  name?: string;
  placeholder?: string;
  className?: string;
  size?: "sm" | "default";
  disabled?: boolean;
  id?: string;
  "aria-label"?: string;
};

/** 普通下拉选择（选项较少时使用） */
export function OptionSelect({ options, placeholder = "请选择", className, size, ...props }: BaseProps) {
  return (
    <Select {...props}>
      <SelectTrigger id={props.id} size={size} className={cn("min-w-0 max-w-full", className)} aria-label={props["aria-label"]}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent position="popper">
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.render ?? o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** 可搜索的下拉选择（关联任务 / 需求等长列表使用） */
export function SearchSelect({
  options,
  value: controlled,
  defaultValue,
  onValueChange,
  name,
  placeholder = "请选择",
  className,
  disabled,
  id,
  ...rest
}: BaseProps) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const [inner, setInner] = useState(defaultValue ?? "");
  const value = controlled ?? inner;
  const current = options.find((o) => o.value === value);

  function select(next: string) {
    setInner(next);
    onValueChange?.(next);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {name && <input type="hidden" name={name} value={value} />}
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-label={rest["aria-label"]}
          disabled={disabled}
          className={cn(
            "flex h-8 w-full min-w-0 items-center gap-1.5 rounded-lg border border-input bg-transparent pr-2 pl-2.5 text-left text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50",
            className,
          )}
        >
          <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate">
            {current ? (current.render ?? current.label) : <span className="text-muted-foreground">{placeholder}</span>}
          </span>
          <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent id={listId} className="w-(--radix-popover-trigger-width) min-w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder="搜索…" />
          <CommandList>
            <CommandEmpty>没有匹配的选项</CommandEmpty>
            {options.map((o) => (
              <CommandItem key={o.value} value={`${o.label} ${o.value}`} onSelect={() => select(o.value)}>
                <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate">{o.render ?? o.label}</span>
                <CheckIcon className={cn("ml-auto", o.value === value ? "opacity-100" : "opacity-0")} />
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

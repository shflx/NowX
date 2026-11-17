import { BotIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type UserAvatarProps = {
  user: { name: string; color: string } | null;
  size?: "sm" | "md" | "lg";
  /** 项目助手的头像 */
  assistant?: boolean;
  className?: string;
};

const SIZES = {
  sm: "size-5 text-[9px]",
  md: "size-6 text-[10px]",
  lg: "size-8 text-xs",
};

/** 圆形头像：取姓名后两个字（小尺寸取一个字），底色为账号颜色 */
export function UserAvatar({ user, size = "md", assistant, className }: UserAvatarProps) {
  const base = cn(
    "inline-grid shrink-0 place-items-center rounded-full font-semibold tracking-tighter text-white ring-2 ring-card",
    SIZES[size],
    className,
  );

  if (assistant) {
    return (
      <span className={cn(base, "bg-gradient-to-br from-indigo-500 to-sky-500")} title="项目助手">
        <BotIcon className="size-3/5" />
      </span>
    );
  }

  const name = user?.name ?? "?";
  return (
    <span className={base} style={{ background: user?.color ?? "#a3a19a" }} title={name}>
      {name.slice(size === "sm" ? -1 : -2)}
    </span>
  );
}

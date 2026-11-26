import { LayoutGridIcon, ListIcon, SearchIcon, UsersIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { memberOptions } from "@/components/shared/option-renderers";
import { OptionSelect } from "@/components/shared/option-select";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { CYCLE_STATUS_LABEL } from "@/lib/constants";
import { usePathname, useRouter, useSearchParams } from "@/lib/navigation";

import type { CycleLite, MemberLite } from "./types";

type Props = {
  cycles: CycleLite[];
  members: MemberLite[];
  currentUser: MemberLite;
  value: { cycle: string; assignee: string; q: string };
  summary: string;
};

/** 任务筛选：周期、负责人、关键字，全部同步到 URL，便于分享和刷新 */
export function TaskFilters({ cycles, members, currentUser, value, summary }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(value.q);

  function update(patch: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams);
    for (const [k, v] of Object.entries(patch)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    router.replace(`${pathname}?${params}`, { scroll: false });
  }

  // 输入关键字后稍作停顿再筛选，避免每个字都请求一次
  useEffect(() => {
    if (q === value.q) return;
    const timer = setTimeout(() => update({ q: q.trim() || null }), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <OptionSelect
        aria-label="按周期筛选"
        value={value.cycle}
        onValueChange={(cycle) => update({ cycle })}
        options={[
          ...cycles.map((c) => ({ value: c.id, label: `${c.name}（${CYCLE_STATUS_LABEL[c.status]}）` })),
          { value: "backlog", label: "待规划" },
          { value: "all", label: "全部周期" },
        ]}
      />
      <OptionSelect
        aria-label="按负责人筛选"
        value={value.assignee}
        onValueChange={(assignee) => update({ assignee: assignee === "all" ? null : assignee })}
        options={[
          { value: "all", label: "全部成员", render: <><UsersIcon className="size-4" />全部成员</> },
          { value: "me", label: "只看我的", render: <><UserAvatar user={currentUser} size="sm" />只看我的</> },
          ...memberOptions(members),
        ]}
      />
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute top-2 left-2.5 size-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="按编号或标题筛选" className="w-56 pl-8" aria-label="按编号或标题筛选" />
      </div>
      <span className="ml-auto text-xs text-muted-foreground">{summary}</span>
    </div>
  );
}

/** 看板 / 列表视图切换 */
export function TaskViewToggle({ view }: { view: "board" | "list" }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <ToggleGroup
      type="single"
      variant="outline"
      value={view}
      onValueChange={(v) => {
        if (!v) return;
        const params = new URLSearchParams(searchParams);
        if (v === "board") params.delete("view");
        else params.set("view", v);
        router.replace(`${pathname}?${params}`, { scroll: false });
      }}
      aria-label="视图"
    >
      <ToggleGroupItem value="board">
        <LayoutGridIcon />
        看板
      </ToggleGroupItem>
      <ToggleGroupItem value="list">
        <ListIcon />
        列表
      </ToggleGroupItem>
    </ToggleGroup>
  );
}

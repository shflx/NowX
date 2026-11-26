import { BellIcon } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { markAllNotificationsRead, markNotificationRead } from "@/features/notifications/actions";
import { useRouter } from "@/lib/navigation";
import { cn } from "@/lib/utils";

export type BellNotification = { id: string; text: string; href: string; read: boolean; time: string };

export function NotificationBell({ items, unread }: { items: BellNotification[]; unread: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  function openItem(item: BellNotification) {
    setOpen(false);
    if (!item.read) void markNotificationRead(item.id);
    router.push(item.href);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={unread ? `通知，${unread} 条未读` : "通知"}>
          <BellIcon />
          {unread > 0 && <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-destructive ring-2 ring-card" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-90 p-1.5">
        <div className="flex items-center justify-between px-2.5 py-1.5">
          <b className="text-sm">通知</b>
          {unread > 0 && (
            <button className="text-xs text-accent-text hover:underline" onClick={() => markAllNotificationsRead()}>
              全部已读
            </button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">暂无通知</div>}
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => openItem(item)}
              className={cn(
                "flex w-full gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-muted",
                !item.read && "bg-accent-soft/60",
              )}
            >
              <span className="flex-1">
                <span className="block">{item.text}</span>
                <span className="text-xs text-muted-foreground">{item.time}</span>
              </span>
              {!item.read && <Badge className="bg-accent-soft text-accent-text">新</Badge>}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

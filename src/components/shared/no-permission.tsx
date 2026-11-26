import { ShieldAlertIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Link } from "@/lib/navigation";

/** 无权访问提示（成员直接访问管理页面时展示） */
export function NoPermission({ feature }: { feature: string }) {
  return (
    <Empty className="mt-10 border bg-card">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <ShieldAlertIcon />
        </EmptyMedia>
        <EmptyTitle>没有访问权限</EmptyTitle>
        <EmptyDescription>只有管理员可以访问「{feature}」</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild variant="outline">
          <Link href="/">回到工作台</Link>
        </Button>
      </EmptyContent>
    </Empty>
  );
}

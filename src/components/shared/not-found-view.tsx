import { FileQuestionIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Link } from "@/lib/navigation";

/** 404：页面不存在，或无权访问（无权访问的项目同样按不存在处理） */
export function NotFoundView() {
  return (
    <Empty className="mt-10 border bg-card">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FileQuestionIcon />
        </EmptyMedia>
        <EmptyTitle>页面不存在或无权访问</EmptyTitle>
        <EmptyDescription>链接可能已失效，或者你还没有加入对应的项目。</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild variant="outline">
          <Link href="/">回到工作台</Link>
        </Button>
      </EmptyContent>
    </Empty>
  );
}

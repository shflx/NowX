import { PageSkeleton } from "@/components/shared/page-skeleton";

// 每个页面目录都放一个 loading 边界：客户端导航时只有本段重新渲染，父级的边界不会生效
export default function Loading() {
  return <PageSkeleton />;
}

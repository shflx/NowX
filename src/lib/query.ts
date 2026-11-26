import { QueryClient, useSuspenseQuery } from "@tanstack/react-query";

import { apiGet } from "./api";

// 页面数据都来自 /api，按请求路径缓存。数据变更或收到实时推送后整体失效，重新获取。
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false },
  },
});

/** 读取页面数据；加载中由外层 Suspense 展示骨架屏 */
export function useApi<T>(path: string) {
  return useSuspenseQuery({ queryKey: [path], queryFn: () => apiGet<T>(path) }).data;
}

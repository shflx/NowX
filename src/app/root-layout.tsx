import { QueryClientProvider } from "@tanstack/react-query";
import { Suspense } from "react";
import { Outlet } from "react-router";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { queryClient } from "@/lib/query";

export function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={300}>
        {/* 登录、改密等独立页面按需加载；工作区页面在外壳内另有骨架屏 */}
        <Suspense>
          <Outlet />
        </Suspense>
      </TooltipProvider>
      <Toaster position="bottom-center" />
    </QueryClientProvider>
  );
}

import { type NextRequest, NextResponse } from "next/server";

import { LAST_PROJECT_COOKIE, SESSION_COOKIE } from "@/lib/cookies";

// 乐观检查：只看 Cookie 是否存在，用于尽早把未登录用户导向登录页。
// 真正的会话校验与权限判断在服务端数据访问层完成（见 src/server/auth/dal.ts）。

const PUBLIC_PATHS = ["/login"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // 仅远程 MCP 入口由 Route Handler 检查 Bearer 令牌。
  if (pathname === "/api/mcp") return NextResponse.next();

  const hasSession = request.cookies.has(SESSION_COOKIE);

  if (!hasSession && !PUBLIC_PATHS.includes(pathname)) {
    // 接口请求直接返回 401，页面请求跳转登录页
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const response = NextResponse.next();

  const projectKey = pathname.match(/^\/projects\/([A-Za-z]+)(\/|$)/)?.[1];
  if (projectKey) {
    response.cookies.set(LAST_PROJECT_COOKIE, projectKey.toUpperCase(), {
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  return response;
}

export const config = {
  // 排除静态资源与图片优化路径
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};

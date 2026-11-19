import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

import { findValidPersonalAccessToken, recordPersonalAccessTokenUse } from "@/server/auth/personal-access-token";
import { appConfig } from "@/server/config";
import { createMcpServer } from "@/server/mcp/tools";
import { hitLimit } from "@/server/rate-limit";

const WINDOW_SECONDS = 60;
const REQUEST_LIMIT = 120;

function mcpError(status: number, message: string, headers?: Record<string, string>) {
  return Response.json(
    { jsonrpc: "2.0", id: null, error: { code: -32000, message } },
    { status, headers: { "Cache-Control": "no-store", ...headers } },
  );
}

function invalidToken() {
  return mcpError(401, "访问令牌无效或缺失", { "WWW-Authenticate": 'Bearer realm="NowX MCP"' });
}

async function handleMcp(request: Request) {
  // MCP 客户端可省略 Origin。浏览器传入 Origin 时，只接受配置的站点来源。
  const origin = request.headers.get("origin");
  if (origin !== null && origin !== new URL(appConfig.appUrl).origin) return mcpError(403, "不允许的请求来源");

  const token = await findValidPersonalAccessToken(request.headers.get("authorization"));
  if (!token) return invalidToken();

  // 无状态端点仅处理 POST，不提供独立的 SSE 监听或会话结束操作。
  if (request.method !== "POST") return mcpError(405, "仅支持 POST", { Allow: "POST" });
  if (hitLimit(`mcp:${token.userId}`, REQUEST_LIMIT, WINDOW_SECONDS * 1000)) {
    return mcpError(429, "请求过于频繁，请稍后再试", { "Retry-After": String(WINDOW_SECONDS) });
  }

  const user = await recordPersonalAccessTokenUse(token.id);
  if (!user) return invalidToken();

  const transport = new WebStandardStreamableHTTPServerTransport({ enableJsonResponse: true, maxRequestBodySize: 64 * 1024 });
  const server = createMcpServer(user);
  try {
    await server.connect(transport);
    const response = await transport.handleRequest(request);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } finally {
    await server.close();
  }
}

export { handleMcp as POST, handleMcp as GET, handleMcp as DELETE };

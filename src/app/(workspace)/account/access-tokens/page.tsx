import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { listMyAccessTokens } from "@/features/access-tokens/actions";
import { AccessTokenManager } from "@/features/access-tokens/components/access-token-manager";
import { McpConfig } from "@/features/access-tokens/components/mcp-config";
import { appConfig } from "@/server/config";

export const metadata: Metadata = { title: "个人访问令牌" };

export default async function AccessTokensPage() {
  const tokens = await listMyAccessTokens();
  const mcpUrl = `${appConfig.appUrl}/api/mcp`;

  return (
    <>
      <PageHeader title="个人访问令牌" description="让外部 Agent 以你的权限查看未归档项目及其周期，并查看、新建和修改需求与任务。令牌有效期为 90 天。" />
      <SectionCard title="MCP 接入" className="mb-4">
        <p className="text-muted-foreground mb-2 text-sm">
          将以下配置粘贴到 MCP 客户端，并把 &lt;token&gt; 替换为令牌；创建令牌时也可直接复制已填好令牌的配置。
        </p>
        <McpConfig url={mcpUrl} />
      </SectionCard>
      <AccessTokenManager tokens={tokens} mcpUrl={mcpUrl} timeZone={appConfig.timeZone} />
    </>
  );
}

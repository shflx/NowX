import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { listMyAccessTokens } from "@/features/access-tokens/actions";
import { AccessTokenManager } from "@/features/access-tokens/components/access-token-manager";
import { appConfig } from "@/server/config";

export const metadata: Metadata = { title: "个人访问令牌" };

export default async function AccessTokensPage() {
  const tokens = await listMyAccessTokens();

  return (
    <>
      <PageHeader title="个人访问令牌" description="让外部 Agent 以你的权限读取未归档项目的任务和需求。令牌有效期为 90 天。" />
      <SectionCard title="MCP 接入" className="mb-4">
        <p className="text-muted-foreground mb-2 text-sm">在 MCP 客户端选择 Streamable HTTP，然后填写以下地址和请求头。</p>
        <pre className="bg-muted overflow-x-auto rounded-md px-3 py-2 text-xs">
          {`${appConfig.appUrl}/api/mcp\nAuthorization: Bearer <token>`}
        </pre>
      </SectionCard>
      <AccessTokenManager tokens={tokens} timeZone={appConfig.timeZone} />
    </>
  );
}

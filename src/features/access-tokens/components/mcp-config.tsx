"use client";

import { CopyIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

// 写入客户端配置的服务名
const SERVER_NAME = "nowx";

type Props = {
  /** MCP 端点地址 */
  url: string;
  /** 令牌明文；未提供时以 <token> 占位，由用户自行替换 */
  token?: string;
};

/** 生成通用的 mcpServers JSON 配置，可直接粘贴到 MCP 客户端 */
export function McpConfig({ url, token = "<token>" }: Props) {
  const content = JSON.stringify(
    { mcpServers: { [SERVER_NAME]: { type: "http", url, headers: { Authorization: `Bearer ${token}` } } } },
    null,
    2,
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(content);
      toast.success("已复制配置");
    } catch {
      toast.error("复制失败，请手动复制");
    }
  }

  return (
    <div className="relative min-w-0">
      <pre className="bg-muted overflow-x-auto rounded-md px-3 py-2 text-xs">{content}</pre>
      <Button variant="ghost" size="sm" className="absolute top-1 right-1" onClick={copy}>
        <CopyIcon />
        复制
      </Button>
    </div>
  );
}

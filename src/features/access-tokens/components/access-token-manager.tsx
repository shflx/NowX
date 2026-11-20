"use client";

import { CopyIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmButton } from "@/components/shared/confirm-button";
import { FormField } from "@/components/shared/form-field";
import { SectionCard } from "@/components/shared/section-card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAction } from "@/hooks/use-action";
import { formatDateTime } from "@/lib/dates";

import { createMyAccessToken, type listMyAccessTokens, revokeMyAccessToken } from "../actions";
import { McpConfig } from "./mcp-config";

type Props = { tokens: Awaited<ReturnType<typeof listMyAccessTokens>>; mcpUrl: string; timeZone: string };

export function AccessTokenManager({ tokens, mcpUrl, timeZone }: Props) {
  const [name, setName] = useState("");
  const [secret, setSecret] = useState<string | null>(null);
  const create = useAction(createMyAccessToken, {
    onSuccess: ({ token }) => {
      setName("");
      setSecret(token);
    },
  });
  const revoke = useAction(revokeMyAccessToken, { successMessage: "令牌已吊销" });

  async function copyToken() {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret);
      toast.success("已复制令牌");
    } catch {
      toast.error("复制失败，请手动复制");
    }
  }

  return (
    <>
      <SectionCard title="我的令牌">
        <form
          className="mb-4 flex flex-wrap items-start gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void create.run({ name });
          }}
        >
          <FormField label="令牌名称" htmlFor="access-token-name" error={create.fieldErrors.name} className="max-w-xs">
            <Input
              id="access-token-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={80}
              required
            />
          </FormField>
          <Button type="submit" className="mt-6" disabled={create.pending}>
            创建令牌
          </Button>
        </form>
        {tokens.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>名称</TableHead>
                <TableHead>前缀</TableHead>
                <TableHead>到期时间</TableHead>
                <TableHead>最近使用</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tokens.map((token) => (
                <TableRow key={token.id}>
                  <TableCell>
                    <span className="block max-w-64 whitespace-normal wrap-anywhere">{token.name}</span>
                  </TableCell>
                  <TableCell className="font-mono">{token.prefix}…</TableCell>
                  <TableCell>{formatDateTime(token.expiresAt, timeZone)}</TableCell>
                  <TableCell>{token.lastUsedAt ? formatDateTime(token.lastUsedAt, timeZone) : "从未使用"}</TableCell>
                  <TableCell>{token.revokedAt ? "已吊销" : token.expired ? "已过期" : "有效"}</TableCell>
                  <TableCell>
                    {!token.revokedAt && (
                      <ConfirmButton
                        trigger={
                          <Button variant="ghost" size="sm" disabled={revoke.pending}>
                            吊销
                          </Button>
                        }
                        title={`吊销令牌「${token.name}」？`}
                        description="使用该令牌的 MCP 客户端将无法继续访问。"
                        confirmLabel="确认吊销"
                        destructive
                        onConfirm={() => void revoke.run(token.id)}
                      />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-muted-foreground text-sm">尚无个人访问令牌。</p>
        )}
      </SectionCard>
      <Dialog open={Boolean(secret)} onOpenChange={(open) => !open && setSecret(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>令牌已创建</DialogTitle>
            <DialogDescription>请复制并妥善保管。关闭后无法再次查看明文。</DialogDescription>
          </DialogHeader>
          <code className="bg-muted rounded-md px-3 py-2 text-sm break-all select-all">{secret}</code>
          {/* 明文仅此处可见，直接给出填好令牌的完整配置，免去手动拼接 */}
          {secret && <McpConfig url={mcpUrl} token={secret} />}
          <DialogFooter className="sm:justify-between">
            <Button variant="outline" onClick={copyToken}>
              <CopyIcon />
              复制令牌
            </Button>
            <Button onClick={() => setSecret(null)}>完成</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

import { CopyIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import type { Credentials } from "../actions";

type Props = {
  credentials: (Credentials & { kind: "created" | "reset" }) | null;
  appUrl: string;
  onClose: () => void;
};

/** 展示一次性登录信息，方便管理员复制发给成员 */
export function CredentialsDialog({ credentials, appUrl, onClose }: Props) {
  if (!credentials) return null;
  const created = credentials.kind === "created";
  const rows = [
    ["登录地址", appUrl],
    ["登录名", credentials.login],
    [created ? "初始密码" : "临时密码", credentials.password],
  ];

  async function copy() {
    const text = `NowX 登录信息\n地址：${appUrl}\n登录名：${credentials!.login}\n密码：${credentials!.password}\n首次登录后请修改密码。`;
    try {
      await navigator.clipboard.writeText(text);
      toast.success("已复制登录信息");
    } catch {
      toast.error("复制失败，请手动复制");
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{created ? "账号已创建" : "密码已重置"}</DialogTitle>
          <DialogDescription>
            请把以下登录信息发给 <b className="text-foreground">{credentials.name}</b>。密码只显示这一次，关闭后无法再次查看。
          </DialogDescription>
        </DialogHeader>
        <dl className="grid grid-cols-[72px_minmax(0,1fr)] gap-y-2 rounded-lg border bg-muted/40 px-4 py-3 text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="font-mono break-all select-all">{value}</dd>
            </div>
          ))}
        </dl>
        <DialogFooter className="sm:justify-between">
          <Button variant="outline" onClick={copy}>
            <CopyIcon />
            复制登录信息
          </Button>
          <Button onClick={onClose}>完成</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

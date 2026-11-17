import { LinkIcon } from "lucide-react";

import type { DocType, MaterialKind } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";

const DOC_BG: Record<DocType, string> = {
  FEISHU: "bg-[#3370ff]",
  TENCENT: "bg-[#1e8fff]",
  FIGMA: "bg-[#1e1e1e]",
  APIFOX: "bg-[#f2551f]",
  OTHER: "bg-[#8b8982]",
};

const EXT_BG: Record<string, string> = {
  PDF: "bg-[#d93a3a]",
  XLSX: "bg-[#138a5e]",
  XLS: "bg-[#138a5e]",
  CSV: "bg-[#138a5e]",
  DOCX: "bg-[#2563eb]",
  DOC: "bg-[#2563eb]",
  PPTX: "bg-[#c2410c]",
  PNG: "bg-[#7c3aed]",
  JPG: "bg-[#7c3aed]",
  JPEG: "bg-[#7c3aed]",
  ZIP: "bg-[#57534e]",
};

/** 材料图标：外链按文档类型着色，文件显示扩展名 */
export function MaterialIcon({ material, small }: { material: { kind: MaterialKind; name: string; docType: DocType | null }; small?: boolean }) {
  const size = small ? "h-5 w-5 rounded text-[8px]" : "h-11 w-9.5 rounded-md text-[10px]";
  if (material.kind === "LINK") {
    return (
      <span className={cn("grid shrink-0 place-items-center text-white", size, DOC_BG[material.docType ?? "OTHER"])}>
        <LinkIcon className={small ? "size-3" : "size-4"} />
      </span>
    );
  }
  const ext = material.name.split(".").pop()?.toUpperCase().slice(0, 4) ?? "FILE";
  return (
    <span className={cn("grid shrink-0 place-items-center font-bold tracking-wide text-white", size, EXT_BG[ext] ?? "bg-[#57534e]")}>
      {small ? ext[0] : ext}
    </span>
  );
}

/** 材料的打开地址：外链直接打开，文件走下载接口（带权限校验） */
export const materialHref = (material: { id: string; kind: MaterialKind; url: string | null }) =>
  material.kind === "LINK" ? (material.url ?? "#") : `/api/materials/${material.id}/download`;

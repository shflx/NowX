import { AttachmentLimitError } from "@/lib/attachment-limit";
import { getCurrentUser } from "@/server/auth/dal";
import { db } from "@/server/db";
import { canAccessProject } from "@/server/permissions";
import { openFile } from "@/server/storage";

/** 下载材料文件：校验项目访问权限后以附件形式返回 */
export async function GET(_request: Request, { params }: RouteContext<"/api/materials/[id]/download">) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return new Response("未登录", { status: 401 });

  const material = await db.material.findUnique({ where: { id } });
  if (!material || material.kind !== "FILE" || !material.storageKey || !(await canAccessProject(user, material.projectId))) {
    return new Response("文件不存在", { status: 404 });
  }

  try {
    const { size, stream } = await openFile(material.storageKey);
    return new Response(stream, {
      headers: {
        "Content-Type": material.mimeType ?? "application/octet-stream",
        "Content-Length": String(size),
        // RFC 5987：用 filename* 传递 UTF-8 文件名，避免中文乱码
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(material.name)}`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof AttachmentLimitError) return new Response(error.message, { status: error.status });
    return new Response("文件已丢失", { status: 410 });
  }
}

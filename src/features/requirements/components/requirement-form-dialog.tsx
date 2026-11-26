import { FileTextIcon, PlusIcon, UploadIcon, XIcon } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { DocTypeIcon } from "@/components/shared/doc-link";
import { FormField } from "@/components/shared/form-field";
import { memberOptions, orNull } from "@/components/shared/option-renderers";
import { NONE, OptionSelect } from "@/components/shared/option-select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { uploadMaterialFile } from "@/features/materials/upload";
import { cycleOptions } from "@/features/tasks/components/task-option-builders";
import type { CycleLite } from "@/features/tasks/components/types";
import { useAction } from "@/hooks/use-action";
import { detectDocType, MAX_UPLOAD_BYTES, REQUIREMENT_STATUS_LABEL } from "@/lib/constants";
import type { DocType, RequirementStatus } from "@/lib/enums";
import { formatFileSize } from "@/lib/format";
import { useRouter } from "@/lib/navigation";
import { routes } from "@/lib/routes";

import { createRequirement, updateRequirement } from "../actions";
import { RequirementStatusBadge } from "./requirement-status-badge";

type Member = { id: string; name: string; color: string };
type EditableRequirement = {
  id: string;
  code: string;
  title: string;
  summary: string;
  status: RequirementStatus;
  ownerId: string | null;
  docs: { type: DocType; name: string; url: string }[];
};

type Props = {
  projectId: string;
  projectKey: string;
  members: Member[];
  /** 编辑时传入 */
  requirement?: EditableRequirement;
  /** 新建时展示的预计编号 */
  nextCode?: string;
  /** 新建时可选的计划交付周期（编辑时通过详情页「调整周期」修改） */
  cycles?: CycleLite[];
  currentUserId: string;
  onClose: () => void;
};

type DocRow = { key: number; url: string; name: string };

export function RequirementFormDialog({ projectId, projectKey, members, requirement, nextCode, cycles = [], currentUserId, onClose }: Props) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string>(requirement?.status ?? "BACKLOG");
  const [ownerId, setOwnerId] = useState(requirement?.ownerId ?? currentUserId);
  const [cycleId, setCycleId] = useState(NONE);
  const [docs, setDocs] = useState<DocRow[]>(
    requirement?.docs.length ? requirement.docs.map((d, key) => ({ key, url: d.url, name: d.name })) : [{ key: 0, url: "", name: "" }],
  );
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  const create = useAction(createRequirement.bind(null, projectId));
  const update = useAction(updateRequirement.bind(null, requirement?.id ?? ""), { successMessage: "已保存", onSuccess: onClose });
  const { fieldErrors } = requirement ? update : create;
  const pending = create.pending || update.pending || uploading;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const input = {
      title: form.get("title"),
      summary: form.get("summary"),
      status,
      ownerId: orNull(ownerId),
      docs: docs.filter((d) => d.url.trim()).map((d) => ({ url: d.url.trim(), name: d.name.trim() })),
    };

    if (requirement) {
      update.run(input);
      return;
    }

    const result = await create.run({ ...input, cycleId: orNull(cycleId) });
    if (!result.ok) return;

    // 附件归档到材料库，并打上「需求规格」标签
    setUploading(true);
    let failed = 0;
    for (const file of files) {
      try {
        await uploadMaterialFile(projectKey, file, { requirementId: result.data.id, tagName: "需求规格" });
      } catch {
        failed += 1;
      }
    }
    setUploading(false);
    if (failed) toast.error(`${failed} 个附件上传失败，可以稍后在需求详情中重新添加`);
    toast.success("需求已创建，可以开始拆解任务了");
    onClose();
    router.push(routes.requirement(projectKey, result.data.number));
  }

  function addFiles(list: FileList | null) {
    const picked = Array.from(list ?? []);
    const tooLarge = picked.filter((f) => f.size > MAX_UPLOAD_BYTES);
    if (tooLarge.length) toast.error(`单个文件不能超过 100 MB：${tooLarge.map((f) => f.name).join("、")}`);
    setFiles((prev) => [...prev, ...picked.filter((f) => f.size <= MAX_UPLOAD_BYTES)]);
  }

  const docError = Object.entries(fieldErrors).find(([k]) => k.startsWith("docs"))?.[1];

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{requirement ? `编辑需求 ${requirement.code}` : "新建需求"}</DialogTitle>
        </DialogHeader>
        <form id="requirement-form" onSubmit={handleSubmit} className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto px-0.5">
          <div className="grid grid-cols-[110px_1fr] gap-3">
            <FormField label="编号">
              <Input value={requirement?.code ?? nextCode ?? ""} disabled />
            </FormField>
            <FormField label="需求标题" htmlFor="req-title" error={fieldErrors.title}>
              <Input id="req-title" name="title" defaultValue={requirement?.title} placeholder="例如：客户批量导入" autoFocus />
            </FormField>
          </div>
          <div className={requirement ? "grid grid-cols-2 gap-3" : "grid grid-cols-3 gap-3"}>
            <FormField label="需求负责人">
              <OptionSelect options={memberOptions(members, "未指定")} value={ownerId ?? NONE} onValueChange={setOwnerId} className="w-full" />
            </FormField>
            <FormField label="状态">
              <OptionSelect
                value={status}
                onValueChange={setStatus}
                className="w-full"
                options={(Object.keys(REQUIREMENT_STATUS_LABEL) as RequirementStatus[]).map((s) => ({
                  value: s,
                  label: REQUIREMENT_STATUS_LABEL[s],
                  render: <RequirementStatusBadge status={s} />,
                }))}
              />
            </FormField>
            {!requirement && (
              <FormField label="计划交付周期">
                <OptionSelect options={cycleOptions(cycles, "待排期")} value={cycleId} onValueChange={setCycleId} className="w-full" />
              </FormField>
            )}
          </div>

          <FormField
            label={
              <>
                来源文档<span className="font-normal text-muted-foreground">粘贴飞书 / 腾讯文档链接，自动识别类型</span>
              </>
            }
            error={docError}
          >
            <div className="flex flex-col gap-2">
              {docs.map((doc) => (
                <div key={doc.key} className="grid grid-cols-[18px_minmax(0,1.5fr)_minmax(0,1fr)_32px] items-center gap-2">
                  <DocTypeIcon type={detectDocType(doc.url)} className="size-4.5" />
                  <Input
                    value={doc.url}
                    placeholder="https://xxx.feishu.cn/docx/…"
                    aria-label="文档链接"
                    onChange={(e) => setDocs((rows) => rows.map((r) => (r.key === doc.key ? { ...r, url: e.target.value } : r)))}
                  />
                  <Input
                    value={doc.name}
                    placeholder="文档名称（可选）"
                    aria-label="文档名称"
                    onChange={(e) => setDocs((rows) => rows.map((r) => (r.key === doc.key ? { ...r, name: e.target.value } : r)))}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="移除链接"
                    onClick={() => setDocs((rows) => rows.filter((r) => r.key !== doc.key))}
                  >
                    <XIcon />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="self-start"
                onClick={() => setDocs((rows) => [...rows, { key: Date.now(), url: "", name: "" }])}
              >
                <PlusIcon />
                再添加一个链接
              </Button>
            </div>
          </FormField>

          <FormField label="需求摘要" htmlFor="req-summary" error={fieldErrors.summary}>
            <Textarea
              id="req-summary"
              name="summary"
              rows={3}
              defaultValue={requirement?.summary}
              placeholder="一两句话概括要点，完整内容以外部文档为准"
            />
          </FormField>

          {!requirement && (
            <FormField label="附件（可选）" description="会同时归档到材料库，并打上「需求规格」标签">
              <div className="flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-input p-3.5 text-sm text-muted-foreground transition-colors hover:border-primary hover:bg-accent-soft/50 hover:text-accent-text"
                >
                  <UploadIcon className="size-4" />
                  上传需求规格说明书等文件
                </button>
                <input ref={fileInput} type="file" multiple hidden onChange={(e) => addFiles(e.target.files)} />
                {files.map((file, i) => (
                  <div key={`${file.name}-${i}`} className="flex items-center gap-2 rounded-md border py-1 pr-1 pl-2.5 text-sm">
                    <FileTextIcon className="size-4 text-muted-foreground" />
                    <span className="flex-1 truncate">{file.name}</span>
                    <span className="text-xs text-muted-foreground">{formatFileSize(file.size)}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      aria-label="移除附件"
                      onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                    >
                      <XIcon />
                    </Button>
                  </div>
                ))}
              </div>
            </FormField>
          )}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button type="submit" form="requirement-form" disabled={pending}>
            {pending && <Spinner />}
            {uploading ? "正在上传附件…" : requirement ? "保存" : "创建"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

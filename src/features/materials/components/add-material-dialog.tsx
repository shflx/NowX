import { FileIcon, LinkIcon, UploadIcon, XIcon } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { DocTypeIcon } from "@/components/shared/doc-link";
import { FormField } from "@/components/shared/form-field";
import { orNull } from "@/components/shared/option-renderers";
import { NONE, SearchSelect } from "@/components/shared/option-select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requirementOptions } from "@/features/tasks/components/task-option-builders";
import type { RequirementLite } from "@/features/tasks/components/types";
import { useAction } from "@/hooks/use-action";
import { detectDocType, MAX_UPLOAD_BYTES } from "@/lib/constants";
import { formatFileSize } from "@/lib/format";
import { useRouter } from "@/lib/navigation";

import { createLinkMaterial } from "../actions";
import { uploadMaterialFile } from "../upload";
import { type TagLite, TagPicker } from "./tag-picker";

type Props = {
  projectId: string;
  projectKey: string;
  tags: TagLite[];
  requirements: RequirementLite[];
  defaultTab?: "file" | "link";
  defaultRequirementId?: string;
  onClose: () => void;
};

export function AddMaterialDialog({ projectId, projectKey, tags, requirements, defaultTab = "file", defaultRequirementId, onClose }: Props) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState(defaultTab);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [requirementId, setRequirementId] = useState(defaultRequirementId ?? NONE);
  const [uploading, setUploading] = useState(false);

  const addLink = useAction(createLinkMaterial.bind(null, projectId), { successMessage: "已添加材料", onSuccess: onClose });

  function pick(list: FileList | null) {
    const picked = list?.[0];
    if (!picked) return;
    if (picked.size > MAX_UPLOAD_BYTES) {
      toast.error("单个文件不能超过 100 MB");
      return;
    }
    setFile(picked);
    if (!name) setName(picked.name);
  }

  async function submit() {
    if (tab === "link") {
      addLink.run({ url: url.trim(), name, tagIds, requirementId: orNull(requirementId) });
      return;
    }
    if (!file) {
      toast.error("请先选择文件");
      return;
    }
    setUploading(true);
    try {
      await uploadMaterialFile(projectKey, file, { name, tagIds, requirementId: orNull(requirementId) });
      toast.success("已上传");
      onClose();
      router.refresh();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setUploading(false);
    }
  }

  const pending = uploading || addLink.pending;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>添加材料</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <Tabs value={tab} onValueChange={(v) => setTab(v as "file" | "link")}>
            <TabsList>
              <TabsTrigger value="file">
                <UploadIcon />
                上传文件
              </TabsTrigger>
              <TabsTrigger value="link">
                <LinkIcon />
                外部链接
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {tab === "file" ? (
            <>
              <div
                role="button"
                tabIndex={0}
                onClick={() => fileInput.current?.click()}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && fileInput.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  pick(e.dataTransfer.files);
                }}
                className="flex flex-col items-center gap-1 rounded-lg border-2 border-dashed border-input p-7 text-center text-sm text-muted-foreground transition-colors outline-none hover:border-primary hover:bg-accent-soft/50 focus-visible:border-primary"
              >
                <UploadIcon className="size-5" />
                拖拽文件到这里，或点击选择
                <span className="text-xs">单个文件不超过 100 MB</span>
              </div>
              <input ref={fileInput} type="file" hidden onChange={(e) => pick(e.target.files)} />
              {file && (
                <div className="flex items-center gap-2 rounded-md border py-1 pr-1 pl-2.5 text-sm">
                  <FileIcon className="size-4 text-muted-foreground" />
                  <span className="flex-1 truncate">{file.name}</span>
                  <span className="text-xs text-muted-foreground">{formatFileSize(file.size)}</span>
                  <Button variant="ghost" size="icon-xs" aria-label="移除文件" onClick={() => setFile(null)}>
                    <XIcon />
                  </Button>
                </div>
              )}
              <FormField label="名称" htmlFor="mat-name">
                <Input id="mat-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="默认使用文件名" />
              </FormField>
            </>
          ) : (
            <>
              <FormField
                label={
                  <>
                    链接地址<span className="font-normal text-muted-foreground">自动识别飞书、腾讯文档、Figma、Apifox</span>
                  </>
                }
                htmlFor="mat-url"
                error={addLink.fieldErrors.url}
              >
                <div className="flex items-center gap-2">
                  <DocTypeIcon type={detectDocType(url)} className="size-4.5" />
                  <Input id="mat-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" autoFocus />
                </div>
              </FormField>
              <FormField label="名称" htmlFor="mat-link-name" error={addLink.fieldErrors.name}>
                <Input id="mat-link-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="不填则使用默认名称，例如「飞书文档」" />
              </FormField>
            </>
          )}

          <FormField label="标签">
            <TagPicker projectId={projectId} tags={tags} value={tagIds} onChange={setTagIds} />
          </FormField>
          <FormField label="关联需求">
            <SearchSelect options={requirementOptions(requirements).map((o) => (o.value === NONE ? { ...o, label: "不关联", render: <span className="text-muted-foreground">不关联</span> } : o))} value={requirementId} onValueChange={setRequirementId} />
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button disabled={pending} onClick={submit}>
            {pending && <Spinner />}
            添加
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

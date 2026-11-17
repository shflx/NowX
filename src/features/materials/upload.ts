// 浏览器端上传材料文件的封装（调用 /api/projects/[key]/materials）

type UploadOptions = { name?: string; requirementId?: string | null; tagIds?: string[]; tagName?: string };

export async function uploadMaterialFile(projectKey: string, file: File, options: UploadOptions = {}) {
  const form = new FormData();
  form.set("file", file);
  if (options.name) form.set("name", options.name);
  if (options.requirementId) form.set("requirementId", options.requirementId);
  if (options.tagName) form.set("tagName", options.tagName);
  for (const id of options.tagIds ?? []) form.append("tagIds", id);

  const response = await fetch(`/api/projects/${projectKey}/materials`, { method: "POST", body: form });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? "上传失败");
  }
  return (await response.json()) as { id: string };
}

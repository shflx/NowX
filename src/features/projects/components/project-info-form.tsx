"use client";

import { useState } from "react";

import { ColorSwatches } from "@/components/shared/color-swatches";
import { ConfirmButton } from "@/components/shared/confirm-button";
import { FormField } from "@/components/shared/form-field";
import { SectionCard } from "@/components/shared/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useAction } from "@/hooks/use-action";
import { PROJECT_COLORS } from "@/lib/constants";

import { setProjectArchived, updateProject } from "../actions";
import { DeleteProjectDialog } from "./delete-project-dialog";

type Props = {
  project: { id: string; key: string; name: string; description: string; color: string; archived: boolean };
};

export function ProjectInfoForm({ project }: Props) {
  const [color, setColor] = useState(project.color);
  const save = useAction(updateProject.bind(null, project.id), { successMessage: "已保存" });

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    save.run({ name: form.get("name"), description: form.get("description"), color });
  }

  return (
    <SectionCard title="项目信息">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-[1fr_200px] gap-3">
          <FormField label="项目名称" htmlFor="name" error={save.fieldErrors.name}>
            <Input id="name" name="name" defaultValue={project.name} />
          </FormField>
          <FormField label="编号前缀" description="创建后不可修改">
            <Input value={project.key} disabled />
          </FormField>
        </div>
        <FormField label="描述" htmlFor="description" error={save.fieldErrors.description}>
          <Input id="description" name="description" defaultValue={project.description} />
        </FormField>
        <FormField label="颜色">
          <ColorSwatches colors={PROJECT_COLORS} value={color} onChange={setColor} />
        </FormField>
        <div className="flex items-center">
          <Button type="submit" disabled={save.pending}>
            {save.pending && <Spinner />}
            保存
          </Button>
        </div>
      </form>
    </SectionCard>
  );
}

/** 危险操作区：与日常设置分开放置，避免误触 */
export function ProjectDangerZone({ project }: Props) {
  const [deleting, setDeleting] = useState(false);
  const archive = useAction(setProjectArchived.bind(null, project.id), {
    successMessage: project.archived ? "已取消归档" : "项目已归档",
  });

  return (
    <SectionCard title="危险操作" className="border-destructive/30">
      <div className="flex flex-col divide-y">
        <div className="flex items-center gap-4 pb-3">
          <div className="flex-1 text-sm">
            <div className="font-medium">{project.archived ? "取消归档" : "归档项目"}</div>
            <p className="text-muted-foreground">
              {project.archived ? "项目会重新出现在成员的项目列表中。" : "项目不再出现在成员的项目列表中，数据完整保留，可以随时取消归档。"}
            </p>
          </div>
          <ConfirmButton
            trigger={
              <Button type="button" variant="outline" disabled={archive.pending}>
                {project.archived ? "取消归档" : "归档"}
              </Button>
            }
            title={project.archived ? "取消归档？" : `归档「${project.name}」？`}
            confirmLabel={project.archived ? "取消归档" : "归档"}
            onConfirm={() => archive.run(!project.archived)}
          />
        </div>
        <div className="flex items-center gap-4 pt-3">
          <div className="flex-1 text-sm">
            <div className="font-medium">删除项目</div>
            <p className="text-muted-foreground">永久删除项目及其中的全部周期、需求、任务、帖子、材料和公告，无法恢复。</p>
          </div>
          <Button type="button" variant="destructive" onClick={() => setDeleting(true)}>
            删除项目
          </Button>
        </div>
      </div>
      <DeleteProjectDialog project={project} redirectTo="/admin/projects" open={deleting} onOpenChange={setDeleting} />
    </SectionCard>
  );
}

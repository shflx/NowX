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
import { DeleteProjectButton } from "./delete-project-button";

type Props = {
  project: { id: string; key: string; name: string; description: string; color: string; archived: boolean };
};

export function ProjectInfoForm({ project }: Props) {
  const [color, setColor] = useState(project.color);
  const save = useAction(updateProject.bind(null, project.id), { successMessage: "已保存" });
  const archive = useAction(setProjectArchived.bind(null, project.id), {
    successMessage: project.archived ? "已取消归档" : "项目已归档",
  });

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
          <ConfirmButton
            trigger={
              <Button type="button" variant="ghost" className="ml-auto" disabled={archive.pending}>
                {project.archived ? "取消归档" : "归档项目"}
              </Button>
            }
            title={project.archived ? "取消归档？" : `归档「${project.name}」？`}
            description={
              project.archived
                ? "项目会重新出现在成员的项目列表中。"
                : "归档后项目不再出现在成员的项目列表中，数据会完整保留，管理员可以随时取消归档。"
            }
            confirmLabel={project.archived ? "取消归档" : "归档"}
            onConfirm={() => archive.run(!project.archived)}
          />
          <DeleteProjectButton
            project={project}
            redirectTo="/admin/projects"
            trigger={
              <Button type="button" variant="ghost" className="text-destructive hover:text-destructive">
                删除项目
              </Button>
            }
          />
        </div>
      </form>
    </SectionCard>
  );
}

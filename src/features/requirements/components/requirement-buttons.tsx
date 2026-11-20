"use client";

import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ComponentProps, useState } from "react";

import { ActionMenu } from "@/components/shared/action-menu";
import { Button } from "@/components/ui/button";
import { useAction } from "@/hooks/use-action";
import { routes } from "@/lib/routes";

import { deleteRequirement } from "../actions";
import { RequirementFormDialog } from "./requirement-form-dialog";

type FormProps = Omit<ComponentProps<typeof RequirementFormDialog>, "onClose">;

export function NewRequirementButton(props: FormProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <PlusIcon />
        新建需求
      </Button>
      {open && <RequirementFormDialog {...props} onClose={() => setOpen(false)} />}
    </>
  );
}

export function EditRequirementButton(props: FormProps & { canDelete: boolean }) {
  const { canDelete, ...formProps } = props;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const remove = useAction(deleteRequirement, {
    successMessage: "需求已删除",
    onSuccess: () => router.push(routes.requirements(props.projectKey)),
  });

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <PencilIcon />
        编辑
      </Button>
      <ActionMenu
        label="需求操作"
        size="icon"
        items={[
          {
            label: "删除需求",
            icon: Trash2Icon,
            destructive: true,
            hidden: !canDelete,
            onSelect: () => remove.run(props.requirement!.id),
            confirm: {
              title: `删除需求 ${props.requirement?.code}？`,
              description: "外部文档链接会一并删除，关联的材料和讨论会保留。",
              confirmLabel: "删除",
            },
          },
        ]}
      />
      {open && <RequirementFormDialog {...formProps} onClose={() => setOpen(false)} />}
    </>
  );
}

"use client";

import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ComponentProps, useState } from "react";

import { ConfirmButton } from "@/components/shared/confirm-button";
import { Button } from "@/components/ui/button";
import { useAction } from "@/hooks/use-action";

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
    onSuccess: () => router.push(`/projects/${props.projectKey}/requirements`),
  });

  return (
    <>
      {canDelete && (
        <ConfirmButton
          trigger={
            <Button variant="ghost">
              <Trash2Icon />
              删除
            </Button>
          }
          title={`删除需求 ${props.requirement?.code}？`}
          description="外部文档链接会一并删除，关联的材料和讨论会保留。"
          confirmLabel="删除"
          destructive
          onConfirm={() => remove.run(props.requirement!.id)}
        />
      )}
      <Button variant="outline" onClick={() => setOpen(true)}>
        <PencilIcon />
        编辑
      </Button>
      {open && <RequirementFormDialog {...formProps} onClose={() => setOpen(false)} />}
    </>
  );
}

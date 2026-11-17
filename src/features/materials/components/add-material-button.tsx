"use client";

import { UploadIcon } from "lucide-react";
import { type ComponentProps, useState } from "react";

import { Button } from "@/components/ui/button";

import { AddMaterialDialog } from "./add-material-dialog";

/** 在需求详情等位置添加材料（默认关联到当前需求） */
export function AddMaterialButton(props: Omit<ComponentProps<typeof AddMaterialDialog>, "onClose">) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <UploadIcon />
        添加
      </Button>
      {open && <AddMaterialDialog {...props} onClose={() => setOpen(false)} />}
    </>
  );
}

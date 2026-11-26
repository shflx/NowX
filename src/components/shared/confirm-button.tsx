import { type ReactNode, useState } from "react";

import { ConfirmDialog, type ConfirmOptions } from "./confirm-dialog";

type ConfirmButtonProps = ConfirmOptions & {
  /** 触发按钮 */
  trigger: ReactNode;
  onConfirm: () => void;
};

/** 点击后先弹出二次确认的按钮 */
export function ConfirmButton({ trigger, onConfirm, ...options }: ConfirmButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <span className="contents" onClickCapture={() => setOpen(true)}>
        {trigger}
      </span>
      <ConfirmDialog {...options} open={open} onOpenChange={setOpen} onConfirm={onConfirm} />
    </>
  );
}

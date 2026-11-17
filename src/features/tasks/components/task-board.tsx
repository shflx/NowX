"use client";

import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useId, useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";

import { TaskStatusIcon } from "@/components/shared/task-status";
import type { TaskStatus } from "@/generated/prisma/enums";
import { BOARD_STATUSES, TASK_STATUS_LABEL } from "@/lib/constants";
import { cn } from "@/lib/utils";

import { updateTask } from "../actions";
import { isOverdue, type TaskCardData } from "../serialize";
import { TaskCard } from "./task-card";
import { useTaskLink } from "./use-task-link";

type Props = { tasks: TaskCardData[]; today: string };

/** 看板：拖动卡片到其他列即修改状态（乐观更新，失败时自动回滚） */
export function TaskBoard({ tasks, today }: Props) {
  const link = useTaskLink();
  // dnd-kit 默认用自增 id 生成无障碍属性，服务端与客户端不一致会导致水合警告，这里传入稳定 id
  const dndId = useId();
  const [, startTransition] = useTransition();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [optimistic, moveTask] = useOptimistic(tasks, (state, { id, status }: { id: string; status: TaskStatus }) =>
    state.map((t) => (t.id === id ? { ...t, status, overdue: isOverdue(t.due, status, today) } : t)),
  );

  const sensors = useSensors(
    // 移动超过 6px 才算拖动，普通点击仍然打开详情
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  // 看板只展示顶层任务；父任务不在当前筛选结果中时，子任务单独展示
  const ids = new Set(optimistic.map((t) => t.id));
  const visible = optimistic.filter((t) => t.status !== "CANCELED" && (!t.parentId || !ids.has(t.parentId)));
  const active = visible.find((t) => t.id === activeId);

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    const task = visible.find((t) => t.id === active.id);
    const status = over?.id as TaskStatus | undefined;
    if (!task || !status || task.status === status) return;

    startTransition(async () => {
      moveTask({ id: task.id, status });
      const result = await updateTask(task.id, { status });
      if (result.ok) toast.success(`${task.code} → ${TASK_STATUS_LABEL[status]}`);
      else toast.error(result.error);
    });
  }

  return (
    <DndContext id={dndId} sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={() => setActiveId(null)}>
      <div className="grid grid-cols-[repeat(4,minmax(240px,1fr))] items-start gap-3 overflow-x-auto pb-2">
        {BOARD_STATUSES.map((status) => (
          <Column key={status} status={status} tasks={visible.filter((t) => t.status === status)} link={link} activeId={activeId} />
        ))}
      </div>
      <DragOverlay>{active && <TaskCard task={active} href={link(active.number)} dragging />}</DragOverlay>
    </DndContext>
  );
}

function Column({
  status,
  tasks,
  link,
  activeId,
}: {
  status: TaskStatus;
  tasks: TaskCardData[];
  link: (n: number) => string;
  activeId: string | null;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <section
      ref={setNodeRef}
      aria-label={TASK_STATUS_LABEL[status]}
      className={cn("min-h-52 rounded-lg bg-secondary p-2 transition-colors", isOver && "bg-accent-soft ring-2 ring-primary ring-inset")}
    >
      <h2 className="flex items-center gap-2 px-1.5 pt-1 pb-2.5 text-sm font-semibold">
        <TaskStatusIcon status={status} />
        {TASK_STATUS_LABEL[status]}
        <span className="font-normal text-muted-foreground tabular-nums">{tasks.length}</span>
      </h2>
      <div className="flex flex-col gap-2">
        {tasks.map((t) => (
          <DraggableCard key={t.id} task={t} href={link(t.number)} hidden={t.id === activeId} />
        ))}
        {tasks.length === 0 && <div className="py-5 text-center text-xs text-muted-foreground">拖到这里</div>}
      </div>
    </section>
  );
}

function DraggableCard({ task, href, hidden }: { task: TaskCardData; href: string; hidden: boolean }) {
  const { setNodeRef, listeners, attributes } = useDraggable({ id: task.id });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} aria-roledescription="可拖动的任务卡片" className={cn("outline-none", hidden && "opacity-40")}>
      <TaskCard task={task} href={href} />
    </div>
  );
}

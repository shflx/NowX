"use client";

import { MessagesSquareIcon, LinkIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmButton } from "@/components/shared/confirm-button";
import { DocLink } from "@/components/shared/doc-link";
import { Markdown } from "@/components/shared/markdown";
import { memberOptions, orNull, priorityOptions, statusOptions } from "@/components/shared/option-renderers";
import { NONE, OptionSelect, SearchSelect } from "@/components/shared/option-select";
import { StatusBadge } from "@/components/shared/status-badge";
import { TaskStatusIcon } from "@/components/shared/task-status";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import type { DocType, TaskPriority, TaskStatus, TopicStatus } from "@/generated/prisma/enums";
import { NewTopicButton } from "@/features/discussions/components/topic-form-dialog";
import { TopicStatusBadge } from "@/features/discussions/components/topic-status-badge";
import { useAction } from "@/hooks/use-action";

import { addTaskComment, createSubtask, deleteTask, updateTask } from "../actions";
import { DueDate } from "./task-card";
import { cycleOptions, requirementOptions } from "./task-option-builders";
import type { MemberLite, TaskFormOptions } from "./types";
import { useTaskLink } from "./use-task-link";

export type TaskSheetData = {
  id: string;
  number: number;
  code: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  due: string | null;
  overdue: boolean;
  assigneeId: string | null;
  cycleId: string | null;
  requirementId: string | null;
  carriedFrom: string | null;
  creatorName: string;
  createdAt: string;
  canDelete: boolean;
  parent: { number: number; code: string; title: string } | null;
  requirement: { number: number; code: string; title: string; doc: { type: DocType; name: string; url: string } | null } | null;
  subtasks: { id: string; number: number; code: string; title: string; status: TaskStatus; assignee: MemberLite | null }[];
  comments: { id: string; body: string; time: string; author: MemberLite }[];
  topics: { id: string; title: string; status: TopicStatus; replies: number }[];
};

type Props = { task: TaskSheetData; options: TaskFormOptions; currentUser: MemberLite };

export function TaskSheet({ task, options, currentUser }: Props) {
  const router = useRouter();
  const link = useTaskLink();
  const close = () => router.push(link(null), { scroll: false });
  const { projectKey, members, cycles, requirements } = options;

  const update = useAction(updateTask.bind(null, task.id));
  const save = (patch: Record<string, unknown>) => update.run(patch);
  const remove = useAction(deleteTask, { successMessage: `已删除 ${task.code}`, onSuccess: close });

  async function copyLink() {
    await navigator.clipboard.writeText(`${window.location.origin}/projects/${projectKey}/tasks?task=${task.number}`).catch(() => {});
    toast.success("已复制任务链接");
  }

  return (
    <Sheet open onOpenChange={(open) => !open && close()}>
      <SheetContent className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-[720px]" aria-describedby={undefined} onOpenAutoFocus={(e) => e.preventDefault()}>
        <SheetHeader className="flex-row items-center gap-3 border-b px-5 py-3.5 pr-12">
          <SheetDescription className="text-sm tabular-nums">{task.code}</SheetDescription>
          {task.parent && (
            <span className="text-xs text-muted-foreground">
              子任务 · 属于{" "}
              <Link href={link(task.parent.number)} scroll={false} className="text-accent-text hover:underline">
                {task.parent.code}
              </Link>
            </span>
          )}
          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={copyLink}>
              <LinkIcon />
              复制链接
            </Button>
            {task.canDelete && (
              <ConfirmButton
                trigger={
                  <Button variant="ghost" size="sm">
                    <Trash2Icon />
                    删除
                  </Button>
                }
                title={`删除 ${task.code}？`}
                description={task.subtasks.length ? "子任务和评论会一并删除，且无法恢复。" : "评论会一并删除，且无法恢复。"}
                confirmLabel="删除"
                destructive
                onConfirm={() => remove.run(task.id)}
              />
            )}
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 pt-5 pb-8">
          <EditableTitle value={task.title} onSave={(title) => save({ title })} />

          <dl className="mt-4 grid grid-cols-[64px_minmax(0,1fr)_64px_minmax(0,1fr)] items-center gap-x-3 gap-y-2 rounded-lg border bg-muted/40 px-4 py-3 text-sm">
            <dt className="text-muted-foreground">状态</dt>
            <dd>
              <OptionSelect size="sm" aria-label="状态" options={statusOptions()} value={task.status} onValueChange={(status) => save({ status })} />
            </dd>
            <dt className="text-muted-foreground">负责人</dt>
            <dd>
              <OptionSelect
                size="sm"
                aria-label="负责人"
                options={memberOptions(members, "未指派")}
                value={task.assigneeId ?? NONE}
                onValueChange={(v) => save({ assigneeId: orNull(v) })}
              />
            </dd>
            <dt className="text-muted-foreground">优先级</dt>
            <dd>
              <OptionSelect size="sm" aria-label="优先级" options={priorityOptions()} value={task.priority} onValueChange={(priority) => save({ priority })} />
            </dd>
            <dt className="text-muted-foreground">截止日期</dt>
            <dd className="flex flex-wrap items-center gap-x-2">
              <Input
                type="date"
                aria-label="截止日期"
                defaultValue={task.due ?? ""}
                className="h-7 w-36"
                onChange={(e) => save({ dueDate: e.target.value || null })}
              />
              {task.overdue && <DueDate task={task} />}
            </dd>
            <dt className="text-muted-foreground">周期</dt>
            <dd className="col-span-3 flex items-center gap-2">
              <OptionSelect
                size="sm"
                aria-label="周期"
                options={cycleOptions(cycles.filter((c) => c.status !== "ENDED" || c.id === task.cycleId))}
                value={task.cycleId ?? NONE}
                onValueChange={(v) => save({ cycleId: orNull(v) })}
              />
              {task.carriedFrom && <StatusBadge tone="warn">由「{task.carriedFrom}」顺延</StatusBadge>}
            </dd>
            <dt className="text-muted-foreground">来源需求</dt>
            <dd className="col-span-3 flex min-w-0 items-center gap-2">
              <SearchSelect
                aria-label="来源需求"
                className="h-7 max-w-72"
                options={requirementOptions(requirements)}
                value={task.requirementId ?? NONE}
                onValueChange={(v) => save({ requirementId: orNull(v) })}
              />
              {task.requirement && (
                <>
                  <Link href={`/projects/${projectKey}/requirements/${task.requirement.number}`} className="shrink-0 text-xs text-accent-text hover:underline">
                    查看需求
                  </Link>
                  {task.requirement.doc && <DocLink doc={task.requirement.doc} />}
                </>
              )}
            </dd>
          </dl>
          <p className="mt-2 text-xs text-muted-foreground">
            {task.creatorName} 创建于 {task.createdAt}
          </p>

          <DescriptionEditor value={task.description} onSave={(description) => save({ description })} />

          {!task.parent && <Subtasks task={task} link={link} />}

          <Section
            title="相关讨论"
            count={task.topics.length}
            action={
              <NewTopicButton
                projectId={options.projectId}
                projectKey={projectKey}
                members={members}
                currentUserId={currentUser.id}
                defaultLink={`task:${task.id}`}
                trigger={
                  <Button variant="outline" size="sm">
                    <MessagesSquareIcon />
                    就此任务提问
                  </Button>
                }
              />
            }
          >
            {task.topics.length ? (
              task.topics.map((t) => (
                <Link
                  key={t.id}
                  href={`/projects/${projectKey}/discussions/${t.id}`}
                  className="flex items-center gap-2 border-t py-2 text-sm first:border-0 hover:text-accent-text"
                >
                  <TopicStatusBadge status={t.status} />
                  <span className="flex-1 truncate">{t.title}</span>
                  <span className="text-xs text-muted-foreground">{t.replies} 回复</span>
                </Link>
              ))
            ) : (
              <p className="text-xs text-muted-foreground">暂无讨论</p>
            )}
          </Section>

          <Comments task={task} currentUser={currentUser} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Section({ title, count, action, children }: { title: string; count?: number; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h3 className="mb-2.5 flex items-center gap-2 text-sm font-semibold">
        {title}
        {count !== undefined && <span className="font-normal text-muted-foreground">{count}</span>}
        {action && <span className="ml-auto">{action}</span>}
      </h3>
      {children}
    </section>
  );
}

function EditableTitle({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  if (!editing) {
    return (
      <SheetHeader className="p-0">
        <SheetTitle asChild>
          <button className="text-left text-xl leading-snug font-semibold hover:text-accent-text" onClick={() => setEditing(true)} title="点击修改标题">
            {value}
          </button>
        </SheetTitle>
      </SheetHeader>
    );
  }
  const commit = (next: string) => {
    setEditing(false);
    if (next.trim() && next.trim() !== value) onSave(next.trim());
  };
  return (
    <>
      <SheetTitle className="sr-only">{value}</SheetTitle>
      <Input
        autoFocus
        defaultValue={value}
        className="h-10 text-lg font-semibold"
        aria-label="任务标题"
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit(e.currentTarget.value);
          if (e.key === "Escape") setEditing(false);
        }}
      />
    </>
  );
}

function DescriptionEditor({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  return (
    <Section
      title="描述"
      action={
        !editing && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setDraft(value);
              setEditing(true);
            }}
          >
            <PencilIcon />
            编辑
          </Button>
        )
      }
    >
      {editing ? (
        <div className="flex flex-col gap-2">
          <Textarea autoFocus rows={8} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="支持 Markdown" />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
              取消
            </Button>
            <Button
              size="sm"
              onClick={() => {
                onSave(draft);
                setEditing(false);
              }}
            >
              保存
            </Button>
          </div>
        </div>
      ) : value ? (
        <Markdown>{value}</Markdown>
      ) : (
        <p className="text-sm text-muted-foreground">暂无描述</p>
      )}
    </Section>
  );
}

function Subtasks({ task, link }: { task: TaskSheetData; link: (n: number) => string }) {
  const [title, setTitle] = useState("");
  const add = useAction(createSubtask.bind(null, task.id), { onSuccess: () => setTitle("") });
  const toggle = useAction(updateTask);
  const done = task.subtasks.filter((s) => s.status === "DONE").length;

  return (
    <Section title="子任务" count={task.subtasks.length}>
      {task.subtasks.length > 0 && <p className="-mt-2 mb-2 text-xs text-muted-foreground">已完成 {done}/{task.subtasks.length}</p>}
      <ul className="flex flex-col gap-1.5">
        {task.subtasks.map((s) => (
          <li key={s.id} className="flex items-center gap-2.5 rounded-md border px-2.5 py-1.5 text-sm">
            <Checkbox
              checked={s.status === "DONE"}
              aria-label={`完成 ${s.code}`}
              onCheckedChange={(c) => toggle.run(s.id, { status: c === true ? "DONE" : "TODO" })}
            />
            <TaskStatusIcon status={s.status} />
            <span className="text-xs text-muted-foreground tabular-nums">{s.code}</span>
            <Link href={link(s.number)} scroll={false} className={`flex-1 truncate hover:text-accent-text ${s.status === "DONE" ? "text-muted-foreground line-through" : ""}`}>
              {s.title}
            </Link>
            {s.assignee && <UserAvatar user={s.assignee} size="sm" />}
          </li>
        ))}
      </ul>
      <form
        className="mt-2 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (title.trim()) add.run({ title });
        }}
      >
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="添加子任务，回车确认" aria-label="新子任务标题" />
        <Button type="submit" variant="outline" disabled={add.pending || !title.trim()}>
          <PlusIcon />
          添加
        </Button>
      </form>
    </Section>
  );
}

function Comments({ task, currentUser }: { task: TaskSheetData; currentUser: MemberLite }) {
  const [body, setBody] = useState("");
  const add = useAction(addTaskComment.bind(null, task.id), { onSuccess: () => setBody("") });
  const submit = () => body.trim() && add.run({ body });

  return (
    <Section title="评论" count={task.comments.length}>
      <ul className="flex flex-col gap-4">
        {task.comments.map((c) => (
          <li key={c.id} className="flex gap-2.5">
            <UserAvatar user={c.author} />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">
                {c.author.name}
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">{c.time}</span>
              </div>
              <Markdown className="mt-0.5">{c.body}</Markdown>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex gap-2.5">
        <UserAvatar user={currentUser} />
        <div className="flex-1 overflow-hidden rounded-lg border focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
            }}
            placeholder="写评论，@姓名 提及成员（⌘ + Enter 发送）"
            className="min-h-16 resize-y border-0 shadow-none focus-visible:ring-0"
          />
          <div className="flex justify-end border-t bg-muted/40 px-2 py-1.5">
            <Button size="sm" disabled={add.pending || !body.trim()} onClick={submit}>
              发送
            </Button>
          </div>
        </div>
      </div>
    </Section>
  );
}

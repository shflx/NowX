"use client";

import { CheckIcon, SparklesIcon, StarIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";

import { FormField } from "@/components/shared/form-field";
import { memberOptions, orNull } from "@/components/shared/option-renderers";
import { NONE, type Option, OptionSelect, SearchSelect } from "@/components/shared/option-select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useAction } from "@/hooks/use-action";
import { ASSISTANT_MENTION } from "@/lib/constants";
import { routes } from "@/lib/routes";

import { createTopic, getTopicLinkOptions, suggestSimilarTopics } from "../actions";

type Props = {
  projectId: string;
  projectKey: string;
  members: { id: string; name: string; color: string }[];
  currentUserId: string;
  /** 预选的关联对象，如 task:<id> */
  defaultLink?: string;
  trigger: ReactNode;
};

/** 「发起提问」按钮 + 弹窗 */
export function NewTopicButton({ trigger, ...props }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      {open && <TopicForm {...props} onDone={() => setOpen(false)} />}
    </Dialog>
  );
}

function TopicForm({ projectId, projectKey, members, currentUserId, defaultLink, onDone }: Omit<Props, "trigger"> & { onDone: () => void }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [assigneeId, setAssigneeId] = useState(NONE);
  const [link, setLink] = useState(defaultLink ?? NONE);
  const [linkOptions, setLinkOptions] = useState<Option[]>([]);
  const [similar, setSimilar] = useState<{ id: string; title: string; isFaq: boolean }[]>([]);

  const create = useAction(createTopic.bind(null, projectId), {
    successMessage: "已发布",
    onSuccess: ({ id }) => {
      onDone();
      router.push(routes.topic(projectKey, id));
    },
  });

  // 打开时加载可关联的任务与需求
  useEffect(() => {
    getTopicLinkOptions(projectId).then((result) => {
      if (!result.ok) return;
      setLinkOptions(
        result.data.map((o) => ({
          value: o.value,
          label: `${o.kind} ${o.code} ${o.title}`,
          render: (
            <>
              <span className="rounded bg-muted px-1.5 text-xs text-muted-foreground">{o.kind}</span>
              <span className="text-xs text-muted-foreground tabular-nums">{o.code}</span>
              <span className="truncate">{o.title}</span>
            </>
          ),
        })),
      );
    });
  }, [projectId]);

  // 输入标题时推荐相似的已解决帖子，减少重复提问
  useEffect(() => {
    if (title.trim().length < 2) return;
    const timer = setTimeout(() => {
      suggestSimilarTopics(projectId, title).then((result) => result.ok && setSimilar(result.data));
    }, 350);
    return () => clearTimeout(timer);
  }, [projectId, title]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    create.run({ title, body: form.get("body"), assigneeId: orNull(assigneeId), link: orNull(link) });
  }

  return (
    <DialogContent className="sm:max-w-xl">
      <DialogHeader>
        <DialogTitle>发起提问</DialogTitle>
        <DialogDescription>帖子对项目全员可见，讨论会永久存档。</DialogDescription>
      </DialogHeader>
      <form id="topic-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        <FormField label="问题标题" htmlFor="topic-title" error={create.fieldErrors.title}>
          <Input id="topic-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="一句话描述你的问题" autoComplete="off" autoFocus />
        </FormField>
        {title.trim().length >= 2 && similar.length > 0 && (
          <div className="rounded-md border border-dashed border-primary/30 bg-accent-soft/50 px-3 py-2.5 text-sm">
            <div className="mb-1 flex items-center gap-1.5 font-semibold text-accent-text">
              <SparklesIcon className="size-4" />
              这些已解决的帖子可能回答了你的问题
            </div>
            {similar.map((t) => (
              <Link
                key={t.id}
                href={routes.topic(projectKey, t.id)}
                onClick={onDone}
                className="flex items-center gap-1.5 py-0.5 text-accent-text hover:underline"
              >
                {t.isFaq ? <StarIcon className="size-3.5" /> : <CheckIcon className="size-3.5" />}
                {t.title}
              </Link>
            ))}
          </div>
        )}
        <FormField label="详细描述" htmlFor="topic-body" error={create.fieldErrors.body}>
          <Textarea id="topic-body" name="body" rows={6} placeholder={`背景、你尝试过什么、期望的结果……支持 Markdown，输入 ${ASSISTANT_MENTION} 可以让助手帮忙查找`} />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="希望谁来回答（可选）">
            <OptionSelect
              className="w-full"
              value={assigneeId}
              onValueChange={setAssigneeId}
              options={memberOptions(
                members.filter((m) => m.id !== currentUserId),
                "不指定，所有人都可以回答",
              )}
            />
          </FormField>
          <FormField label="关联任务 / 需求">
            <SearchSelect
              value={link}
              onValueChange={setLink}
              options={[{ value: NONE, label: "不关联", render: <span className="text-muted-foreground">不关联</span> }, ...linkOptions]}
            />
          </FormField>
        </div>
      </form>
      <DialogFooter>
        <Button variant="outline" onClick={onDone}>
          取消
        </Button>
        <Button type="submit" form="topic-form" disabled={create.pending}>
          {create.pending && <Spinner />}
          发布
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { Link } from "@/lib/navigation";
import { cn } from "@/lib/utils";

/**
 * 渲染用户输入的 Markdown。react-markdown 默认不渲染原始 HTML，可安全展示用户内容。
 */
export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div
      className={cn(
        "text-sm leading-7 break-words [&_a]:text-accent-text [&_a]:underline-offset-2 hover:[&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-px [&_code]:font-mono [&_code]:text-[12.5px] [&_ol]:mb-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-2 [&_p:last-child]:mb-0 [&_pre]:mb-2 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_table]:mb-2 [&_td]:border [&_td]:px-2 [&_th]:border [&_th]:px-2 [&_ul]:mb-2 [&_ul]:list-disc [&_ul]:pl-5",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // 站内链接（以 / 开头）在当前页打开，外部链接新窗口打开
          a: ({ node, href = "", ...props }) =>
            href.startsWith("/") ? <Link href={href} {...props} /> : <a href={href} {...props} target="_blank" rel="noopener noreferrer" />,
        }}
      >
        {highlightMentions(children)}
      </ReactMarkdown>
    </div>
  );
}

/** 把 @姓名 渲染为加粗，便于在讨论中识别被提及的人 */
function highlightMentions(text: string) {
  return text.replace(/(^|[\s，。,:：])@([一-龥A-Za-z]{2,10})/g, "$1**@$2**");
}

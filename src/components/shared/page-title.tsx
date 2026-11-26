import { useEffect } from "react";

/** 设置浏览器标签页标题：「页面名 · NowX」 */
export function PageTitle({ title }: { title: string }) {
  useEffect(() => {
    document.title = `${title} · NowX`;
  }, [title]);
  return null;
}

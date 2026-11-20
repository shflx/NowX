import { redirect } from "next/navigation";

import { routes } from "@/lib/routes";

/** 项目首页默认进入任务页 */
export default async function ProjectIndexPage({ params }: PageProps<"/projects/[key]">) {
  const { key } = await params;
  redirect(routes.tasks(key));
}

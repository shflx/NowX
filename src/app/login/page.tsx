import type { Metadata } from "next";

import { LoginForm } from "@/features/auth/components/login-form";

export const metadata: Metadata = { title: "登录" };

const FEATURES = [
  ["需求可追溯", "每个任务都知道它来自哪条需求"],
  ["周期交付", "两周或一个月一个迭代，进度一目了然"],
  ["交流存档", "问题公开讨论，好答案沉淀为 FAQ"],
  ["项目助手", "「我的任务有哪些？」直接问"],
];

export default function LoginPage() {
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-[radial-gradient(1200px_600px_at_0%_0%,#5b53f0_0%,#3a32b8_55%,#241f7a_100%)] p-12 text-white lg:flex">
        <div className="flex items-center gap-2 text-lg font-bold">
          <span className="grid size-7 place-items-center rounded-md bg-white text-sm font-extrabold text-primary">N</span>
          NowX
        </div>
        <div>
          <h2 className="text-3xl leading-snug font-semibold">
            小团队的协作中枢
            <br />
            需求、任务、周期、交流，一处搞定
          </h2>
          <p className="mt-4 max-w-md leading-relaxed text-white/80">
            把飞书 / 腾讯文档里的需求拆成任务，按周期交付；问题在交流区公开讨论、沉淀为团队知识。
          </p>
        </div>
        <ul className="grid max-w-lg grid-cols-2 gap-3 text-sm">
          {FEATURES.map(([title, text]) => (
            <li key={title} className="rounded-xl border border-white/15 bg-white/10 px-4 py-3">
              <b className="block">{title}</b>
              {text}
            </li>
          ))}
        </ul>
      </section>
      <section className="grid place-items-center bg-card p-8">
        <LoginForm />
      </section>
    </main>
  );
}

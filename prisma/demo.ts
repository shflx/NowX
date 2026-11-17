// 演示数据：还原 UI 原型中的团队、项目与协作内容，便于本地体验与界面验收。
// 运行：pnpm db:demo（只在空库或尚无演示项目时执行；所有日期相对「今天」生成）
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import type { DocType, TaskPriority, TaskStatus } from "../src/generated/prisma/enums";
import { addDays, fromDateString, todayIn } from "../src/lib/dates";
import { hashPassword } from "../src/server/auth/password";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const TZ = process.env.APP_TIMEZONE || "Asia/Shanghai";
const TODAY = todayIn(TZ);
const DEMO_PASSWORD = "nowx1234";

/** 相对今天的日期（yyyy-MM-dd） */
const d = (offset: number) => addDays(TODAY, offset);
/** 相对今天某天的某个时刻（应用时区，按 +08:00 近似） */
const at = (offset: number, time = "10:00") => new Date(`${d(offset)}T${time}:00+08:00`);

const USERS = [
  { login: "linzhou", name: "林舟", title: "技术负责人", role: "ADMIN", color: "#4f46e5" },
  { login: "chenxiao", name: "陈晓", title: "前端开发", role: "MEMBER", color: "#0e7fc2" },
  { login: "wanglei", name: "王磊", title: "后端开发", role: "MEMBER", color: "#c26a0e" },
  { login: "zhaomin", name: "赵敏", title: "测试", role: "MEMBER", color: "#138a5e" },
  { login: "liuyang", name: "刘洋", title: "后端开发", role: "MEMBER", color: "#c2410c" },
  { login: "sunting", name: "孙婷", title: "产品经理", role: "MEMBER", color: "#be185d" },
  { login: "zhoujie", name: "周杰", title: "UI 设计", role: "MEMBER", color: "#7c3aed" },
  { login: "hejing", name: "何静", title: "运维", role: "MEMBER", color: "#0f766e" },
] as const;

type Login = (typeof USERS)[number]["login"];

async function main() {
  if (await db.project.findUnique({ where: { key: "CRM" } })) {
    console.log("演示数据已存在（项目 CRM），跳过");
    return;
  }

  // ---------------------------------------------------------------- 账号
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const uid = {} as Record<Login, string>;
  for (const u of USERS) {
    const user = await db.user.upsert({
      where: { login: u.login },
      update: {},
      create: { ...u, passwordHash, mustChangePassword: false, lastLoginAt: at(0, "09:00") },
    });
    uid[u.login] = user.id;
  }

  // ---------------------------------------------------------------- 项目
  const crm = await db.project.create({
    data: {
      key: "CRM",
      name: "CRM 客户管理 v2",
      description: "销售团队使用的客户管理系统第二版",
      color: "#4f46e5",
      members: { create: (["linzhou", "chenxiao", "wanglei", "zhaomin", "liuyang", "sunting", "zhoujie"] as Login[]).map((l) => ({ userId: uid[l] })) },
    },
  });
  const app = await db.project.create({
    data: {
      key: "APP",
      name: "销售助手 App",
      description: "面向一线销售的移动端",
      color: "#0e7fc2",
      members: { create: (["linzhou", "chenxiao", "sunting", "zhoujie"] as Login[]).map((l) => ({ userId: uid[l] })) },
    },
  });
  const ops = await db.project.create({
    data: {
      key: "OPS",
      name: "内部运维平台",
      description: "发布、监控与告警",
      color: "#138a5e",
      members: { create: (["linzhou", "wanglei", "hejing"] as Login[]).map((l) => ({ userId: uid[l] })) },
    },
  });

  // ---------------------------------------------------------------- 周期（第 2 期正好进行到一半）
  const cycle = (projectId: string, name: string, start: number, end: number, status: "PLANNED" | "ACTIVE" | "ENDED", goal = "") =>
    db.cycle.create({
      data: {
        projectId,
        name,
        goal,
        status,
        startDate: fromDateString(d(start)),
        endDate: fromDateString(d(end)),
        startedAt: status === "PLANNED" ? null : at(start, "09:00"),
        endedAt: status === "ENDED" ? at(end, "18:00") : null,
      },
    });
  const c1 = await cycle(crm.id, "第 1 期", -21, -8, "ENDED", "客户详情页改版上线；导入功能技术方案");
  const c2 = await cycle(crm.id, "第 2 期", -7, 6, "ACTIVE", "完成客户批量导入上线；销售漏斗看板联调");
  const c3 = await cycle(crm.id, "第 3 期", 7, 20, "PLANNED", "角色权限上线；通知中心启动");
  const appCycle = await cycle(app.id, "11 月迭代", -16, 13, "ACTIVE", "客户拜访打卡 + 离线草稿");
  const opsCycle = await cycle(ops.id, "第 2 期", -7, 6, "ACTIVE", "一键回滚");

  // ---------------------------------------------------------------- 需求
  const FEISHU = "https://example.feishu.cn/docx/";
  const TENCENT = "https://docs.qq.com/doc/";
  const reqSeq: Record<string, number> = {};
  const requirement = async (
    projectId: string,
    title: string,
    owner: Login,
    status: "BACKLOG" | "DESIGN" | "DEVELOPING" | "DELIVERED",
    summary: string,
    docs: { type: DocType; name: string; url: string }[],
  ) => {
    reqSeq[projectId] = (reqSeq[projectId] ?? 99) + 1;
    return db.requirement.create({
      data: { projectId, number: reqSeq[projectId], title, ownerId: uid[owner], status, summary, docs: { create: docs.map((doc, sort) => ({ ...doc, sort })) } },
    });
  };
  const r100 = await requirement(crm.id, "客户详情页改版", "sunting", "DELIVERED", "重新组织客户详情信息结构，突出跟进记录。", [
    { type: "FEISHU", name: "客户详情页改版 PRD", url: `${FEISHU}A1` },
  ]);
  const r101 = await requirement(
    crm.id,
    "客户批量导入",
    "sunting",
    "DEVELOPING",
    "支持通过 Excel 批量导入客户，自动校验格式、识别重复客户，并生成导入报告。单次上限 5 万行。",
    [
      { type: "FEISHU", name: "客户批量导入 PRD v1.3", url: `${FEISHU}B2` },
      { type: "TENCENT", name: "导入字段映射表", url: `${TENCENT}C3` },
    ],
  );
  const r102 = await requirement(crm.id, "销售漏斗看板", "sunting", "DEVELOPING", "按阶段展示商机数量与金额，支持按销售、时间段筛选，支持下钻到商机列表。", [
    { type: "TENCENT", name: "销售漏斗需求说明", url: `${TENCENT}D4` },
  ]);
  const r103 = await requirement(crm.id, "角色权限细化", "linzhou", "DESIGN", "从「管理员 / 普通用户」两级扩展为可配置角色 + 权限点。", [
    { type: "FEISHU", name: "权限模型设计", url: `${FEISHU}E5` },
  ]);
  const r104 = await requirement(crm.id, "消息通知中心", "sunting", "BACKLOG", "统一站内信、邮件、飞书机器人三种通知渠道。", [
    { type: "FEISHU", name: "通知中心 PRD（草稿）", url: `${FEISHU}F6` },
  ]);
  const r201 = await requirement(app.id, "客户拜访打卡", "sunting", "DEVELOPING", "定位打卡 + 拍照 + 拜访小结。", [
    { type: "FEISHU", name: "拜访打卡 PRD", url: `${FEISHU}G7` },
  ]);
  const r301 = await requirement(ops.id, "一键回滚", "linzhou", "DEVELOPING", "基于镜像版本的一键回滚。", [
    { type: "FEISHU", name: "回滚方案", url: `${FEISHU}H8` },
  ]);
  for (const [projectId, seq] of Object.entries(reqSeq)) {
    await db.project.update({ where: { id: projectId }, data: { requirementSeq: seq } });
  }

  // ---------------------------------------------------------------- 任务
  const taskSeq: Record<string, number> = {};
  type TaskInput = {
    project: { id: string };
    title: string;
    status: TaskStatus;
    priority: TaskPriority;
    assignee: Login;
    due: number;
    cycleId?: string | null;
    requirementId?: string | null;
    parentId?: string;
    /** 完成于第几天（相对今天） */
    doneAt?: number;
    createdAt?: number;
    description?: string;
    carriedFromCycleId?: string;
  };
  const task = async (t: TaskInput) => {
    taskSeq[t.project.id] = (taskSeq[t.project.id] ?? 0) + 1;
    return db.task.create({
      data: {
        projectId: t.project.id,
        number: taskSeq[t.project.id],
        title: t.title,
        description: t.description ?? "",
        status: t.status,
        priority: t.priority,
        assigneeId: uid[t.assignee],
        dueDate: fromDateString(d(t.due)),
        cycleId: t.cycleId ?? null,
        requirementId: t.requirementId ?? null,
        parentId: t.parentId,
        carriedFromCycleId: t.carriedFromCycleId,
        completedAt: t.status === "DONE" ? at(t.doneAt ?? 0, "17:00") : null,
        creatorId: uid.linzhou,
        createdAt: at(t.createdAt ?? -22, "09:30"),
      },
    });
  };

  // 第 1 期（已结束）
  const c1Tasks: [string, Login, string | null, number][] = [
    ["客户详情页：信息分组重构", "chenxiao", r100.id, -17],
    ["客户详情页：跟进记录时间线", "chenxiao", r100.id, -13],
    ["跟进记录接口分页优化", "wanglei", r100.id, -16],
    ["详情页视觉稿", "zhoujie", r100.id, -19],
    ["详情页回归测试", "zhaomin", r100.id, -10],
    ["客户导入：技术方案评审", "linzhou", r101.id, -11],
    ["漏斗阶段口径确认", "sunting", r102.id, -11],
    ["日志采集接入", "liuyang", null, -9],
  ];
  for (const [title, assignee, requirementId, doneAt] of c1Tasks) {
    await task({ project: crm, title, status: "DONE", priority: "MEDIUM", assignee, due: doneAt, cycleId: c1.id, requirementId, doneAt });
  }
  await task({
    project: crm,
    title: "客户列表导出 Excel",
    status: "TODO",
    priority: "LOW",
    assignee: "liuyang",
    due: 6,
    cycleId: c2.id,
    carriedFromCycleId: c1.id,
  });

  // 第 2 期（进行中）
  const parse = await task({
    project: crm,
    title: "客户导入：Excel 模板解析服务",
    status: "IN_PROGRESS",
    priority: "HIGH",
    assignee: "wanglei",
    due: 3,
    cycleId: c2.id,
    requirementId: r101.id,
    createdAt: -8,
    description: "基于技术方案实现 Excel 解析：\n\n- 支持 .xlsx / .csv\n- 按「导入字段映射表」做字段映射\n- 逐行校验，错误行收集到报告中\n\n大文件使用流式读取，避免一次性加载到内存。",
  });
  await task({ project: crm, title: "解析：日期与手机号格式校验", status: "DONE", priority: "MEDIUM", assignee: "wanglei", due: 1, cycleId: c2.id, requirementId: r101.id, parentId: parse.id, doneAt: 0, createdAt: -6 });
  await task({ project: crm, title: "解析：大文件流式读取", status: "IN_PROGRESS", priority: "MEDIUM", assignee: "wanglei", due: 3, cycleId: c2.id, requirementId: r101.id, parentId: parse.id, createdAt: -6 });
  await task({ project: crm, title: "解析：错误行收集", status: "DONE", priority: "MEDIUM", assignee: "wanglei", due: 3, cycleId: c2.id, requirementId: r101.id, parentId: parse.id, doneAt: -1, createdAt: -6 });

  const c2Tasks: Omit<TaskInput, "project" | "cycleId">[] = [
    { title: "客户导入：数据库表结构", status: "DONE", priority: "HIGH", assignee: "wanglei", due: -6, requirementId: r101.id, doneAt: -6, createdAt: -8 },
    { title: "客户导入：异步任务队列方案", status: "DONE", priority: "MEDIUM", assignee: "liuyang", due: -5, requirementId: r101.id, doneAt: -5, createdAt: -8 },
    { title: "销售漏斗：接口字段定义", status: "DONE", priority: "MEDIUM", assignee: "liuyang", due: -5, requirementId: r102.id, doneAt: -5, createdAt: -8 },
    { title: "客户导入：交互稿", status: "DONE", priority: "MEDIUM", assignee: "zhoujie", due: -6, requirementId: r101.id, doneAt: -6, createdAt: -8 },
    { title: "角色权限：现状盘点", status: "DONE", priority: "MEDIUM", assignee: "linzhou", due: -4, requirementId: r103.id, doneAt: -4, createdAt: -8 },
    { title: "修复：跟进记录时间显示时区错误", status: "DONE", priority: "URGENT", assignee: "chenxiao", due: -5, doneAt: -5, createdAt: -6 },
    { title: "客户导入：前端上传与预览", status: "DONE", priority: "MEDIUM", assignee: "chenxiao", due: 4, requirementId: r101.id, doneAt: -2, createdAt: -8 },
    { title: "漏斗页视觉稿", status: "DONE", priority: "MEDIUM", assignee: "zhoujie", due: -2, requirementId: r102.id, doneAt: -3, createdAt: -8 },
    { title: "修复：客户详情页偶发白屏", status: "DONE", priority: "URGENT", assignee: "chenxiao", due: 0, doneAt: 0, createdAt: -1 },
    {
      title: "客户导入：重复客户合并策略",
      status: "TODO",
      priority: "HIGH",
      assignee: "linzhou",
      due: -1,
      requirementId: r101.id,
      createdAt: -8,
      description: "确定重复判定规则（手机号 / 公司名 + 联系人），以及合并时字段冲突的处理方式。输出文档后同步给 @王磊。",
    },
    { title: "导入结果报告与错误行下载", status: "TODO", priority: "MEDIUM", assignee: "liuyang", due: 4, requirementId: r101.id, createdAt: -8 },
    { title: "导入功能测试用例", status: "IN_PROGRESS", priority: "MEDIUM", assignee: "zhaomin", due: 4, requirementId: r101.id, createdAt: -8 },
    { title: "销售漏斗：数据聚合接口", status: "IN_PROGRESS", priority: "HIGH", assignee: "liuyang", due: 3, requirementId: r102.id, createdAt: -8 },
    { title: "销售漏斗：看板图表组件", status: "TODO", priority: "MEDIUM", assignee: "chenxiao", due: 5, requirementId: r102.id, createdAt: -8 },
    { title: "角色权限：权限点梳理", status: "IN_REVIEW", priority: "HIGH", assignee: "linzhou", due: 1, requirementId: r103.id, createdAt: -8 },
    { title: "角色权限：后端鉴权中间件", status: "TODO", priority: "HIGH", assignee: "wanglei", due: 6, requirementId: r103.id, createdAt: -8 },
    { title: "升级 Prisma 并清理废弃迁移", status: "TODO", priority: "LOW", assignee: "linzhou", due: 6, createdAt: -3 },
  ];
  const created: Record<string, string> = {};
  for (const t of c2Tasks) {
    const row = await task({ ...t, project: crm, cycleId: c2.id });
    created[t.title] = row.id;
  }

  // 第 3 期（计划中）
  await task({ project: crm, title: "通知中心：数据模型设计", status: "TODO", priority: "MEDIUM", assignee: "linzhou", due: 10, cycleId: c3.id, requirementId: r104.id, createdAt: -2 });
  await task({ project: crm, title: "角色权限：前端权限指令", status: "TODO", priority: "MEDIUM", assignee: "chenxiao", due: 17, cycleId: c3.id, requirementId: r103.id, createdAt: -2 });

  // 其他项目
  const appTask = await task({ project: app, title: "拜访打卡：定位与拍照", status: "IN_PROGRESS", priority: "HIGH", assignee: "chenxiao", due: 5, cycleId: appCycle.id, requirementId: r201.id, createdAt: -15 });
  await task({ project: app, title: "拜访小结离线草稿", status: "TODO", priority: "MEDIUM", assignee: "chenxiao", due: 10, cycleId: appCycle.id, requirementId: r201.id, createdAt: -15 });
  await task({ project: app, title: "打卡页交互稿", status: "DONE", priority: "MEDIUM", assignee: "zhoujie", due: -5, cycleId: appCycle.id, requirementId: r201.id, doneAt: -6, createdAt: -15 });
  await task({ project: app, title: "审核 App 隐私合规清单", status: "IN_REVIEW", priority: "HIGH", assignee: "linzhou", due: 2, cycleId: appCycle.id, createdAt: -10 });
  await task({ project: ops, title: "镜像版本记录表", status: "DONE", priority: "MEDIUM", assignee: "wanglei", due: 1, cycleId: opsCycle.id, requirementId: r301.id, doneAt: 0, createdAt: -7 });
  await task({ project: ops, title: "回滚执行器", status: "IN_PROGRESS", priority: "HIGH", assignee: "hejing", due: 4, cycleId: opsCycle.id, requirementId: r301.id, createdAt: -7 });
  await task({ project: ops, title: "回滚方案评审", status: "TODO", priority: "HIGH", assignee: "linzhou", due: -3, cycleId: opsCycle.id, requirementId: r301.id, createdAt: -7 });

  for (const [projectId, seq] of Object.entries(taskSeq)) {
    await db.project.update({ where: { id: projectId }, data: { taskSeq: seq } });
  }

  // ---------------------------------------------------------------- 评论
  const comment = (taskId: string, author: Login, body: string, offset: number, time: string) =>
    db.taskComment.create({ data: { taskId, authorId: uid[author], body, createdAt: at(offset, time) } });
  await comment(parse.id, "wanglei", "日期和手机号校验已完成，正在做流式读取，预计周四提测。", 0, "10:12");
  await comment(parse.id, "linzhou", "@王磊 5 万行的上限记得压测一下内存，结果贴到交流区那个帖子里。", 0, "10:40");
  await comment(created["客户导入：重复客户合并策略"], "wanglei", "这个策略会影响解析服务的接口设计，能尽快定下来吗？", 0, "09:05");
  await comment(created["角色权限：权限点梳理"], "linzhou", "权限点清单已整理到飞书文档，等待 @孙婷 确认。", 0, "11:30");

  // ---------------------------------------------------------------- 交流区
  const topic = async (t: {
    project: { id: string };
    title: string;
    body: string;
    author: Login;
    assignee?: Login;
    status: "OPEN" | "SOLVED";
    faq?: boolean;
    taskId?: string;
    requirementId?: string;
    offset: number;
    views: number;
    replies?: { author: Login | "assistant"; body: string; accepted?: boolean; time: string }[];
  }) => {
    const created = await db.topic.create({
      data: {
        projectId: t.project.id,
        title: t.title,
        body: t.body,
        authorId: uid[t.author],
        assigneeId: t.assignee ? uid[t.assignee] : null,
        status: t.status,
        isFaq: t.faq ?? false,
        taskId: t.taskId,
        requirementId: t.requirementId,
        viewCount: t.views,
        createdAt: at(t.offset, "09:30"),
        lastActivityAt: at(t.offset, t.replies?.at(-1)?.time ?? "09:30"),
      },
    });
    for (const r of t.replies ?? []) {
      await db.reply.create({
        data: {
          topicId: created.id,
          authorId: r.author === "assistant" ? null : uid[r.author],
          isAssistant: r.author === "assistant",
          body: r.body,
          isAccepted: r.accepted ?? false,
          createdAt: at(t.offset, r.time),
        },
      });
    }
  };

  await topic({
    project: crm,
    title: "导入时手机号带 +86 前缀要不要去掉？",
    body: "客户 Excel 里手机号格式比较乱，有 `+86 138...`、`86-138...`、`138 1234 5678` 几种。入库时是统一清洗成 11 位，还是原样保存？重复判定是否基于清洗后的号码？",
    author: "wanglei",
    assignee: "linzhou",
    status: "SOLVED",
    faq: true,
    taskId: parse.id,
    offset: -3,
    views: 23,
    replies: [
      {
        author: "linzhou",
        accepted: true,
        time: "15:48",
        body: "统一清洗后入库：\n\n- 去掉 `+86` / `86-` 前缀和所有空格、短横线\n- 清洗后不是 11 位的，作为错误行进入报告\n- 原始值保存在 `rawPhone` 字段，方便追溯\n\n重复判定基于清洗后的号码。",
      },
      { author: "wanglei", time: "16:02", body: "明白，按这个实现。" },
    ],
  });
  await topic({
    project: crm,
    title: "漏斗阶段的定义以哪个文档为准？",
    body: "腾讯文档的需求说明里是 5 个阶段，但飞书上周会纪要里提到要拆成 6 个（多了「方案确认」）。接口按哪个来？",
    author: "liuyang",
    assignee: "sunting",
    status: "OPEN",
    requirementId: r102.id,
    offset: 0,
    views: 6,
  });
  await topic({
    project: crm,
    title: "本地 prisma migrate 报错 P3006，是不是迁移文件冲突了？",
    body: "拉了最新 main 之后执行 `pnpm prisma migrate dev` 报 P3006，提示 shadow database 应用迁移失败。删库重建可以解决，但不确定是不是有人改了已提交的迁移。",
    author: "chenxiao",
    assignee: "linzhou",
    status: "OPEN",
    offset: 0,
    views: 9,
    replies: [{ author: "liuyang", time: "11:20", body: "我也遇到了，好像是 `20261110_add_tags` 这个迁移被改过。" }],
  });
  await topic({
    project: crm,
    title: "权限点命名：resource:action 还是 action_resource？",
    body: "鉴权中间件要开始写了，想先统一一下权限点命名，比如 `customer:import` 还是 `import_customer`？",
    author: "wanglei",
    assignee: "linzhou",
    status: "OPEN",
    taskId: created["角色权限：权限点梳理"],
    offset: -1,
    views: 14,
    replies: [{ author: "liuyang", time: "18:50", body: "倾向 `customer:import`，按资源分组更好管理，前端也方便按前缀判断。" }],
  });
  await topic({
    project: crm,
    title: "测试环境账号怎么申请？",
    body: "新同学入职，需要测试环境的管理员账号和普通销售账号各一个。",
    author: "zhaomin",
    status: "SOLVED",
    faq: true,
    offset: -12,
    views: 31,
    replies: [
      { author: "assistant", time: "10:00", body: "我在材料库里找到了可能相关的文档：「测试环境说明」，其中第 2 节介绍了账号申请流程。" },
      { author: "zhaomin", time: "10:21", accepted: true, body: "找运维何静即可，当天开通。测试账号统一用 `qa_` 前缀，密码首次登录强制修改。" },
    ],
  });
  await topic({
    project: crm,
    title: "导入失败的行，是否支持在线修改后重试？",
    body: "PRD 里只写了「下载错误报告」，前端需要做在线编辑表格吗？工作量差别挺大。",
    author: "chenxiao",
    assignee: "sunting",
    status: "SOLVED",
    requirementId: r101.id,
    offset: -4,
    views: 12,
    replies: [{ author: "sunting", time: "17:45", accepted: true, body: "第一版不做在线编辑，只提供错误报告下载，用户改完重新导入即可。已同步更新到 PRD v1.3。" }],
  });
  await topic({
    project: app,
    title: "iOS 定位权限文案谁来定？",
    body: "上架审核对定位权限说明文案要求比较严，需要产品给一版。",
    author: "chenxiao",
    assignee: "sunting",
    status: "OPEN",
    taskId: appTask.id,
    offset: -1,
    views: 4,
  });

  // ---------------------------------------------------------------- 材料库
  const tagColors: Record<string, string> = { 需求规格: "blue", 设计稿: "purple", 接口文档: "orange", 技术文档: "gray", 测试: "green", 会议纪要: "yellow", 新人必读: "red" };
  const tags: Record<string, string> = {};
  for (const [name, color] of Object.entries(tagColors)) {
    tags[name] = (await db.tag.create({ data: { projectId: crm.id, name, color } })).id;
  }
  const link = (name: string, url: string, docType: DocType, tagNames: string[], by: Login, offset: number, requirementId?: string) =>
    db.material.create({
      data: {
        projectId: crm.id,
        kind: "LINK",
        name,
        url,
        docType,
        requirementId,
        uploaderId: uid[by],
        createdAt: at(offset),
        tags: { create: tagNames.map((n) => ({ tagId: tags[n] })) },
      },
    });
  await link("CRM 接口文档（Apifox）", "https://apifox.com/", "APIFOX", ["接口文档"], "wanglei", -15);
  await link("销售漏斗看板设计稿", "https://www.figma.com/", "FIGMA", ["设计稿"], "zhoujie", -1, r102.id);
  await link("测试环境说明", `${FEISHU}T1`, "FEISHU", ["测试", "新人必读"], "hejing", -20);
  await link("周会纪要 11-10", `${FEISHU}M1`, "FEISHU", ["会议纪要"], "sunting", -7);
  await link("销售漏斗需求说明", `${TENCENT}D4`, "TENCENT", ["需求规格"], "sunting", -9, r102.id);
  await link("客户批量导入 PRD v1.3", `${FEISHU}B2`, "FEISHU", ["需求规格", "新人必读"], "sunting", -4, r101.id);

  // ---------------------------------------------------------------- 公告
  const announce = (projectId: string, title: string, body: string, pinned: boolean, author: Login, offset: number, time: string) =>
    db.announcement.create({ data: { projectId, title, body, pinned, authorId: uid[author], createdAt: at(offset, time) } });
  await announce(
    crm.id,
    `第 2 期迭代启动：${d(-7).slice(5).replace("-", "/")} – ${d(6).slice(5).replace("-", "/")}`,
    "本期目标：\n\n- 客户批量导入功能提测并上线\n- 销售漏斗看板完成前后端联调\n- 角色权限完成权限点梳理与中间件开发\n\n任务已拆分并分配，请大家在「任务」页确认自己的任务和截止日期。有疑问到交流区发帖。",
    true,
    "linzhou",
    -7,
    "09:00",
  );
  await announce(crm.id, "本周五 20:00 测试环境停机维护", "数据库升级，预计停机 2 小时。请提前保存测试数据，避免在此期间部署。", true, "hejing", -1, "17:30");
  await announce(crm.id, "代码评审规则调整：合并前至少 1 人 Approve", "从第 2 期开始，所有合入 main 的 PR 需要至少 1 位其他成员 Approve。紧急修复可以先合并，事后补评审。", false, "linzhou", -7, "10:00");
  await announce(crm.id, "欢迎新同学周杰加入", "周杰负责 CRM 与销售助手 App 的 UI 设计，欢迎！", false, "sunting", -14, "09:30");
  await announce(app.id, "11 月迭代目标", "拜访打卡上线内测。", true, "sunting", -16, "09:00");

  // ---------------------------------------------------------------- 动态
  const activity = (projectId: string, actor: Login, verb: string, target: string, offset: number, time: string) =>
    db.activity.create({ data: { projectId, actorId: uid[actor], verb, target, createdAt: at(offset, time) } });
  await activity(crm.id, "zhoujie", "完成了任务", "CRM-21 漏斗页视觉稿", -3, "18:20");
  await activity(crm.id, "hejing", "发布了公告", "本周五 20:00 测试环境停机维护", -1, "17:30");
  await activity(crm.id, "wanglei", "完成了子任务", "CRM-11 解析：日期与手机号格式校验", 0, "09:40");
  await activity(crm.id, "chenxiao", "在交流区提问", "本地 prisma migrate 报错 P3006…", 0, "09:30");
  await activity(crm.id, "chenxiao", "完成了任务", "CRM-22 修复：客户详情页偶发白屏", 0, "10:05");

  console.log(`演示数据已生成。可用以下账号登录（密码均为 ${DEMO_PASSWORD}）：`);
  console.log(USERS.map((u) => `  ${u.login}（${u.name}，${u.role === "ADMIN" ? "管理员" : "成员"}）`).join("\n"));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());

# NowX

面向小团队（≤ 15 人）的轻量项目协作平台：需求 → 任务 → 周期交付可追溯，交流区沉淀团队知识，项目助手回答项目相关的问题。设计说明见 [docs/DESIGN.md](docs/DESIGN.md)。

## 技术栈

部署在 Cloudflare Workers（免费计划可用）：

- 前端：React 19 单页应用（React Router + TanStack Query）· Tailwind CSS 4 + shadcn/ui，构建产物作为静态资源发布
- 接口：Hono · Kysely（`pg` 驱动经 Hyperdrive 连接 PostgreSQL）· Zod
- 平台能力：Durable Objects（实时推送、限流、密码哈希、附件配额，以及执行 MCP 与项目助手的 AgentRunner）· R2（附件）
- 数据库结构与迁移：Prisma（schema 与 migrate，运行时不使用 Prisma Client）
- 测试：Vitest + Playwright；项目助手支持 Claude API 或 OpenAI 兼容接口

免费计划下每个请求的 CPU 时间上限为 10ms，因此页面不做服务端渲染：页面外壳是静态资源，数据由 `/api` 的轻量接口提供；每个请求只用一个数据库连接，页面的查询合并为一条 SQL，嵌套数据由 PostgreSQL 组装为 JSON。MCP 与项目助手的 SDK 开销较大，在 Durable Object（AgentRunner）中执行。

## 本地开发

需要 Node.js 24、pnpm 10、Docker。

```bash
pnpm install
cp .env.example .env              # 数据库连接与初始管理员
cp .dev.vars.example .dev.vars    # Worker 运行时配置（时区、站点地址、项目助手）
docker compose up -d db           # 启动 PostgreSQL
pnpm db:migrate                   # 执行迁移
pnpm db:seed                      # 创建初始管理员（.env 中的 SEED_ADMIN_*，首次登录需改密）
pnpm db:demo                      # 可选：生成演示数据，账号 linzhou（管理员）/ chenxiao 等，密码 nowx1234
pnpm dev                          # http://localhost:3000
```

`pnpm dev` 在本地 workerd 中运行 Worker，Hyperdrive 直接连接 `.env` 中的 `DATABASE_URL`，Durable Objects 与 R2 使用本地模拟。

项目助手需要在 `.dev.vars` 中配置 `ASSISTANT_API_KEY`，不配置时不显示助手入口，其余功能不受影响。`ASSISTANT_PROTOCOL` 选择接口协议：`anthropic`（默认，模型默认 `claude-opus-5-5`）或 `openai`（OpenAI 及兼容 Chat Completions 的服务，需填写 `ASSISTANT_MODEL`）；经代理或兼容服务访问时填写 `ASSISTANT_BASE_URL`。

## 远程 MCP

在账号菜单打开「个人访问令牌」并创建令牌。将管理页上的 `/api/mcp` 地址添加到支持 Streamable HTTP 的客户端，配置请求头 `Authorization: Bearer <token>`。部署时将 `APP_URL` 设为站点的 HTTPS 访问地址。

令牌有效期为 90 天，可在管理页吊销。每个账号每分钟可发出 120 个 MCP POST 请求。外部客户端使用令牌所属账号的权限，可查看未归档项目的周期、任务和需求，并新建和修改需求与任务。项目成员可访问自己加入的项目，管理员可访问所有未归档项目。

调用 `list_cycles` 获取周期 ID。写入需求或任务时，用 `cycleId` 指定周期。创建关联任务时，在 `requirement` 中填写 `create_requirement` 返回的 `code`。`update_requirement` 和 `update_task` 使用 `number` 指定记录编号，只修改传入的字段。

## 常用命令

| 命令 | 说明 |
|---|---|
| `pnpm typecheck` / `pnpm lint` | 类型检查（前端与服务端、Worker 入口分别检查）/ 代码检查 |
| `pnpm test` | Vitest（`src/**/*.test.ts`），设置 `NOWX_MCP_TEST_DATABASE_URL` 后同时运行令牌和 MCP 工具的 PostgreSQL 用例。请使用已应用迁移的测试库 |
| `pnpm test:e2e` | 端到端测试（依赖演示数据；未安装 Playwright 浏览器时加 `PLAYWRIGHT_CHANNEL=chrome`） |
| `pnpm build` / `pnpm preview` | 构建前端与 Worker / 在本地 workerd 中运行构建产物 |
| `pnpm db:migrate` | 修改 `prisma/schema.prisma` 后生成并执行迁移，随后运行 `pnpm db:types` 更新 Kysely 类型 |
| `pnpm db:studio` | 浏览数据库 |

## 目录结构

```
prisma/              数据模型、迁移、种子与演示数据脚本
workers/             Worker 入口（页面登录跳转、/api 分发、实时推送握手）、Durable Objects、发布脚本
src/
  main.tsx           前端入口
  app/               路由表与布局（根布局、工作区外壳）
  pages/             页面：从 /api 读取数据并渲染
  features/<模块>/    按业务模块组织：
                       schemas（Zod，前后端共用）、components（界面）、actions（前端调用写操作）
                       queries（读）、mutations（写）、service（共用业务逻辑）、routes（接口）——仅在 Worker 中运行
  components/
    ui/              shadcn/ui 组件（由 CLI 生成，尽量不改）
    shared/          跨模块的展示组件
    layout/          工作区外壳：侧边栏、顶栏、实时刷新
  server/            仅在 Worker 中运行：接口入口、请求上下文、数据库、会话与权限、实时推送、文件存储、MCP
  lib/               前后端共用的纯函数与常量
  hooks/             前端 Hook
tests/e2e/           Playwright 端到端测试
```

约定：

- 接口统一在服务端完成鉴权：页面数据接口用 `requireProjectByKey`，写操作用 `requireProjectAccess` / `requireAdmin`。
- 写操作放在各模块的 `mutations.ts`（只导出写操作），通过 `POST /api/actions/<模块>.<函数>` 调用，返回统一的 `ActionResult`；前端在 `actions.ts` 中用 `action()` 声明调用入口。
- 前端不能引用服务端模块（`src/server`、`workers` 及各模块的 queries / mutations / service / routes），构建时会报错；需要的类型用 `import type` 引入。
- 页面数据接口把互不依赖的查询合并为一条 SQL（`db.selectNoFrom` + `@/server/db/json`），各模块 `queries.ts` 返回查询供合并；JSON 中的 date 列用 `jsonDate` 转换。
- 数据库中 `id` 与 `updatedAt` 没有默认值，插入时用 `cuid()` 生成主键，更新 User / Project / Requirement / Task 时写入 `updatedAt`。
- 数据变更后调用 `publishProjectChange`，在线成员的页面会通过 WebSocket 自动刷新。
- 进度统计只按顶层任务计数，相关纯函数在 `src/features/cycles/stats.ts`（有单元测试）。

## 部署

推送到 `prod` 分支后由 GitHub Actions 检查、构建并发布到 Cloudflare Workers（`workers/publish.mjs`）。变量、密钥与已有资源绑定在 Cloudflare 控制台维护，发布时继承；兼容性标志、静态资源路由（单页应用回退、Worker 优先的路径）与新增的 Durable Object 随代码发布。数据库迁移需在发布前对线上数据库执行 `pnpm db:deploy`。

# NowX

面向小团队（≤ 15 人）的轻量项目协作平台：需求 → 任务 → 周期交付可追溯，交流区沉淀团队知识，项目助手回答项目相关的问题。设计说明见 [docs/DESIGN.md](docs/DESIGN.md)。

## 技术栈

Next.js 16（App Router、Cache Components）· TypeScript · PostgreSQL + Prisma 7 · Tailwind CSS 4 + shadcn/ui · Zod · Vitest + Playwright · Claude API（项目助手）

## 本地开发

需要 Node.js 24、pnpm 10、Docker。

```bash
pnpm install
cp .env.example .env          # 按需修改
docker compose up -d db       # 启动 PostgreSQL
pnpm db:migrate               # 执行迁移
pnpm db:seed                  # 创建初始管理员（.env 中的 SEED_ADMIN_*，首次登录需改密）
pnpm db:demo                  # 可选：生成演示数据，账号 linzhou（管理员）/ chenxiao 等，密码 nowx1234
pnpm dev                      # http://localhost:3000
```

项目助手需要在 `.env` 中配置 `ANTHROPIC_API_KEY`，不配置时其余功能不受影响。

## 远程 MCP

在账号菜单打开「个人访问令牌」并创建令牌。将管理页上的 `/api/mcp` 地址添加到支持 Streamable HTTP 的客户端，配置请求头 `Authorization: Bearer <token>`。部署时将 `APP_URL` 设为站点的 HTTPS 访问地址。

令牌有效期为 90 天，可在管理页吊销。每个账号每分钟可发出 120 个 MCP POST 请求。外部客户端可以列出可访问的未归档项目，并读取其任务与需求。

## 常用命令

| 命令 | 说明 |
|---|---|
| `pnpm typecheck` / `pnpm lint` | 类型检查 / 代码检查 |
| `pnpm test` | Vitest（`src/**/*.test.ts`），设置 `NOWX_MCP_TEST_DATABASE_URL` 后同时运行令牌和查询工具的 PostgreSQL 用例。请使用已应用迁移的测试库 |
| `pnpm test:e2e` | 端到端测试（依赖演示数据；未安装 Playwright 浏览器时加 `PLAYWRIGHT_CHANNEL=chrome`） |
| `pnpm db:migrate` | 修改 `prisma/schema.prisma` 后生成并执行迁移 |
| `pnpm db:studio` | 浏览数据库 |

## 目录结构

```
prisma/              数据模型、迁移、种子与演示数据脚本
src/
  app/               路由：(workspace) 为登录后的页面，api/ 为 Route Handler（SSE、上传下载、项目助手）
  features/<模块>/    按业务模块组织：schemas（Zod）、queries（读）、actions（Server Action 写）、components
  components/
    ui/              shadcn/ui 组件（由 CLI 生成，尽量不改）
    shared/          跨模块的展示组件
    layout/          工作区外壳：侧边栏、顶栏、实时刷新
  server/            仅服务端：数据库、会话与权限、事件总线、通知、文件存储
  lib/               前后端共用的纯函数与常量
  hooks/             客户端 Hook
tests/e2e/           Playwright 端到端测试
deploy/              Caddy 配置
```

约定：

- 所有读写都在服务端完成鉴权：页面用 `requireProjectByKey`，Server Action 用 `requireProjectAccess` / `requireAdmin`，并通过 `runAction` 返回统一的 `ActionResult`。
- 数据变更后调用 `publishProjectChange`，在线成员的页面会通过 SSE 自动刷新。
- 进度统计只按顶层任务计数，相关纯函数在 `src/features/cycles/stats.ts`（有单元测试）。

## 部署（云服务器）

```bash
cp .env.production.example .env.production   # 填写域名、数据库密码、管理员初始密码等
docker compose --env-file .env.production --profile prod up -d --build
docker compose --env-file .env.production --profile prod run --rm migrate pnpm db:seed   # 首次部署创建管理员
```

Compose 包含 PostgreSQL、迁移任务、应用和 Caddy（自动申请 HTTPS 证书）。上传的文件保存在 `uploads` 卷中，备份时连同数据库卷一起备份。

实时推送、登录限流和 MCP 限流在进程内实现，只支持单实例部署。

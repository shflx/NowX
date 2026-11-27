import { bindings, defineConfig, defineWorker, exports } from "cf/config";

export default defineConfig({
  worker: defineWorker({
    name: "nowx",
    entrypoint: "./workers/entry.ts",
    compatibilityDate: "2026-11-24",
    compatibilityFlags: ["nodejs_compat"],
    assets: {
      htmlHandling: "none",
      // 前端是单页应用：未匹配到静态文件的路径返回 index.html
      notFoundHandling: "single-page-application",
      // 页面请求先经过 Worker 做登录跳转（不查库），构建产物直接由静态资源服务返回
      runWorkerFirst: ["/*", "!/assets/*", "!/favicon.ico"],
    },
    observability: { enabled: true, traces: { enabled: true, headSamplingRate: 0.01 } },
    // 部署代码时由 Workers 继承控制台管理的运行时变量和密钥（见 workers/publish.mjs）。
    unsafe: { metadata: { keep_bindings: ["plain_text", "json", "secret_text", "secret_key"] } },
    exports: {
      AgentRunner: exports.durableObject({ storage: "sqlite" }),
      AttachmentQuota: exports.durableObject({ storage: "sqlite" }),
      LiveEvents: exports.durableObject({ storage: "sqlite" }),
      PasswordHash: exports.durableObject({ storage: "sqlite" }),
      RateLimit: exports.durableObject({ storage: "sqlite" }),
    },
    env: {
      LIVE_EVENTS: bindings.durableObject({ worker: "nowx", exportName: "LiveEvents" }),
      HYPERDRIVE: bindings.hyperdrive({ id: process.env.NOWX_HYPERDRIVE_ID ?? "00000000000000000000000000000000" }),
      RATE_LIMIT: bindings.durableObject({ worker: "nowx", exportName: "RateLimit" }),
      PASSWORD_HASH: bindings.durableObject({ worker: "nowx", exportName: "PasswordHash" }),
      ASSETS: bindings.assets(),
      ATTACHMENTS: bindings.r2({ name: "nowx-attachments" }),
      ATTACHMENT_QUOTA: bindings.durableObject({ worker: "nowx", exportName: "AttachmentQuota" }),
      AGENT_RUNNER: bindings.durableObject({ worker: "nowx", exportName: "AgentRunner" }),
      // 运行时配置：线上在控制台维护（部署时继承），本地开发从 .dev.vars 读取
      APP_TIMEZONE: bindings.secret(),
      APP_URL: bindings.secret(),
      ASSISTANT_PROTOCOL: bindings.secret(),
      ASSISTANT_API_KEY: bindings.secret(),
      ASSISTANT_MODEL: bindings.secret(),
      ASSISTANT_BASE_URL: bindings.secret(),
    },
  }),
});

import { bindings, defineConfig, defineWorker, exports } from "cf/config";

export default defineConfig({
  worker: defineWorker({
    name: "nowx",
    entrypoint: "./workers/entry.ts",
    compatibilityDate: "2026-11-24",
    assets: {
      htmlHandling: "none",
      notFoundHandling: "none",
      runWorkerFirst: ["/*", "!/_next/static/*", "!/*/_next/static/*"],
    },
    observability: { enabled: true, traces: { enabled: true, headSamplingRate: 0.01 } },
    exports: {
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
      APP_URL: bindings.text("https://nowx.shuffleyxf.workers.dev"),
      ATTACHMENTS: bindings.r2({ name: "nowx-attachments" }),
      ATTACHMENT_QUOTA: bindings.durableObject({ worker: "nowx", exportName: "AttachmentQuota" }),
    },
  }),
});

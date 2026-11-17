# syntax=docker/dockerfile:1

# ---------------------------------------------------------------- 依赖
FROM node:24-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml prisma.config.ts ./
COPY prisma ./prisma
# postinstall 会执行 prisma generate，生成 src/generated/prisma
RUN pnpm install --frozen-lockfile

# ---------------------------------------------------------------- 构建
# 该阶段也用于执行数据库迁移与种子脚本（见 compose.yaml 中的 migrate 服务）
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm prisma generate && pnpm build

# ---------------------------------------------------------------- 运行
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    STORAGE_DIR=/app/storage \
    NEXT_TELEMETRY_DISABLED=1

RUN addgroup -S nodejs && adduser -S nextjs -G nodejs \
    && mkdir -p /app/storage && chown nextjs:nodejs /app/storage

# standalone 输出只包含运行所需的文件
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]

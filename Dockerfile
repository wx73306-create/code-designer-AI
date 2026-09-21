# Next 16 / Babel 8 要求 Node >= 22。
# 用 Debian bullseye 而非 Alpine/bookworm：Prisma 5.22 生成的是
# debian-openssl-1.1.x 引擎，需要系统的 libssl.so.1.1；
# bullseye 自带 OpenSSL 1.1，bookworm/alpine(OpenSSL 3) 都会导致引擎加载失败。
FROM node:22-bullseye-slim AS base

# Install dependencies only when needed
FROM base AS deps
ARG NPM_REGISTRY
WORKDIR /app
COPY package.json package-lock.json ./
# --force: package.json 里写死了 Windows 专属包 @rollup/rollup-win32-x64-msvc，
# 在 Linux 镜像上会被 EBADPLATFORM 拦下，需跳过平台校验。
RUN if [ -n "$NPM_REGISTRY" ]; then npm config set registry "$NPM_REGISTRY"; fi \
    && npm ci --legacy-peer-deps --force --no-audit --no-fund

# Rebuild the source code only when needed
FROM base AS builder
ARG NPM_REGISTRY
# 构建期占位：Prisma / Next 在 build 阶段可能会读取该变量
ARG DATABASE_URL
ENV DATABASE_URL=${DATABASE_URL}
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN if [ -n "$NPM_REGISTRY" ]; then npm config set registry "$NPM_REGISTRY"; fi \
    && npx prisma generate \
    && npm run build

# Production image, copy all the files and run next
FROM base AS runner
ARG NPM_REGISTRY
WORKDIR /app
ENV NODE_ENV=production

# --- Headless Chrome（/api/screenshot 截图与视觉分析依赖）---
#
# 本机网络实测后的取舍：
#   1. deb.debian.org 返回 502 Bad Gateway（被代理拦截），改用清华镜像源。
#      且必须用 http —— node:22-bullseye-slim 未预装 ca-certificates，
#      https 源会在握手时失败（certificate issuer is unknown）。
#   2. 不启用 bullseye-security 源：bullseye 已 EOL，镜像站的安全更新索引与
#      实际 .deb 文件不同步，安装时大量 404（libnss3/libasound2/libcups2 等）。
#   3. 浏览器二进制原本应用 @puppeteer/browsers 拉取与 puppeteer-core 25.4
#      对齐的 chrome-headless-shell 151，但本机环境下该二进制实际不可得：
#      storage.googleapis.com 不可达；npmmirror / 华为云镜像虽返回 200，但
#      GET 传输速率为 0 或约 54KB/s 后断连（实测 95s 仅下载 12KB）。
#      因此改用 Debian 源自带的 chromium 120 —— apt 走同一镜像源稳定且快，
#      截图用的是基础的 Page.navigate / captureScreenshot 命令，不受影响。
#      若将来网络恢复，可改回 chrome-headless-shell 以获得版本对齐。
RUN printf '%s\n' \
      'deb http://mirrors.tuna.tsinghua.edu.cn/debian bullseye main' \
      'deb http://mirrors.tuna.tsinghua.edu.cn/debian bullseye-updates main' \
      > /etc/apt/sources.list \
    && rm -rf /etc/apt/sources.list.d/* \
    && apt-get update -o Acquire::Check-Valid-Until=false \
    && apt-get install -y --no-install-recommends \
       chromium \
       fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

ENV CHROME_PATH=/usr/bin/chromium

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]

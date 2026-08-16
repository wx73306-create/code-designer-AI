# Code Designer AI

> **AI 驱动的网页逆向工程平台** —— 输入任意 URL，自动输出可运行的 React + TypeScript + TailwindCSS 项目。

[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-06B6D4?logo=tailwindcss)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Powered by](https://img.shields.io/badge/Powered%20by-阿里云百炼-FF6A00)](https://bailian.console.aliyun.com/)

---

## 🎯 项目简介

Code Designer AI 是一个 **AI 驱动的网页逆向工程平台**，通过多智能体（Multi-Agent）协作，把"看到一个网站 → 还原出可运行的 React 项目"这条链路从几天压缩到几分钟。

**核心流水线（6 个 Agent 串联）：**

```
URL → 网页抓取 → 视觉分析 → Design Token 提取 → 组件架构规划 → React 代码生成 → 质量检测 → 项目导出
```

用户只需粘贴一个 URL，平台自动完成 HTML / CSS / 布局 / 字体 / 颜色 / 尺寸 / 动画 等设计信息的解析，并生成可直接 `npm install && npm run dev` 跑起来的 Next.js 工程。

平台支持用户在 **百炼 / MiMo / OpenAI / Anthropic / Gemini / DeepSeek** 等多个模型之间自由选择（视觉、规划、编码、质检等环节可独立指定模型），真正做到模型可插拔。

---

## ✨ 核心特性

- 🤖 **多智能体协作**：抓取 / 视觉 / Token / 架构 / 编码 / 质检 六个 Agent 各司其职、顺序触发
- 👁️ **视觉 + 语义双驱动**：截图视觉与 DOM 结构联合分析，还原度高于纯 DOM 解析
- 🎨 **Design Token 自动提取**：自动结构化输出颜色、字号、间距、圆角、阴影、动画曲线
- 🧩 **组件架构智能规划**：自动拆分组件树、设计 Props、规划状态与数据流
- 💻 **生产级代码生成**：输出 TypeScript + TailwindCSS，符合 ESLint / Prettier 规范
- 🔍 **质量检测闭环**：自动化视觉对比 + 代码 Lint + 还原度评分
- 🔌 **模型可插拔**：每个 Agent 的模型都可独立指定，支持多厂商混部
- 📦 **一键导出**：ZIP 打包完整可运行 Next.js 项目
- 🔐 **完整用户体系**：注册登录、找回密码、Admin 后台、配额管理、使用统计
- 📚 **设计知识库**：内置 Apple / Tesla / Stripe / Linear / Gaming / Dashboard 六套设计风格档案

---

## 🏗️ 系统架构

```
                        ┌──────────────┐
                        │   用户输入    │
                        │   目标 URL   │
                        └──────┬───────┘
                               │
                               ▼
              ┌────────────────────────────────┐
              │ ① 网页抓取 Agent (Playwright)  │
              │   渲染 / DOM / 截图 / 资源    │
              └────────────────┬───────────────┘
                               │
                               ▼
              ┌────────────────────────────────┐
              │ ② 视觉分析 Agent (VL 模型)     │
              │   布局 / 字体 / 配色 / 组件    │
              └────────────────┬───────────────┘
                               │
                               ▼
              ┌────────────────────────────────┐
              │ ③ Design Token Agent (LLM)     │
              │   颜色/字号/间距/圆角/阴影     │
              └────────────────┬───────────────┘
                               │
                               ▼
              ┌────────────────────────────────┐
              │ ④ 架构规划 Agent (LLM)         │
              │   组件树 / Props / 状态设计    │
              └────────────────┬───────────────┘
                               │
                               ▼
              ┌────────────────────────────────┐
              │ ⑤ 代码生成 Agent (Coder LLM)   │
              │   React + TS + TailwindCSS     │
              └────────────────┬───────────────┘
                               │
                               ▼
              ┌────────────────────────────────┐
              │ ⑥ 质量检测 Agent (LLM + VL)    │
              │   视觉对比 / Lint / 评分       │
              └────────────────┬───────────────┘
                               │
                               ▼
                ZIP 导出 / 在线预览 / 继续优化
```

每个 Agent 的模型由用户在管理后台自由配置，支持百炼、MiMo、OpenAI、Anthropic、Gemini、DeepSeek 等多家厂商混合编排。

---

## 🛠️ 技术栈

| 类别 | 技术 |
|---|---|
| 前端框架 | Next.js 15（App Router）+ React 19 |
| 语言 | TypeScript 5 |
| 样式 | TailwindCSS + shadcn/ui |
| 数据库 | PostgreSQL（Supabase）+ Prisma ORM |
| 任务队列 | Redis + BullMQ（异步 Agent 执行） |
| 认证 | Auth.js（NextAuth v5） |
| 浏览器自动化 | Playwright |
| AI 模型 | 阿里云百炼 / MiMo / OpenAI / Anthropic / Gemini / DeepSeek |
| 部署 | Docker + Nginx + 阿里云 ECS |

---

## 🚀 快速开始

### 环境要求

- **Node.js** ≥ 18.18
- **pnpm** ≥ 8（推荐）或 npm ≥ 9
- **PostgreSQL** ≥ 14
- **Redis** ≥ 6
- 至少一个 AI 厂商的 API Key（[阿里云百炼](https://bailian.console.aliyun.com/) / [MiMo](https://api.xiaomimimo.com) / OpenAI / Anthropic / Gemini / DeepSeek 任一）

### 安装与运行

```bash
# 克隆仓库
git clone https://github.com/wx73306-create/code-designer-AI.git
cd code-designer-AI

# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env，至少填入 DATABASE_URL / REDIS_URL / AUTH_SECRET
# 并至少填入一个 AI 厂商的 API Key（如 ALIBABA_API_KEY）

# 数据库迁移
npx prisma migrate deploy
npx prisma db seed        # 可选：写入演示数据

# 启动开发服务器
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000) 即可看到首页。

### 环境变量说明

| 变量 | 说明 | 必填 |
|---|---|---|
| `DATABASE_URL` | PostgreSQL 连接串（推荐 Supabase） | ✅ |
| `REDIS_URL` | Redis 连接串（BullMQ 任务队列） | ✅ |
| `AUTH_SECRET` | NextAuth 会话密钥，`openssl rand -base64 32` 生成 | ✅ |
| `AUTH_URL` | 应用对外 URL，如 `http://localhost:3000` | ✅ |
| `AUTH_TRUST_HOST` | 反向代理场景设为 `true` | ✅ |
| `ALIBABA_API_URL` / `ALIBABA_API_KEY` | 阿里云百炼（主力模型） | ✅ 至少一个 |
| `MIMO_API_URL` / `MIMO_API_KEY` / `MIMO_MODEL` | MiMo（默认 `mimo-v2.5`） | ❌ |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `GOOGLE_API_KEY` | OpenAI / Anthropic / Gemini | ❌ |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | 管理后台登录凭据 | ✅ |
| `ADMIN_SESSION_SECRET` | 管理后台会话签名密钥 | ✅ |

---

## 📁 项目结构

```
code-designer-AI/
├── prisma/                          # Prisma schema + 迁移 + seed
├── public/
│   └── showcase/                    # 内置复刻样例（HTML 静态，应用运行时使用）
├── docs/                            # GitHub Pages 根目录（内置样例的预览版）
│   └── showcase/                    # 与 public/showcase 同源，供 Pages 预览
├── src/
│   ├── app/                         # Next.js App Router
│   │   ├── (auth)/                  # 登录 / 注册 / 找回密码
│   │   ├── (dashboard)/             # 用户工作台
│   │   ├── admin/                   # 管理后台（仪表盘 / 用户 / 模型 / 监控 / 费用）
│   │   ├── analysis/                # 复刻分析页
│   │   ├── api/                     # API 路由
│   │   └── page.tsx                 # 落地页
│   ├── components/
│   │   ├── landing/                 # Hero / AI 流程 / Agent 系统 / Showcase
│   │   ├── workspace/               # 工作台 v2
│   │   ├── workspace-v3/            # 工作台 v3（多面板布局 + AI Action Bar）
│   │   └── ui/                      # 基础 UI 组件
│   ├── lib/
│   │   ├── agents/                  # 六个 Agent 实现（capture / vision / designMemory / optimize / review / pipeline）
│   │   ├── prompts/                 # 各 Agent 的 prompt 模板
│   │   ├── knowledge-base/          # 设计风格档案（Apple / Tesla / Stripe ...）
│   │   ├── export/                  # 项目 ZIP 导出器
│   │   └── visual-evaluation/       # 视觉还原度评分
│   └── store/                       # Zustand 状态管理
├── deploy/                          # 一键部署脚本（Nginx + Docker + 打包）
├── Dockerfile
└── README.md
```

---

## 🎬 使用流程

1. **首页粘贴 URL** → 点击「开始复刻」
2. **自动执行六步流水线**，实时显示每个 Agent 进度
3. 在**工作台**查看视觉分析报告、Design Token、组件树、生成代码
4. 质检通过后，点击「**导出项目**」下载完整 Next.js ZIP
5. 在本地 `npm install && npm run dev` 即可启动还原出来的页面

---

## 📦 内置复刻样例

`docs/showcase/` 下预置了 5 个真实复刻案例，**点击下方链接即可在 GitHub Pages 上直接预览完整还原效果**：

| 样例 | 在线预览 |
|---|---|
| Apple Education | [apple-edu.html](https://wx73306-create.github.io/code-designer-AI/showcase/apple-edu.html) |
| Mercedes-Benz | [mercedes-benz.html](https://wx73306-create.github.io/code-designer-AI/showcase/mercedes-benz.html) |
| MSN | [msn.html](https://wx73306-create.github.io/code-designer-AI/showcase/msn.html) |
| NexusMind | [nexusmind.html](https://wx73306-create.github.io/code-designer-AI/showcase/nexusmind.html) |
| Vacheron Constantin | [vacheron.html](https://wx73306-create.github.io/code-designer-AI/showcase/vacheron.html) |

---

如果觉得项目对你有帮助，欢迎 ⭐ Star！

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

---

## ✨ 核心特性

- 🤖 **多智能体协作**：抓取 / 视觉 / Token / 架构 / 编码 / 质检 六个 Agent 各司其职、顺序触发
- 👁️ **视觉 + 语义双驱动**：截图视觉（qwen-vl-max）与 DOM 结构联合分析，还原度高于纯 DOM 解析
- 🎨 **Design Token 自动提取**：自动结构化输出颜色、字号、间距、圆角、阴影、动画曲线
- 🧩 **组件架构智能规划**：自动拆分组件树、设计 Props、规划状态与数据流
- 💻 **生产级代码生成**：输出 TypeScript + TailwindCSS，符合 ESLint / Prettier 规范
- 🔍 **质量检测闭环**：自动化视觉对比 + 代码 Lint + 还原度评分
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
              │ ② 视觉分析 Agent (qwen-vl-max) │
              │   布局/字体/配色/组件识别      │
              └────────────────┬───────────────┘
                               │
                               ▼
              ┌────────────────────────────────┐
              │ ③ Design Token Agent (qwen3)  │
              │   颜色/字号/间距/圆角/阴影     │
              └────────────────┬───────────────┘
                               │
                               ▼
              ┌────────────────────────────────┐
              │ ④ 架构规划 Agent (qwen3)       │
              │   组件树 / Props / 状态设计    │
              └────────────────┬───────────────┘
                               │
                               ▼
              ┌────────────────────────────────┐
              │ ⑤ 代码生成 Agent (qwen-coder)  │
              │   React + TS + TailwindCSS     │
              └────────────────┬───────────────┘
                               │
                               ▼
              ┌────────────────────────────────┐
              │ ⑥ 质量检测 Agent (qwen3+vl)    │
              │   视觉对比 / Lint / 评分       │
              └────────────────┬───────────────┘
                               │
                               ▼
                ZIP 导出 / 在线预览 / 继续优化
```

---

## 🧠 百炼模型调用链（核心）

> 所有 LLM 调用均通过**阿里云百炼**（DashScope 兼容接口 / `bl` CLI）。

| 智能体环节 | 使用模型 | 任务说明 | 调用方式 |
|---|---|---|---|
| ① 网页抓取 | Playwright（无 LLM） | 渲染目标页、导出 DOM / CSS / 截图 / 字体资源 | 本地服务 |
| ② 视觉分析 | **qwen-vl-max** | 截图识别布局结构、字体族、配色体系、组件边界 | DashScope 兼容 API |
| ③ Design Token 提取 | **qwen3-max** | 从视觉 + DOM 中结构化输出设计令牌（JSON Schema 强约束） | DashScope 兼容 API |
| ④ 组件架构规划 | **qwen3-max** | 拆分组件树、设计 Props 接口与状态归属 | DashScope 兼容 API |
| ⑤ React 代码生成 | **qwen-coder-plus** | 生成 React + TypeScript + TailwindCSS 代码 | DashScope 兼容 API |
| ⑥ 质量检测 | **qwen3-max + qwen-vl-max** | 代码 Lint / 视觉对比 / 还原度评分 | DashScope 兼容 API |
| 备用 Fallback | MiMo `mimo-v2.5`（可选） | 代码生成环节的 fallback | OpenAI 兼容 API |

**自定义技能：** `QoderWorkCN` —— 封装百炼模型调用链的本地技能，统一管理 Agent 调度、Token 计量与失败重试。

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
| AI 模型 | 阿里云百炼 · 通义千问 / 通义千问 VL / 通义千问 Coder |
| 部署 | Docker + Nginx + 阿里云 ECS |

---

## 🚀 快速开始

### 环境要求

- **Node.js** ≥ 18.18
- **pnpm** ≥ 8（推荐）或 npm ≥ 9
- **PostgreSQL** ≥ 14
- **Redis** ≥ 6
- **阿里云百炼 API Key**（[点此申请](https://bailian.console.aliyun.com/)）

### 安装与运行

```bash
# 克隆仓库
git clone https://github.com/wx73306-create/code-designer-AI.git
cd code-designer-AI

# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env，至少填入 ALIBABA_API_KEY / DATABASE_URL / REDIS_URL / AUTH_SECRET

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
| `ALIBABA_API_URL` | 百炼 DashScope 兼容 API 地址 | ✅ |
| `ALIBABA_API_KEY` | 百炼 API Key（主力模型） | ✅ |
| `MIMO_API_KEY` | MiMo API Key（代码生成 fallback） | ❌ |
| `MIMO_MODEL` | MiMo 模型名，默认 `mimo-v2.5` | ❌ |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | 管理后台登录凭据 | ✅ |
| `ADMIN_SESSION_SECRET` | 管理后台会话签名密钥 | ✅ |

---

## 📁 项目结构

```
code-designer-AI/
├── prisma/                          # Prisma schema + 迁移 + seed
├── public/
│   └── showcase/                    # 内置复刻样例（HTML 静态）
├── src/
│   ├── app/                         # Next.js App Router
│   │   ├── (auth)/                  # 登录 / 注册 / 找回密码
│   │   ├── (dashboard)/             # 用户工作台
│   │   ├── admin/                   # 管理后台（仪表盘 / 用户 / 模型 / 监控 / 费用）
│   │   ├── analysis/                # 复刻分析页
│   │   ├── api/                     # API 路由（workflow / quota / screenshot / ...）
│   │   └── page.tsx                 # 落地页
│   ├── components/
│   │   ├── landing/                 # Hero / AI 流程 / Agent 系统 / Showcase
│   │   ├── workspace/               # 工作台 v2
│   │   ├── workspace-v3/            # 工作台 v3（多面板布局 + AI Action Bar）
│   │   ├── ui/                      # 基础 UI（glass-card / progress / badge）
│   │   └── ...
│   ├── lib/
│   │   ├── agents/                  # 六个 Agent 实现
│   │   │   ├── captureAgent.ts
│   │   │   ├── visionAgent.ts
│   │   │   ├── designMemoryAgent.ts
│   │   │   ├── optimizeAgent.ts
│   │   │   ├── reviewAgent.ts
│   │   │   └── pipeline.ts          # 编排调度
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

`public/showcase/` 下预置 5 个真实复刻案例，可直接打开查看复刻效果：

| 样例 | 文件 |
|---|---|
| Apple Education | [`public/showcase/apple-edu.html`](public/showcase/apple-edu.html) |
| Mercedes-Benz | [`public/showcase/mercedes-benz.html`](public/showcase/mercedes-benz.html) |
| MSN | [`public/showcase/msn.html`](public/showcase/msn.html) |
| NexusMind | [`public/showcase/nexusmind.html`](public/showcase/nexusmind.html) |
| Vacheron Constantin | [`public/showcase/vacheron.html`](public/showcase/vacheron.html) |

---

## 🚢 部署

### Docker

```bash
docker build -t code-designer-ai .
docker run -d --name cda -p 3000:3000 --env-file .env code-designer-ai
```

### 阿里云 ECS 一键部署

参见 [`deploy/README.md`](deploy/README.md)，包含 Nginx 反代、systemd 守护、Let's Encrypt SSL 全套脚本。

---

## 🗺️ Roadmap

- [ ] 支持更多框架（Vue 3 / Svelte / Solid）
- [ ] 设计风格档案市场（用户上传自定义风格 JSON）
- [ ] 团队协作（多人编辑同一复刻项目 + 实时协同）
- [ ] Chrome 浏览器插件（一键复刻当前页面）
- [ ] 微调专用代码模型（基于 qwen-coder 微调网页还原专用版）

---

## 🤝 参与贡献

欢迎提 Issue / PR 改进任何一环（Agent prompt、组件模板、知识库、文档）。

```bash
# 提 PR 流程
git checkout -b feat/your-feature
git commit -m "feat: describe your change"
git push origin feat/your-feature
```

---

## 📄 License

[MIT](LICENSE) © 2025 吴Wxx

---

## 🙋 关于作者

**吴Wxx** · 全栈 / AI 工程方向

本项目参加 **阿里云百炼 × 通义 AI 开发者计划** 评选。

- GitHub: [@wx73306-create](https://github.com/wx73306-create)
- 提报百炼开发者计划：[点此加入](http://bailian.console.aliyun.com/opensource)

---

如果觉得项目对你有帮助，欢迎 ⭐ Star！

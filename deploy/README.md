# Code Designer AI 部署指南（腾讯云 Windows Server）

> 本指南基于旧版「阿里云 ECS 部署教程（零基础版）」修订而来：
> 把云厂商从阿里云换成**腾讯云**（`150.158.27.120`），并修掉了原教程的两个坑——
> ① 原教程完全没提 **Redis**（本应用用 BullMQ 队列 + 限流缓存，必须有 Redis）；
> ② 本项目的 `next.config.ts` 用了 `standalone` 输出，自动化脚本里 `.env` 位置和 Prisma 生成必须特殊处理。
>
> 推荐走 **方案 A（自动化）**；若你的服务器对 standalone 不友好（例如拉不到 Prisma 引擎二进制），用 **方案 B（手动兜底）**，流程与旧教程一致。

---

## 服务器信息

| 项目 | 值 |
|------|---|
| 云厂商 | 腾讯云（CVM / 轻量应用服务器） |
| IP | `150.158.27.120` |
| 系统 | Windows Server（建议 2022） |
| 配置建议 | 2 核 4G 以上，系统盘 40GB+ |
| 网站地址 | `http://150.158.27.120:3000` |
| 管理后台 | `http://150.158.27.120:3000/admin/login` |
| 项目路径 | `C:\deploy\app`（方案 A）/ `C:\code-designer-ai`（方案 B） |
| 数据库 | Supabase（PostgreSQL） |
| 缓存/队列 | Redis（BullMQ） |
| AI 模型 | MiMo + 阿里云百炼 |

> 仅用 IP 访问时**不需要 Nginx**，直接用 `:3000` 端口即可。要绑域名 + HTTPS 再配 `nginx.conf`（文末）。

---

# 方案 A：自动化部署（推荐）

## 第一步：本地打包（你的电脑上，项目根目录）

1. 确认 `.env.production` 里已填真实密钥（数据库 / `AUTH_SECRET` / `ADMIN_PASSWORD` / `MIMO_API_KEY` / `ALIBABA_API_KEY` / `AUTH_URL=http://150.158.27.120:3000` / `REDIS_URL=redis://127.0.0.1:6379`）。
2. 运行：
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\deploy\pack.ps1
   ```
   生成 `deploy/deploy.zip`（约 30–40MB，含 standalone 构建产物 + `.env` + 脚本）。

## 第二步：上传到服务器

1. 远程连接：`mstsc` 输入 `150.158.27.120`，用管理员账号登录（密码在腾讯云控制台设置/重置）。
2. 远程桌面里开启「本地资源 → 磁盘映射」，把 `deploy.zip` 拖到服务器 `C:\deploy\`（先建这个文件夹）。

## 第三步：腾讯云安全组放行端口（控制台操作）

实例详情 → 「防火墙 / 安全组」→「添加规则」，放行：

| 协议 | 端口 | 来源 | 策略 |
|------|------|------|------|
| TCP | 3000 | 0.0.0.0/0 | 允许 |
| TCP | 80 | 0.0.0.0/0 | 允许（用 Nginx 时） |
| TCP | 443 | 0.0.0.0/0 | 允许（用 HTTPS 时） |

> 轻量应用服务器叫「防火墙」，CVM 叫「安全组」，入口略有不同，效果一样。

## 第四步：服务器一键初始化

以**管理员身份**打开 PowerShell，运行：

```powershell
cd C:\deploy
powershell -ExecutionPolicy Bypass -File .\setup-server.ps1
```

脚本会自动完成：
1. 安装 Node.js 22 LTS
2. 安装 PM2 进程管理器
3. **安装并启动 Redis**（当 `.env` 中 `REDIS_URL` 指向本机 `127.0.0.1`/`localhost`；若指向腾讯云 Redis 托管实例则自动跳过）
4. **安装 Google Chrome**（截图功能依赖 `puppeteer-core`，需要外部浏览器；全新 Windows Server 默认没有，会自动装企业版 Chrome）
5. 解压应用到 `C:\deploy\app`
6. **在 `app` 内重装并 `prisma generate` + `prisma db push`**（修复 standalone 不含 Prisma Client 的坑）
7. 开放 Windows 防火墙 3000/80/443
8. `pm2 start server.js` 并设开机自启

## 第五步：验证

```powershell
pm2 status              # code-designer 应为 online
pm2 logs                # 看有无报错
redis-cli ping          # 本机 Redis 时返回 PONG
```

浏览器打开 `http://150.158.27.120:3000`。

---

# 方案 B：手动兜底（照搬旧教程已验证流程）

当方案 A 在你的服务器上异常（例如 standalone 包拉不到 Prisma 引擎、或你更想要“看得懂每一步”的部署）时使用。

## 1. 本地打包全源码

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy\pack-full.ps1
```

生成 `deploy/deploy-full.zip`（含完整源码，不含 `node_modules/.next`）。

## 2. 上传并解压

远程桌面把 `deploy-full.zip` 拖到服务器，解压到 `C:\code-designer-ai`（解压后根目录要有 `src`、`prisma`、`package.json`、`.env`）。

## 3. 安装依赖 + 初始化数据库

```cmd
cd C:\code-designer-ai
npm install --legacy-peer-deps
npx prisma generate
npx prisma db push
```

> 若 `npm install` 报 `ENOMEM`/`heap out of memory`（2G 内存常见），先执行：
> `set NODE_OPTIONS=--max-old-space-size=1024` 再装。

## 4. 构建

```cmd
npm run build
```

> 构建报内存不足：`set NODE_OPTIONS=--max-old-space-size=1536` 再构建。

## 5. 用 PM2 启动并设开机自启

```cmd
npm install -g pm2
pm2 start npm --name "code-designer" -- start
pm2 save
pm2 startup
```

`pm2 startup` 若提示你跑一条命令，复制执行即可。

## 6. 验证

同方案 A 第五步；浏览器开 `http://150.158.27.120:3000`。

---

## 日常运维命令

```powershell
pm2 status                     # 查看状态
pm2 logs                       # 看日志（排错）
pm2 restart code-designer      # 重启
pm2 stop code-designer         # 停止
# 更新应用：本机重新打包 → 上传新 zip 到 C:\deploy\ → 服务器再跑一次 setup-server.ps1（自动备份旧版本）
```

---

## 关于"密钥能不能提前写进包"（你问的 Supabase / 百炼 API）

**结论：已经写进包了，且是明文。** `pack.ps1` 会把项目根目录的 `.env.production` 原样复制成 `app/.env` 打进 `deploy.zip`。所以下面这些**真实值已经在包里**：

| 变量 | 状态 |
|------|------|
| `DATABASE_URL` | 已填（真实 Supabase 连接串，含数据库密码） |
| `ALIBABA_API_KEY` | 已填（真实百炼 Key） |
| `AUTH_SECRET` / `ADMIN_SESSION_SECRET` | 已填（随机密钥） |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | 已填（管理员登录凭据） |
| `MIMO_API_KEY` | **为空（这是设计如此）**：代码逻辑是"有 MiMo Key 用 MiMo，没有就回退到阿里云百炼（qwen-plus）"，所以空着 = 用百炼，无需填 |
| `REDIS_URL` | 已填（`redis://127.0.0.1:6379`，本机 Redis） |

**这意味着你不用在服务器上改任何环境变量，开箱即用。** 但有两个要点：

- ✅ **安全红线**：这个 zip 内含明文密钥（数据库密码、API Key、管理员密码）。**只传你自己那台服务器，绝不公开分享、绝不 `git add` 提交**（我们已把 `.env.production` 加进 `.gitignore`）。一旦泄露，立刻去 Supabase / 百炼控制台轮换密钥。
- 🔁 **如果你不想把明文密钥随包走**：可以改成"服务器上再填"——把 `pack.ps1` 里那行 `.env.production → app\.env` 改成复制一份**空模板**（只保留变量名、值留空），部署后再在服务器 `C:\deploy\app\.env` 里填。代价是部署时多一步手填。单_owner 自用场景，直接随包最省事。

> 其余可选变量（`OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `GOOGLE_API_KEY` / SMTP 邮件）代码里都有 `||` 兜底或默认值，**不填不影响核心功能**（邮件找回密码功能会不可用）。当前 `.env.production` 未包含它们，需要时再加即可。

---

## 浏览器依赖（截图功能必看）

- 应用"输入 URL 生成网站"依赖**截图**（`src/lib/screenshot.ts` 用 `puppeteer-core`）。
- `puppeteer-core` **不自带 Chromium**，必须有系统浏览器（Chrome / Edge），否则截图报 `No Chrome or Edge browser found`。
- 方案 A 脚本第 4 步会自动装 **Google Chrome 企业版**（默认路径 `C:\Program Files\Google\Chrome\Application\chrome.exe`，代码已内置该路径探测）。
- 若自动安装失败（服务器无外网）：手动装 Chrome/Edge，或在 `C:\deploy\app\.env` 加 `CHROME_PATH="浏览器exe完整路径"`。
- 方案 B 手动部署时，Chrome 也要自己装（同上）。

---

## Redis 说明（旧教程遗漏，必看）

- 应用用 **BullMQ（队列）** 和**限流缓存**，**必须**能连到 Redis，否则这些功能降级（代码有容错，不会直接崩，但缓存/队列失效）。
- 默认方案：方案 A 脚本在 Windows 上装 **tporadowski/redis** 并注册为服务（最简单）。
- 更稳的生产方案：在腾讯云买「云数据库 Redis」托管实例，把 `.env.production` 的 `REDIS_URL` 改成它的连接串（如 `redis://:密码@主机:6379`），脚本检测到非本机地址会**自动跳过**本地安装。

---

## 常见问题排查（整合自旧教程）

**Q: 访问 `http://150.158.27.120:3000` 打不开？**
1. `pm2 status` 确认进程 online；
2. 服务器本机浏览器开 `http://localhost:3000` 确认本地能起；
3. 检查腾讯云防火墙/安全组是否放行 3000；
4. 检查 Windows 防火墙（方案 A 脚本已自动开；手动可加）：
   `netsh advfirewall firewall add rule name="CodeDesignerAI" dir=in action=allow protocol=TCP localport=3000`

**Q: 数据库连接失败？**
- 确认 Supabase 项目没被暂停（免费版 7 天不活跃会暂停）；
- 确认 `DATABASE_URL` 中密码的特殊字符已 URL 编码（`@`→`%40`，`$`→`%24`）；
- 确认 Supabase 用的是 **Session 模式（端口 5432）**，不是 Transaction 模式（6543）。

**Q: AI 生成报 `Unauthorized` / `Insufficient balance`？**
- 登录阿里云百炼控制台检查 `ALIBABA_API_KEY` 是否有效、余额是否充足；
- 更新后重启：`pm2 restart code-designer`。

**Q: 服务器重启后网站没自动起？**
```cmd
cd C:\deploy\app        （方案 A）
pm2 resurrect
```
不行就手动：`pm2 start server.js --name "code-designer"`（方案 A）或 `pm2 start npm --name "code-designer" -- start`（方案 B），再 `pm2 save`。

**Q: 想更新代码？**
- 方案 A：本机重新 `pack.ps1` → 上传新 `deploy.zip` → 服务器重跑 `setup-server.ps1`（自动备份旧版）。
- 方案 B：上传新 `deploy-full.zip` 覆盖 `C:\code-designer-ai`（**保留 `.env` 别覆盖**）→ 重跑 `npm install --legacy-peer-deps` → `prisma generate` → `prisma db push` → `npm run build` → `pm2 restart code-designer`。

---

## ⚠️ 安全提醒

- `.env.production` 含**真实密钥**（数据库密码、API Key、管理员密码）。已加入 `.gitignore`，**切勿** `git add` 提交到公开仓库。
- 部署包 `deploy.zip` / `deploy-full.zip` 内含 `.env`（明文密钥），只传你自己的服务器，不要公开分享。
- 生产环境建议：腾讯云 Redis 托管 + Supabase 私有网络，并定期轮换密钥。

---

*修订日期：2026-08-03（基于 2026-08-02 旧版阿里云教程改编）*

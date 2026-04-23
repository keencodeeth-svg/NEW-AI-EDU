# Staging / Production 发布手册

更新时间：2026-04-05

适用目标：
- staging 预发验证
- production 正式发布
- 发布后 smoke 与失败回滚

## 1. 发布原则

- 先 staging，后 production。
- 任何发布都先执行本地质量门，再执行数据库迁移，再做健康检查与远端 smoke。
- `liveness` 只回答“服务是否存活”，`readiness` 回答“核心依赖是否可用”。
- `readiness` 不是公网裸露接口；生产环境必须使用管理员会话或 `READINESS_PROBE_TOKEN` 访问。

## 2. 发布前检查

本地代码检查：

```bash
corepack pnpm verify:strict
corepack pnpm test:smoke:production-like:local
```

当前基线说明：
- 2026-04-05 已通过 `corepack pnpm launch:readiness`，结果为 `pass 5 / warn 1 / fail 0`
- 唯一预警是当前环境为 `development`，严格 runtime guardrails 已由同日 `corepack pnpm test:smoke:production-like:local` 补充复核
- 若本次改动直接影响管理员配置、模型路由、巡检令牌或会话依赖，建议把 `corepack pnpm launch:readiness` 也纳入发布前固定步骤

如果本次变更直接影响浏览器关键流程、对象存储读写链路或 production-like 浏览器回归，再额外执行：

```bash
corepack pnpm test:browser:production-like:local
```

如果本次变更涉及学校排课 AI 预演 / 应用 / 回滚、模板、教师规则、禁排时段或相关运行时状态，再额外执行：

```bash
corepack pnpm test:school-schedules:production-like:local
```

如果当前机器没有可用 Docker daemon，但本机已有可复用 PostgreSQL，可改用：

```bash
PRODUCTION_LIKE_USE_EXISTING_DB=1 \
PRODUCTION_LIKE_DB_NAME=hangke_ai_edu_local \
PRODUCTION_LIKE_DB_RESET=1 \
corepack pnpm test:smoke:production-like:local
```

说明：
- 本地 production-like 脚本默认会创建隔离临时数据库，避免复跑时吃到上次残留状态。
- 只有在你需要固定数据库排障时，才显式设置 `PRODUCTION_LIKE_DB_NAME`；如果不希望复用旧数据，再额外设置 `PRODUCTION_LIKE_DB_RESET=1`。

环境检查：
- 已配置 `DATABASE_URL`
- 已配置对象存储根或外部对象存储
- standalone / 手工发布场景必须显式配置 release 外共享运行态目录：
  `DATA_DIR=/data/hk-ai-edu/runtime`
  `OBJECT_STORAGE_ROOT=/data/hk-ai-edu/objects`
- 生产环境必须关闭 `ALLOW_JSON_FALLBACK`
- staging / production 环境已配置 `READINESS_PROBE_TOKEN`
- 反向代理已放开长耗时 AI 路由超时，避免互动课堂生成在 60 秒左右被代理层提前打成 `504`
- 已准备远端 smoke 使用的管理员账号
- 已准备远端 smoke 读取的学校 ID（默认 `school-default`，可通过 `API_TEST_SMOKE_SCHOOL_ID` 覆盖）
- 已准备本次发布的 commit / tag / rollback 目标版本

推荐记录：
- 发布人
- 目标环境
- 发布版本 / commit SHA
- 预期变更点
- 回滚版本 / commit SHA

互动课堂代理超时基线：

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_connect_timeout 60s;
    proxy_send_timeout 600s;
    proxy_read_timeout 600s;
    send_timeout 600s;
}
```

说明：
- 学生自学 / 教师互动课堂的 `scene-content`、`scene-actions` 生成经常超过 60 秒。
- 仅配置 Next.js `maxDuration` 不够，若 Nginx 仍用默认超时，浏览器会先收到 `504`，而服务端还在后台继续生成。
- 线上域名 `https://eduai.net.cn` 已于 2026-03-27 按以上方式修复。

运行态目录基线：

```bash
DATA_DIR=/data/hk-ai-edu/runtime
OBJECT_STORAGE_ROOT=/data/hk-ai-edu/objects
```

说明：
- 不要把互动课堂快照、课堂任务队列或其他运行态 JSON 写回当前 release 目录。
- 若仍使用默认 `.runtime-data` 且目录位于 release 内，发版切换后旧的“全班观看”链接可能直接失效。
- 首次切到共享 `DATA_DIR` 后，需要把历史 release 中的 `data/classrooms/*.json` 迁移到 `$DATA_DIR/classrooms/`，否则旧课堂公开链接仍会丢失。
- 线上 `https://eduai.net.cn` 已于 2026-03-28 切到共享 `DATA_DIR`，并补做过历史课堂快照迁移。

## 3. Staging 发布步骤

1. 优先使用仓库内预构建发布脚本，避免在低内存主机上远端 `next build`：

```bash
DEPLOY_REMOTE_HOST=root@staging.example.com \
DEPLOY_EXTERNAL_HEALTH_URL=https://staging.example.com/api/health \
corepack pnpm deploy:remote:prebuilt
```

脚本默认行为：
- 本地先执行自动识别包管理器的构建命令；当前仓库默认是 `corepack pnpm build`
- 以 `.next/standalone` 为 release 根目录，再补上 `.next/static`
- 默认剔除 release 内的 `.runtime-data`、`tests`、`docs`、`output`，避免把运行态数据和无关资产一并上传
- 上传 release 包到远端并恢复远端 `.env.production`
- 远端默认不再执行依赖安装，而是直接复用 standalone 内已 vendored 的运行时依赖
- 远端默认执行 `node scripts/init-db.mjs`、`3001` canary、`3000` 正式切流
- 若 `.env.production` 内存在 `READINESS_PROBE_TOKEN`，会额外校验 readiness

脚本前提：
- 工作区默认必须干净；如要显式部署未提交改动，需设置 `DEPLOY_ALLOW_DIRTY=1`
- 远端需要保留稳定的环境文件，默认路径 `/var/www/HK-AIEDU/.env.production`
- 远端已安装 `pm2`
- Next.js 生产构建必须生成 `.next/standalone/server.js`

常用覆盖项：

```bash
DEPLOY_REMOTE_HOST=root@staging.example.com \
DEPLOY_REMOTE_ENV_SOURCE=/srv/hk-ai-edu/.env.production \
DEPLOY_PM2_APP_NAME=hk-ai-edu-staging \
DEPLOY_CANARY_APP_NAME=hk-ai-edu-staging-canary \
DEPLOY_REMOTE_PRODUCTION_PORT=3100 \
DEPLOY_REMOTE_CANARY_PORT=3101 \
corepack pnpm deploy:remote:prebuilt
```

`DEPLOY_SKIP_BUILD=1` 使用说明：
- 仅当当前工作区内现有 `.next` 产物与本次要发布的应用代码完全一致时才安全。
- 脚本即使跳过构建，仍会把最新的 `scripts`、`db`、`public`、`data`、`configs`、`assets`、`package.json` 覆盖进 release 包。
- 但这不意味着页面、路由、Server Component、Client Component 或 API 处理逻辑的代码变更可以跳过重新构建；只要这些代码有改动，就必须先重新执行一次构建，再发布。

2. 确认迁移已执行；若这次不是通过脚本发布，再手工执行：

```bash
corepack pnpm db:migrate
```

3. 检查健康接口：

```bash
curl -fsS https://staging.example.com/api/health
curl -fsS -H "x-readiness-token: $READINESS_PROBE_TOKEN" https://staging.example.com/api/health/readiness
```

4. 执行远端 smoke：

```bash
API_TEST_BASE_URL=https://staging.example.com \
API_TEST_READINESS_TOKEN=$READINESS_PROBE_TOKEN \
API_TEST_ADMIN_EMAIL=admin@demo.com \
API_TEST_ADMIN_PASSWORD=Admin123 \
API_TEST_SMOKE_SCHOOL_ID=school-default \
corepack pnpm test:smoke:remote
```

5. 如需只做依赖健康验证，可执行：

```bash
API_TEST_BASE_URL=https://staging.example.com \
API_TEST_READINESS_TOKEN=$READINESS_PROBE_TOKEN \
API_TEST_SCOPE=health \
API_TEST_SERVER_MODE=remote \
API_TEST_FALLBACK_TO_DEV=0 \
node scripts/test-api-routes.mjs
```

6. 通过后记录结果，再进入 production。

## 4. Production 发布步骤

1. 确认 staging smoke 通过，且未发现阻塞项。
2. 使用同一条预构建脚本部署相同 commit 到 production：

```bash
DEPLOY_REMOTE_HOST=root@prod.example.com \
DEPLOY_EXTERNAL_HEALTH_URL=https://prod.example.com/api/health \
corepack pnpm deploy:remote:prebuilt
```

3. 确认迁移已执行；若这次不是通过脚本发布，再手工执行：

```bash
corepack pnpm db:migrate
```

4. 检查健康接口：

```bash
curl -fsS https://prod.example.com/api/health
curl -fsS -H "x-readiness-token: $READINESS_PROBE_TOKEN" https://prod.example.com/api/health/readiness
```

5. 执行远端 smoke：

```bash
API_TEST_BASE_URL=https://prod.example.com \
API_TEST_READINESS_TOKEN=$READINESS_PROBE_TOKEN \
API_TEST_ADMIN_EMAIL=admin@demo.com \
API_TEST_ADMIN_PASSWORD=Admin123 \
API_TEST_SMOKE_SCHOOL_ID=school-default \
corepack pnpm test:smoke:remote
```

6. 检查管理端关键面板：
- `/admin/logs`
- `/admin/experiments`
- `/admin/ai-models`

7. 记录结果并确认是否放量。

## 5. GitHub Actions 手工 smoke

工作流：`.github/workflows/release-smoke.yml`

前置条件：
- GitHub `staging` / `production` environment 中都已配置 `READINESS_PROBE_TOKEN` secret
- 如默认管理员账号或学校 ID 不适用，额外配置：
  - `API_TEST_ADMIN_PASSWORD` secret
  - `API_TEST_ADMIN_EMAIL` variable
  - `API_TEST_SMOKE_SCHOOL_ID` variable

使用方式：
1. 进入 Actions -> `Release Smoke`
2. 选择 `target`：`staging` 或 `production`
3. 填写 `base_url`
4. 选择 `scope`：默认 `smoke`
5. 运行后查看 job log 与 summary

适用场景：
- 发布后由值班同学执行一次标准 smoke
- 手工回滚后快速复验

## 6. Smoke 覆盖范围

当前远端 smoke 覆盖：
- `GET /api/health`
- `GET /api/health/readiness`
- `GET /api/auth/password-policy`
- 学生注册
- 学生登录
- `GET /api/auth/me`
- 学生登出
- 管理员登录
- `GET /api/school/schedules?schoolId=$API_TEST_SMOKE_SCHOOL_ID`
- 管理员登出

远端 smoke 前提：
- 目标环境存在可登录管理员账号；未显式传参时默认使用 `admin@demo.com` / `Admin123`
- 目标环境存在可读取学校数据；未显式传参时默认使用 `school-default`

限制：
- 远端模式默认只允许 `smoke` / `health`
- 若要对已部署环境运行全量 API 套件，必须显式设置 `API_TEST_ALLOW_REMOTE_FULL=true`

## 7. 回滚步骤

触发条件：
- 迁移失败
- `readiness` 返回非 200 / `ready=false`
- 远端 smoke 失败
- 管理端关键面板不可用

回滚动作：
1. 停止继续放量。
2. 回退到上一个稳定版本。
3. 若本次迁移包含不可兼容变更，按数据库回滚预案执行。
4. 回滚后重新检查：

```bash
curl -fsS https://target.example.com/api/health
curl -fsS -H "x-readiness-token: $READINESS_PROBE_TOKEN" https://target.example.com/api/health/readiness
API_TEST_BASE_URL=https://target.example.com \
API_TEST_READINESS_TOKEN=$READINESS_PROBE_TOKEN \
API_TEST_ADMIN_EMAIL=admin@demo.com \
API_TEST_ADMIN_PASSWORD=Admin123 \
API_TEST_SMOKE_SCHOOL_ID=school-default \
corepack pnpm test:smoke:remote
```

5. 在发布记录中补齐：
- 故障开始时间
- 发现方式
- 回滚完成时间
- 影响范围
- 后续修复负责人

## 8. 发布记录模板

```text
环境：
版本：
发布人：
开始时间：
完成时间：
db:migrate：
health：
readiness：
remote smoke：
是否回滚：
备注：
```

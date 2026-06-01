# Strict Testing Baseline

更新时间：2026-06-01

目标：把“开发时建议跑测试”升级为“开发与合并默认执行同一条严格质量门”。

## 1. 统一门禁

本地与 CI 的统一严格门为：

```bash
corepack pnpm verify:strict
```

执行顺序：

1. `corepack pnpm lint`
2. `corepack pnpm check:i18n-keys`
3. `corepack pnpm check:project-snapshot`
4. `corepack pnpm build`
5. `corepack pnpm test:unit`
6. `corepack pnpm test:api`
7. `corepack pnpm test:a11y`
8. `corepack pnpm test:browser:built`

说明：

- `corepack pnpm test` 仍保留为快速门，只覆盖 `unit + api`
- `verify:strict` 才是后续开发默认必须通过的完整门禁
- CI 已收口到 `strict-verify` job，避免“分散绿灯但整链未验证”的假通过

最近一次本地严格验证基线：

- 2026-04-05 已通过 `corepack pnpm verify:strict`
- 2026-04-05 已通过 `corepack pnpm launch:readiness`
- 2026-04-05 已通过 `corepack pnpm test:smoke:production-like:local`
- `launch:readiness` 当前结果为 `pass 5 / warn 1 / fail 0`，唯一预警是当前环境仍为 `development`，未启用严格 runtime guardrails；同日已用 production-like local smoke 完成补充复核

## 2. 当前覆盖面评估

当前已经自动化覆盖的层次：

- 静态与类型层：`lint + build`
- 纯逻辑层：`tests/unit/*`
- API 集成层：`scripts/test-api-routes.mjs`
- 浏览器关键链路与 a11y：`tests/browser/*.spec.ts`
- production-like 部署基线：CI 中带 PostgreSQL + 对象存储根路径的 smoke + browser smoke + 学校排课深回归
- 本地 production-like 复现入口：`corepack pnpm test:smoke:production-like:local`
- 本地 production-like 浏览器复现入口：`corepack pnpm test:browser:production-like:local`
- 本地学校排课深回归入口：`corepack pnpm test:school-schedules:production-like:local`
- 部署后远端验证：`release-smoke.yml`

本地 production-like 入口额外保证：

- 自动复制临时 `DATA_SEED_DIR`，并剔除高频 JSON 运行态文件，避免 readiness 被仓库遗留 seed 文件污染
- 自动隔离临时 `DATA_DIR` / `OBJECT_STORAGE_ROOT`，避免 smoke 回写污染工作区
- 默认创建隔离临时数据库，避免本地重复执行时复用上一次 production-like 测试残留状态
- 可通过 `PRODUCTION_LIKE_USE_EXISTING_DB=1` 直接复用本机 PostgreSQL，绕过 Docker 首次拉镜像成本
- 如需固定数据库名，可显式设置 `PRODUCTION_LIKE_DB_NAME`；如需每次清空固定库，再配合 `PRODUCTION_LIKE_DB_RESET=1`

当前 API smoke 已覆盖：

- `GET /api/health`
- `GET /api/health/readiness`
- `GET /api/auth/password-policy`
- 学生注册
- 学生登录
- `GET /api/auth/me`
- 学生登出
- 管理员登录
- 只读拉取学校课表概览：`GET /api/school/schedules?schoolId=$API_TEST_SMOKE_SCHOOL_ID`
- 管理员登出

当前 API smoke 前提：

- 默认管理员账号为 `admin@demo.com` / `Admin123`，可通过 `API_TEST_ADMIN_EMAIL`、`API_TEST_ADMIN_PASSWORD` 覆盖
- 默认课表学校为 `school-default`，可通过 `API_TEST_SMOKE_SCHOOL_ID` 覆盖
- 远端环境需要预先存在可登录管理员与可读取学校数据；本地 production-like 入口会自动执行 `seed:base + seed:stage3`

当前学校排课 production-like API 回归已覆盖：

- 课表模板保存与查询
- 教师禁排时段保存与查询
- 锁定节次保护
- AI 预演、应用、最新操作查询、回滚
- 教室冲突检测
- 教师周课时上限、连堂上限、跨校区间隔规则

当前学校排课 production-like API 回归入口：

- 默认本地入口：`corepack pnpm test:school-schedules`
- DB-only / object-storage 本地入口：`corepack pnpm test:school-schedules:production-like:local`
- CI 入口：`.github/workflows/ci.yml` 中的 `production-like-regression` job 会顺序执行 `test:smoke:production-like`、`test:browser:production-like` 与 `test:school-schedules:production-like`
- 可通过 `API_TEST_SCHOOL_ID` 覆盖默认学校，未设置时回退到 `school-default`

当前浏览器 smoke 已覆盖：

- 首页角色入口不再依赖学生默认路径，学生 / 教师 / 家长 / 学校 / 管理员都能从首屏进入自己的入口
- 学生登录并进入学习控制台
- 学生登录后可直达 `/practice`，练习页保留认证壳层、主题切换和 `#main-content`
- 家长登录后可直达 `/parent`，家长空间保留认证壳层、主题切换和今晚第一步 CTA
- 学校管理员登录后可直达 `/school`，学校质量视图保留认证壳层、主题切换和课堂质量 / 课程表 CTA
- 公开用户可直达 `/ai-classroom`，空需求时开课按钮禁用，填写课堂需求后可启动
- 教师发布作业
- 教师从 AI 工具页带班级上下文发起互动课堂
- 家长提交行动回执
- 家长发送鼓励卡片，学生首页可见并可标记已读
- 教师生成 AI 备课方案并打开课堂实时仪表盘
- 教师创建展示项目后，学生完成项目式学习阶段提交
- 用户提交账号恢复请求
- 管理员异常登录后收到安全告警通知
- 用户连续登录失败后被临时锁定
- 学生完成老师发布考试并提交
- 学生发起自主互动课堂并生成个性化主题
- 学生上传作业附件并由教师在批改页读取 / 下载
- 管理员在工单台接单并解决恢复请求
- 管理员完成资料库文件上传、下载与分享
- 学校管理员完成排课 AI 预演、写入与回滚
- 学校管理员打开互动课堂治理中心并读取交付数据
- 学校管理员组织边界隔离
- 管理员高风险操作 `step-up`
- 教师会话越权访问 admin API 被拦截

当前浏览器 a11y 回归已覆盖：

- 公开入口页：`/`、`/login`、`/register`、`/recover` zero critical / serious accessibility violations
- 学生主线与课堂入口：`/student`、`/practice`、`/student/interactive-classroom`、`/ai-classroom` zero critical / serious accessibility violations
- 教师工作台与课堂实时页：`/teacher`、`/teacher/classroom-live` zero critical / serious accessibility violations
- 学校与管理治理页：`/school`、`/school/interactive-classrooms`、`/admin` zero critical / serious accessibility violations
- 家长与第一批 P1 高价值页：`/parent`、`/library`、`/teacher/lesson-planner` zero critical / serious accessibility violations
- 键盘首个 Tab 可达 `skip-link`，并能跳到 `#main-content`
- 主题切换控件存在基础 ARIA 契约：`role=group`、可感知标签、按钮 `aria-pressed`

当前本地视觉巡检已覆盖：

- 公开页与登录后关键页桌面 / 移动视口截图落盘
- JSON 巡检报告包含 `http status`、横向溢出、主题切换、关键壳层存在 / 不存在断言
- 任一路由断言失败默认直接非零退出，不再是“有截图但门禁仍通过”
- 默认输出仍兼容 `output/playwright/*`，但可通过环境变量覆盖截图目录、报告路径与基线路径
- 当前稳定覆盖矩阵为 16 条路由：`/`、`/login`、`/register`、`/recover`、`/ai-classroom`、`/student`、`/practice`、`/student/interactive-classroom`、`/student/exams`、`/teacher`、`/teacher/classroom-live`、`/teacher/lesson-planner`、`/parent`、`/school`、`/school/interactive-classrooms`、`/admin`
- visual report 现在额外输出 coverage summary：`16 routes x 2 viewports x 2 themes = 64 checks`，并按 session 汇总为 `public 5`、`student 4`、`teacher 3`、`parent 1`、`school 2`、`admin 1`
- `parent/school/admin` 使用脚本内 API 注册 / 登录链路建立隔离会话，不依赖认证页 UI 提交流程；`parent` 额外注入最小学生观察码 + 教师作业数据，保证进入真实工作台
- `student/interactive-classroom`、`/student/exams`、`/teacher/lesson-planner` 与 `/school/interactive-classrooms` 已复用现有角色隔离会话进入 visual route matrix；`/classroom/[id]` 仍需动态课堂 id，暂不纳入本批稳定矩阵

视觉巡检本地入口：

- `corepack pnpm test:visual`
- 可通过 `VISUAL_CHECK_BASE_URL` 覆盖目标地址
- 可通过 `VISUAL_CHECK_SCREENSHOT_DIR`、`VISUAL_CHECK_REPORT_PATH`、`VISUAL_CHECK_BASELINE_PATH` 定制产物路径
- 可通过 `VISUAL_CHECK_MAX_FAILURES` 放宽允许失败数，默认 `0`
- `corepack pnpm test:a11y` 默认拦截 `critical + serious`；`test:a11y:serious` 仅保留为兼容别名

当前浏览器 smoke 还额外执行三条严格约束：

- Playwright 启动的内置服务统一带 `API_TEST_SCOPE=playwright`，默认显式清空 `DATABASE_URL`、设置 `REQUIRE_DATABASE=false` 与 `ALLOW_JSON_FALLBACK=true`，与 API 集成测试使用同一类隔离测试运行时契约，避免本机 `.env.local` 误连真实数据库；`PLAYWRIGHT_FORCE_PRODUCTION_LIKE=true` 时仍切回 `REQUIRE_DATABASE=true + ALLOW_JSON_FALLBACK=false`
- 任一同源 `/api/*` 请求若返回 `4xx/5xx`，浏览器 smoke 将直接失败，不再允许“页面看起来通过但后台已经报错”
- CI 额外执行 `production-like-regression`，在 `DATABASE_URL + REQUIRE_DATABASE=true + ALLOW_JSON_FALLBACK=false + OBJECT_STORAGE_ROOT` 下先跑最小 smoke，再跑浏览器 smoke 与学校排课深回归

## 3. 仍然存在的严格测试缺口

这些缺口不影响当前严格门启用，但应作为后续新增测试的最高优先级：

- 其余对象存储读写链路仍缺浏览器级回归，当前只覆盖资料库与作业附件两条代表性路径
- 大页新抽出的页级 hook 主要靠 `build` 保证类型正确，缺少针对状态迁移的定向单测

## 4. 后续开发规则

- 任何影响工作台主流程、权限、提交流程、AI 结果回写的改动，提交前默认跑 `corepack pnpm verify:strict`
- 任何涉及登录、权限、管理员操作、家长回执、作业/考试提交的改动，优先补浏览器或 API 回归，不只补单测
- 任何涉及生产运行时状态迁移的改动，优先补 API 集成测试，不接受只靠手测
- 发布前除本地严格门外，仍需执行远端 smoke

## 5. 建议下一步

优先补这两项：

1. 其余对象存储读写链路的浏览器级回归
2. 大页新抽出 hook 的状态迁移定向单测

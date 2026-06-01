# P0-P2 满分优化路线图

更新时间：2026-06-01

用途：把全项目 P0 / P1 / P2 优化从“任务清单”升级成可评分、可验收、可回归的产品治理路线图。后续所有优化目标都按本页推进：每个指标都要有当前证据、满分定义、优先级、验收命令和复盘记录。

相关入口：

- `docs/world-class-product-assessment-2026-04-04.md`
- `docs/project-readiness-index.md`
- `docs/p0-productization-checklist.md`
- `docs/p0-optimization-task-cards.md`
- `docs/p1-p2-feature-task-cards.md`
- `docs/strict-testing-baseline.md`
- `docs/staging-production-release-runbook.md`

---

## 1. 满分原则

本项目后续不再只以“功能存在”为完成标准，而以“世界级教育 AI 产品”的证据链为完成标准。

- `10/10`：真实用户能高效完成任务，页面有统一品牌气质，AI 能力可信，测试能稳定复验，发布可回滚，合规风险可解释。
- `P0`：阻断 release candidate 的问题。包括可信入口、真实数据边界、核心角色链路、可访问性、视觉门禁、发布门禁和用户可见品牌残留。
- `P1`：阻断高质量试点的问题。包括信息架构、课堂叙事、角色体验、状态一致性、表单/对话框体验、测试覆盖扩容。
- `P2`：世界级差异化问题。包括全路由覆盖台账、像素级视觉回归、学习效果证据、产品创新、跨端连续性、运营智能化。
- 每个优化 PR 都要更新本页或相关任务卡：变更了什么、影响哪个指标、如何验收、当前分数是否提高。

评分不是主观口号。任何“已满分”判断都必须同时具备：

- 至少 1 条真实用户路径说明
- 至少 1 条自动化验证或可复验手工验收记录
- 桌面与移动截图，且覆盖浅色 / 暗色模式
- 无阻断级可访问性问题
- 无用户可见旧品牌、demo、内部任务标签或测试环境心智

---

## 2. 总体指标表

当前参考分沿用 `docs/world-class-product-assessment-2026-04-04.md` 的基线，并纳入 2026-06-01 多代理只读审计结论。分数用于排优先级，不代表永久事实；每轮优化完成后必须用最新证据刷新。

| 指标 | 当前参考分 | 满分定义 | 当前最大缺口 | 优先级 |
| --- | ---: | --- | --- | --- |
| 产品理念与教学效果 | 8.7/10 | 每个 AI 能力都服务“学前准备、课堂学习、课后巩固、成长反馈”的闭环，并能解释给学生、教师、家长和学校 | AI 课堂叙事仍偏“工具区 / 导出 / 数字人配置”，教学结果表达不足 | P1 |
| 多角色信息架构 | 6.8/10 | 学生、教师、家长、学校、管理员都能 1 次点击进入自己的主线，且首屏知道下一步 | 首页与公开入口仍有“学生默认 / demo 暴露 / 非学生先走学生路径”的历史心智 | P0 |
| UI 视觉系统与品牌独立性 | 7.0/10 | 统一 logo、色彩、排版、组件、空态、动效和深浅主题；外部用户看不到旧项目或开源模板痕迹 | 对外健康检查与公开认证占位已收口；历史本地库名、兼容头像文件、旧文档命名仍需迁移策略 | P0 |
| 学生体验 | 7.0/10 | 学生看到的是“今天学什么、为什么学、学完去哪”，降级体验不伪装成真实个性化 | 学生互动课堂降级文案会使用默认学习档案，可信度不足 | P0 |
| 教师体验 | 7.1/10 | 教师从备课到课堂到课后追踪有一条连续主线，AI 输出可审、可改、可复用 | AI 课堂入口仍偏生成器，教学对象、目标、课后去向不够突出 | P1 |
| 家长 / 学校 / 管理端体验 | 6.8/10 | 家长看孩子变化，学校看质量治理，管理员先处理风险与异常，而不是看功能卡片墙 | 管理端首屏仍像通用后台，学校与家长入口的任务优先级还需更清楚 | P0 |
| AI 质量、安全与教学可信度 | 6.7/10 | AI 输出有任务意图、模型路由、审计、降级、风险提示和人工复核；不会虚构真实画像 | 体验模式、Provider、模型链和生成任务还需要更严格证据化 | P0/P1 |
| 技术架构与可维护性 | 6.9/10 | 页面只做 composition，业务分层清晰，核心 AI 任务服务端编排，低频 fallback 有防回退机制 | 大页面和复杂 hook 仍是维护热点，部分生成链路仍有浏览器态惯性 | P1 |
| 测试、可访问性与视觉回归 | 7.2/10 | 核心页默认 `critical=0` 且 `serious=0`，全角色视觉门禁覆盖 light/dark + desktop/mobile，79 个页面有覆盖台账 | a11y 默认门禁已提升到 serious；视觉脚本当前更像壳层检查，覆盖页数仍不足 | P0 |
| 发布、运维与合规 | 7.3/10 | 发布前 readiness、远端 smoke、证书、密钥、回滚、第三方许可与 NOTICE 都有证据 | strict readiness 已成为固定入口；公网 HTTPS 检查进入自动回滚窗口、只读生产 smoke 与证书门禁仍需继续固化 | P0/P1 |

---

## 3. 本轮多代理审计已归档结论

### 3.1 产品审计

产品子代理结论：项目方向正确，学生、教师、家长、学校四条主线正在收敛到“先告诉用户下一步”，但公开入口、管理端和 AI 课堂仍有 demo / 工具台 / 开源后台气质。

最需要进入 P0 的问题：

- 首页不应要求教师、家长、学校管理员先用学生入口理解平台主线。
- 登录页不应公开内部演示账号，也不应使用 `demo.com`、`Student123` 一类测试占位。
- 学生 AI 课堂后端异常时，不能用“默认学习档案”伪装个性化。
- 管理端首页不能继续以通用后台卡片墙和内部 `P0` 标签作为主要视觉。

### 3.2 注册 / 找回入口审计

前端子代理结论：`/register` 与 `/recover` 已可用，但信息架构和可访问性落后于 `/login`。

需要进入 P0 / P1 的问题：

- `/register` 要补齐语义字段：`type`、`autocomplete`、`required`、`aria-*`。
- 错误反馈需要 `role="alert"` 或 `aria-live`。
- 注册成功后必须给清晰下一步，而不是只写“注册成功，请登录”。
- `/recover` 的角色卡片需要与登录页一致的 `radiogroup` / `radio` 语义和键盘体验。
- 浏览器 a11y 需要加入 `/register` 与 `/recover`。

### 3.3 QA / 可访问性审计

QA 子代理结论：当前不是没有测试，而是 UIUX 优化范围已经超过视觉与 a11y 门禁覆盖范围。

已知静态盘点：

- `app/**/page.tsx` 共 `79` 个页面路由。
- `scripts/visual-check-local.mjs` 已推进到按 `route + viewport + theme` 产出独立 screenshot/report 项，当前稳定覆盖 14 个路由：`/`、`/login`、`/register`、`/recover`、`/ai-classroom`、`/student`、`/practice`、`/student/interactive-classroom`、`/teacher`、`/teacher/classroom-live`、`/parent`、`/school`、`/school/interactive-classrooms`、`/admin`。
- `tests/browser/a11y.spec.ts` 当前 Axe 产品页覆盖 13 个直接路由：`/`、`/login`、`/register`、`/recover`、`/student`、`/practice`、`/teacher`、`/teacher/classroom-live`、`/ai-classroom`、`/student/interactive-classroom`、`/admin`、`/school`、`/school/interactive-classrooms`。
- `tests/browser/smoke.spec.ts` 当前归一化触达 25 条页面路由，但主要是业务 smoke，不等价于 UI 门禁。

必须进入 P0 的质量门：

- 核心入口与沉浸页要 100% 覆盖 visual + a11y。
- 默认 Axe 门禁已提升到 `critical=0` 且 `serious=0`，后续要继续扩大路由覆盖。
- 核心已登录页要验证共享壳层契约：`skip-link`、`#main-content`、桌面侧栏、移动 tabbar、主题切换、无横向溢出。
- 视觉检查要从“截图留档 + 壳层指标”逐步升级到可维护的 baseline / diff 门禁。

### 3.4 品牌出口清理进展

2026-06-01 本轮已推进 P0-5 的低风险切片：

- `/api/health` 与 `/api/health/readiness` 的 `service` 字段改为复用统一产品服务名，避免对外健康检查继续暴露旧 service name。
- 管理员、教师、学校管理员注册页与账号恢复页不再使用 `@demo.com`、`默认学校`、`知序实验学校` 一类用户可见占位文案。
- 新增 `tests/unit/public-brand-hygiene.test.ts`，防止公开认证入口重新出现 demo 邮箱或占位学校文案。

仍不在本轮处理：

- `Hangke-Interactive-Classroom-Database`、`hangke_ai_edu_*` 等历史本地数据库 / 脚本名称，需要兼容迁移方案，不能直接重命名。
- `public/avatars/hangke-*.svg` 等兼容素材路径，需要先确认历史课堂、导出物和保存画像是否仍引用。
- 第三方许可、NOTICE 与历史合规记录必须保留并持续更新，不能作为品牌清理目标删除。

---

## 4. P0：发布候选前必须清零

P0 的目标不是“再好看一点”，而是清除会让产品显得不可信、不完整或不可发布的问题。

| 编号 | 优化项 | 涉及路径 | 满分验收 |
| --- | --- | --- | --- |
| P0-1 | 公开入口改成多角色可信入口 | `app/_components/HomeHeroSection.tsx`、`app/home.data.ts`、`app/login/page.tsx`、`app/login/useLoginPage.ts` | 首页首屏不再暗示非学生先走学生路径；登录页不公开 demo 账号；所有角色能 1 次点击进入自己的登录 / 注册 / 恢复入口；`/`、`/login`、`/register`、`/recover` 有 light/dark + desktop/mobile 截图 |
| P0-2 | 注册与找回账号补齐语义和可访问性 | `app/register/page.tsx`、`app/register/useRegisterPage.ts`、`app/recover/page.tsx`、`app/recover/useRecoverPage.ts`、`tests/browser/a11y.spec.ts` | 表单字段有正确 `type` / `autocomplete` / `required`；错误和成功状态可被屏幕阅读器读出；角色卡片支持键盘；成功态有明确下一步 CTA；a11y 覆盖 `/register` 与 `/recover` |
| P0-3 | 学生 AI 课堂降级不伪装个性化 | `app/student/interactive-classroom/page.tsx` | 后端异常时明确标注体验模式；说明真实画像、任务、课表未接入；不再使用“默认学习档案”制造真实个性化印象；CTA 与结果页都带体验模式边界 |
| P0-4 | 管理端从后台卡片墙改成 action-first 工作台 | `app/admin/page.tsx`、`app/admin/ai-models/page.tsx`、`app/admin/launch-readiness/page.tsx` | 首屏回答“今天先处理异常、内容还是发布风险”；内部 `P0`、`A/B` 等标签不作为用户主要视觉；管理员可从首屏进入 readiness、模型链、恢复工单和异常处理 |
| P0-5 | 用户可见品牌与旧开源痕迹清理 | `components/RoleSidebarNav.tsx`、`components/brand/*`、`public/logos/*`、`lib/health.ts`、全局文案 | 对外健康检查与公开认证占位已清理并加单测；下一步继续清理用户可见旧 logo / 旧项目名，同时为内部 key 与兼容素材制定迁移方案；第三方许可和 NOTICE 不被删除 |
| P0-6 | 核心页深浅主题门禁 | `app/layout.tsx`、`components/ThemeModeToggle.tsx`、`scripts/visual-check-local.mjs`、`tests/browser/a11y.spec.ts` | `/`、`/login`、`/student`、`/teacher`、`/parent`、`/school`、`/admin`、`/practice`、`/ai-classroom`、`/student/interactive-classroom`、`/teacher/classroom-live`、`/school/interactive-classrooms`、`/classroom/[id]` 全部覆盖 light/dark + desktop/mobile |
| P0-7 | a11y 默认拦截 serious | `tests/browser/a11y.spec.ts`、`tests/browser/a11y-policy.ts`、`tests/unit/a11y-severity-policy.test.ts`、`package.json`、`docs/strict-testing-baseline.md` | 核心页 Axe 默认 `critical=0` 且 `serious=0`；`test:a11y:serious` 仅保留为兼容别名；`verify:strict` 明确包含严口径 a11y |
| P0-8 | 发布前 readiness 与远端 smoke 固定化 | `scripts/launch-readiness-report.mjs`、`scripts/post-deploy-smoke.mjs`、`scripts/deploy-prebuilt-remote.sh`、`docs/staging-production-release-runbook.md` | `launch:readiness:strict` 已固定为发布前 strict 门禁；下一步把公网 HTTPS health / readiness 纳入自动回滚窗口，并拆出 production 只读 smoke |

P0-6 当前推进记录：

- 本地 visual check 已从“每页只保留一张截图 + 附带主题切换指标”升级到“每个 route + viewport 分别产出 light / dark 两张独立截图与 report 项”。
- 每个 theme 现在都会独立执行主题应用校验、横向溢出检查、必需 selector / shell 校验与关键 heading 校验，不再只依赖 `html.dark` 或一次性 theme cycle。
- 第一批已优先补齐 public 四页与现有 student / teacher 主线：`/`、`/login`、`/register`、`/recover`、`/student`、`/practice`、`/teacher`、`/teacher/classroom-live`。
- 2026-06-01 已补入第二批稳定切片：`/ai-classroom`、`/parent`、`/school`、`/admin`。其中 `parent/school/admin` 统一复用 API 注册 / 登录链路，避免依赖脆弱 UI 表单流程；`parent` 额外补最小教师-班级-作业前置，确保落到真实家长工作台而不是空态。
- 2026-06-01 已补入第三批稳定切片：`/student/interactive-classroom` 与 `/school/interactive-classrooms`，视觉矩阵当前达到 14 条稳定路由；`/classroom/[id]` 仍需动态课堂 fixture 后再纳入。
- 下一步仍需继续补足更真实的数据态与异常态，而不是只看壳层稳定性。

P0-7 当前推进记录：

- `tests/browser/a11y.spec.ts` 已从 public / student / teacher 主线扩展到 13 个直接路由，新增覆盖 `/ai-classroom`、`/student/interactive-classroom`、`/admin`、`/school`、`/school/interactive-classrooms`。
- `/ai-classroom` 已补齐顶部主题 / 设置按钮、生成工具栏、媒体能力入口、语音按钮、主需求输入框和课堂身份控件的可访问名称；目标切片 `ai classroom and student experience classroom` 与 `admin and school governance pages` 已通过 Axe `critical=0 + serious=0` 门禁。
- `/` 已新增角色入口 smoke，确认学生、教师、家长、学校与管理端入口不再依赖学生默认路径心智。

P0 清零标准：

```bash
corepack pnpm lint
corepack pnpm exec tsc --noEmit --project tsconfig.json
corepack pnpm build
corepack pnpm test:unit
corepack pnpm launch:readiness:strict
corepack pnpm test:a11y
corepack pnpm test:visual
```

如果只改文档，可以只跑 `git diff --check`；如果改 UI、测试、发布脚本或路由，必须跑与影响面对应的完整门禁。

---

## 5. P1：高质量试点必须完成

P1 的目标是让真实学校、教师和学生使用时感到“这是一个完整产品”，而不是“功能很强但还像工具箱”。

| 编号 | 优化项 | 涉及路径 | 满分验收 |
| --- | --- | --- | --- |
| P1-1 | AI 课堂叙事回到教学主线 | `app/ai-classroom/page.tsx`、`app/teacher/ai-tools/page.tsx`、`app/student/interactive-classroom/page.tsx` | Hero 和主 CTA 优先说明“给谁上、学什么、学完去哪”；导出、数字人、资源包降为辅助；教师和学生入口价值叙事一致 |
| P1-2 | 角色导航从功能罗列改成主线导航 | `lib/navigation/role-nav-config.ts`、`components/RoleSidebarNav.tsx`、`components/MobileAppNav.tsx` | 每个角色 primary nav 收敛到 4-6 个核心入口；“控制台 / 总看板 / 工作台 / 空间”等同义词统一；长尾能力进入二级分组 |
| P1-3 | 中文术语与产品语气统一 | `app/_components/HomeRoleLaunchSection.tsx`、`app/_components/HomeFirstDayFlowsSection.tsx`、`app/school/useSchoolPageView.tsx`、全局文案 | 中文界面 chip、section tag、状态标签全部中文化；不出现 `Role-first`、`Onboarding`、`Action-first`、`School Admin` 等模板语气 |
| P1-4 | 每个角色补齐首页、列表页、详情/操作页体验链 | 学生、教师、家长、学校、管理员核心路由 | 每类角色至少覆盖“首页 + 列表 + 详情/操作”三个页面的视觉、a11y、smoke；用户能从首页自然完成一个高频任务 |
| P1-5 | 对话框、上传、审批、表单统一交互 | `app/teacher/**`、`app/school/**`、`app/admin/**`、`components/**` | Tab 顺序、Esc 关闭、焦点回收、toast 可读性、错误靠近字段、加载状态禁用按钮全部符合统一规则 |
| P1-6 | 关键 AI 任务服务端化与审计增强 | `app/api/**`、`lib/server/**`、`lib/orchestration/**`、`lib/generation/**` | 客户端提交任务意图；服务端统一 provider、模型、成本、审计、降级；生成会话可恢复、可重试、可追踪 |
| P1-7 | 设计系统沉淀为可复用语法 | `app/globals.css`、`app/styles/*.css`、`components/**`、`lib/ui/**` | 色彩、字体、间距、半径、阴影、动效、状态色、主题 token 有统一来源；页面不再散落一次性视觉样式 |
| P1-8 | 高价值路由补齐 UI 门禁 | `tests/browser/a11y.spec.ts`、`tests/browser/smoke.spec.ts`、`scripts/visual-check-local.mjs` | `/library`、`/library/[id]`、`/student/exams`、`/teacher/lesson-planner`、`/teacher/projects`、`/school/schedules`、`/school/classes`、`/admin/ai-models` 等进入覆盖矩阵 |

P1-3 当前推进记录：

- 首页角色入口与首日上手区块的用户可见 chip 已从 `Role-first`、`Onboarding` 改为中文产品语气，减少模板感。
- 学校首页壳层 chip 已从 `School Admin` 改为 `学校治理`，让学校角色入口更贴近教育治理场景。
- `tests/unit/public-brand-hygiene.test.ts` 已扩展为公开产品表面防回退测试，避免这些模板式英文 chip 再进入用户可见界面。

P1 推荐验收命令：

```bash
corepack pnpm verify:strict
corepack pnpm test:smoke:production-like:local
corepack pnpm test:visual
corepack pnpm test:a11y
```

---

## 6. P2：世界级差异化与满分冲刺

P2 的目标是从“可用、好看、可信”继续推进到“难以替代、有证据、有复利”。

| 编号 | 优化项 | 涉及路径 | 满分验收 |
| --- | --- | --- | --- |
| P2-1 | 79 个页面路由建立覆盖台账 | `app/**/page.tsx`、`docs/strict-testing-baseline.md`、`docs/route-coverage-inventory.md` | 第一版 seed inventory 已记录 79 个 `page.tsx`、核心 P0/P1 路由、角色、业务意图、smoke/a11y/visual 归属、empty/loading/error 状态要求和下一步缺口；后续继续补全 owner 与全量门禁 |
| P2-2 | 视觉门禁升级为可维护 baseline / diff | `scripts/visual-check-local.mjs`、Playwright 产物目录、CI 配置 | 视觉检查不只看横向溢出，还能对核心区域做稳定 diff；可按路由、主题、viewport 更新 baseline |
| P2-3 | Empty / Loading / Error / Step-up 状态全量设计 | 全角色关键页与 `components/**` | 所有状态都有统一版式、文案、行动按钮、可访问性和主题适配；错误状态不暴露内部异常或伪装成功 |
| P2-4 | 学习效果证据化 | `app/student/**`、`app/teacher/**`、`app/parent/**`、`lib/generation/**` | 学生能看到进步证据，教师能看到干预建议，家长能看到可理解变化，学校能看到质量治理指标 |
| P2-5 | AI 教育创新能力产品化 | `app/ai-classroom/**`、`app/student/interactive-classroom/**`、`lib/orchestration/**` | 多轮课堂生成、个性化任务、互动复盘、学习画像、教师数字人都围绕教学目标闭环，不作为孤立炫技功能 |
| P2-6 | 运营与增长指标闭环 | `lib/analytics/**`、`app/admin/**`、`app/school/**` | 登录、注册、恢复、课堂发起、学生完成、家长互动、学校治理都有事件口径；管理端能看趋势和异常 |
| P2-7 | 品牌独立性与合规满分 | `THIRD_PARTY_NOTICES.md`、`public/logos/**`、`components/brand/**`、README 与 docs | 用户可见品牌完全统一；第三方许可、素材来源、模型服务条款和 NOTICE 可审计；不会用删除许可义务来“伪装自研” |
| P2-8 | 跨端连续性 | 学生、教师、课堂与生成任务链路 | 刷新、换设备、换浏览器后核心学习/备课任务可恢复；浏览器只是观察者和控制器，不是唯一状态源 |

P2 满分冲刺建议按季度推进：

1. 第 1 阶段：把 79 个路由建成覆盖台账，先补核心页 visual/a11y/smoke。
2. 第 2 阶段：把所有角色的 empty/loading/error/step-up 状态统一为设计系统组件。
3. 第 3 阶段：把学习效果、AI 质量和运营指标接入学校 / 管理端可视化。
4. 第 4 阶段：做跨端恢复、像素级视觉回归和长期合规证据库。

---

## 7. 核心路由覆盖矩阵

第一阶段先按以下路由补门禁。后续再扩展到全部 `79` 个页面路由。

第一版覆盖台账见 `docs/route-coverage-inventory.md`。该文档是 seed inventory，用于维护当前覆盖证据和缺口，不表示 79 个页面路由已经完整覆盖。

| 优先级 | 路由 | 必须覆盖 |
| --- | --- | --- |
| P0 | `/` | 首页角色入口、品牌、主题切换、无横向溢出 |
| P0 | `/login` | 多角色登录、恢复入口、无 demo 暴露、a11y |
| P0 | `/register` | 表单语义、成功 CTA、错误播报、角色入口 |
| P0 | `/recover` | 角色选择语义、工单提交、错误 / 成功播报 |
| P0 | `/student` | 学生今日任务、主题切换、移动 tabbar |
| P0 | `/teacher` | 教师今日主线、主题切换、侧栏与移动导航 |
| P0 | `/parent` | 家长孩子状态、鼓励反馈、主题切换 |
| P0 | `/school` | 学校质量治理主线、主题切换 |
| P0 | `/admin` | 风险 / 内容 / 发布动作优先级 |
| P0 | `/practice` | 学生练习主线与 a11y |
| P0 | `/ai-classroom` | 课堂目标、对象、课后去向、视觉与 a11y 门禁 |
| P0 | `/student/interactive-classroom` | 体验模式边界、学生学习路径、降级可信度、a11y |
| P0 | `/teacher/classroom-live` | 实时课堂仪表盘、键盘和主题 |
| P0 | `/school/interactive-classrooms` | 学校互动课堂治理中心、a11y |
| P0 | `/classroom/[id]` | 沉浸式课堂、焦点、主题、无横向溢出 |
| P1 | `/notifications` | 通知列表、已读状态、空态 |
| P1 | `/library`、`/library/[id]` | 资料列表、详情、下载、分享、空态 |
| P1 | `/student/exams`、`/student/exams/[id]` | 考试列表、作答、提交、结果状态 |
| P1 | `/student/assignments/[id]` | 作业提交、附件、反馈 |
| P1 | `/teacher/lesson-planner` | 备课流程、表单、生成状态 |
| P1 | `/teacher/projects` | PBL 项目、列表 / 详情状态 |
| P1 | `/teacher/ai-tools` | AI 工具到课堂主线的叙事一致性 |
| P1 | `/school/schedules`、`/school/classes` | 排课、班级、治理流程 |
| P1 | `/admin/ai-models`、`/admin/recovery-requests` | 模型链、恢复工单、step-up |
| P2 | `/wrong-book`、`/reading`、`/writing`、`/focus`、`/report`、`/discussions` | 学生长尾学习与成长能力 |
| P2 | `/student/modules*`、`/student/profile`、`/student/growth`、`/student/favorites` | 个性化学习资产与偏好 |

---

## 8. 执行规则

### 8.1 每轮优化必须写清楚分数变化

每个任务完成后，在相关 PR、任务卡或本页追加：

- 优化前指标和问题证据
- 修改路径
- 用户可见变化
- 新增或更新的测试
- 最新截图或 Playwright 产物
- 分数是否提高，以及为什么

### 8.2 P0 未清零前不做大规模 P2 炫技

可以保留创新探索，但 P0 未清零前，主线优先级固定为：

1. 可信入口
2. 真实数据和降级边界
3. 主题与 a11y 门禁
4. 核心角色路径
5. 发布 readiness 与远端 smoke

### 8.3 多智能体协作分工

后续继续使用多代理时，建议按以下角色拆分，避免多人同时改同一文件：

| 角色 | 负责范围 | 输出 |
| --- | --- | --- |
| 产品经理 | 多角色路径、教育场景、P0/P1/P2 排序 | 用户路径、验收标准、文案风险 |
| UI 设计师 | 视觉系统、深浅主题、品牌一致性 | 页面结构、组件规则、截图审查 |
| 前端工程师 | 页面、组件、路由、浏览器交互 | 可运行代码、Playwright 覆盖 |
| 后端工程师 | API、DB canonical path、发布 readiness | 服务端状态、迁移、运行时 guardrails |
| 架构师 | 页面拆层、AI job、服务边界 | 重构计划、依赖边界、长期风险 |
| AI 工程师 | 生成链路、prompt、eval、降级策略 | AI 输出契约、评测集、审计字段 |
| QA / a11y | smoke、a11y、visual、覆盖台账 | 失败样例、测试矩阵、门禁命令 |

### 8.4 合规边界

品牌、UI、文案、代码结构和产品体验可以持续重塑为自有产品；但第三方许可、开源 NOTICE、模型服务条款和素材来源不能靠删除记录来规避。满分目标是“用户可见产品完全自洽，法律和工程证据完整可审计”。

---

## 9. 后续满分追踪模板

每次推进一个指标，用下面模板追加到任务卡或 PR 说明：

```md
### 指标：<例如 UI 视觉系统与品牌独立性>

- 优化前分数：6.9/10
- 本轮目标分数：7.5/10
- 用户路径：<谁在什么场景下完成什么任务>
- 改动范围：<文件 / 路由 / API / 测试>
- P0/P1/P2：<优先级>
- 验收命令：
  - `corepack pnpm lint`
  - `corepack pnpm exec tsc --noEmit --project tsconfig.json`
  - `corepack pnpm test:unit`
  - `<对应 smoke / a11y / visual 命令>`
- 视觉证据：<截图目录或 Playwright artifact>
- 复盘：<分数为什么提高，剩余扣分项是什么>
```

---

## 10. 下一轮建议顺序

如果只做一轮低风险、高收益优化，按这个顺序推进：

1. 清掉登录页 demo 暴露与 demo placeholder。
2. 首页 hero 改成多角色同级入口，移除“非学生先走学生主线”的产品逻辑。
3. 学生互动课堂降级文案改为真实体验模式边界。
4. 注册 / 找回入口补语义、错误播报和成功 CTA。
5. 管理端首页改成 action-first 风险 / 内容 / 发布工作台。
6. 继续清理 P0-5 用户可见旧品牌出口，并保留内部兼容迁移策略。
7. 继续扩大 `critical=0` + `serious=0` 的核心页 a11y 覆盖面，下一批优先补 `/parent`、`/library`、`/school/schedules`、`/admin/ai-models`。
8. 扩容视觉门禁到 P0 动态详情路由，优先建立 `/classroom/[id]` 的稳定课堂 fixture。
9. 建立 79 个页面路由覆盖台账，进入 P2 长期满分追踪。

这些事项完成后，再集中推进 AI 课堂服务端化、全角色状态系统、像素级视觉回归和学习效果证据化。

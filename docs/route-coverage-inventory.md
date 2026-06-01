# 路由覆盖台账（Seed Inventory）

更新时间：2026-06-01

状态：第一版 seed inventory。本文基于当前工作区 `app/**/page.tsx` 盘点路由，并对现有 smoke、a11y、visual 覆盖做归档，不表示 79 个页面路由已经完整覆盖。

## 1. 盘点口径

- 路由统计命令：`rg --files app | rg '(^|/)page\.tsx$' | wc -l`
- 当前统计结果：`79` 个 `page.tsx`
- 路由清单来源：`rg --files app | rg '(^|/)page\.tsx$'`
- 覆盖证据来源：`tests/browser/smoke.spec.ts`、`tests/browser/a11y.spec.ts`、`scripts/visual-check-local.mjs`
- 路由级状态文件盘点：`rg --files app | rg '/(loading|error|not-found)\.tsx$'`
- 当前仅发现 `app/dashboard/error.tsx` 一个路由级 `error.tsx`；未发现全量 `loading.tsx` 或 `not-found.tsx`

本文把状态要求写成后续验收目标：每个页面都应明确 empty、loading、error 的可见文案、操作出口、a11y 语义和深浅主题表现。除非覆盖状态列明确写为“已覆盖”，否则不能把状态要求理解成已完成。

## 2. 覆盖状态图例

| 标记 | 含义 |
| --- | --- |
| 已覆盖 | 当前测试或脚本直接触达该路由，并有明确断言 |
| 流程覆盖 | 当前 smoke 通过用户流程进入该路由，适合说明主链路存在，但不等价于独立页面门禁 |
| 动态覆盖 | 当前 smoke 依赖运行时创建的 id、token 或跨页结果进入详情页 |
| 壳层覆盖 | 当前 visual 脚本覆盖 light/dark + desktop/mobile，并检查主题、横向溢出、壳层 selector 或关键 heading |
| 未覆盖 | 当前未在对应 smoke/a11y/visual 入口发现稳定覆盖 |
| 待核实 | 路由存在，但 seed inventory 暂未确认其用户意图、数据态或 owner |

当前覆盖摘要：

- smoke：当前归一化触达 28 条路由，其中部分为流程进入或动态 id 进入。
- a11y：当前直接覆盖 `/`、`/login`、`/register`、`/recover`、`/student`、`/practice`、`/teacher`、`/teacher/classroom-live`。
- visual：当前工作区脚本明示覆盖 `/`、`/login`、`/register`、`/recover`、`/ai-classroom`、`/student`、`/practice`、`/student/interactive-classroom`、`/teacher`、`/teacher/classroom-live`、`/parent`、`/school`、`/school/interactive-classrooms`、`/admin`。
- 状态页：当前只发现 `app/dashboard/error.tsx`；其余路由的 empty/loading/error 需要在页面内或后续路由文件中建立明确契约。

## 3. 核心 P0 覆盖矩阵

| 路由 | 角色 | 用户意图 | smoke | a11y | visual | empty/loading/error 状态要求 | 下一步缺口 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/` | 公开入口 / 全角色 | 选择学生、教师、家长或学校主线，不先被迫理解学生路径 | 未覆盖 | 已覆盖 | 壳层覆盖 | 入口卡片为空时仍展示角色选择；首屏资源加载中保留布局；链接或角色入口异常要给恢复路径 | 补最小 smoke，确认四类角色入口 href 与品牌出口 |
| `/login` | 公开入口 / 全角色 | 选择角色并登录到对应工作台 | 已覆盖 | 已覆盖 | 壳层覆盖 | 登录中按钮禁用；错误用可读 `alert`；锁定、无权限、网络错误给下一步 | 继续拆分学生、教师、家长、学校、管理员登录用例的独立断言 |
| `/register` | 公开入口 / 学生、家长、教师、学校、管理员开通入口 | 自助注册或找到非自助角色开通路径 | 已覆盖 | 已覆盖 | 壳层覆盖 | 空表单有必填语义；提交中禁用；重复邮箱、邀请码错误、成功态可读 | 补教师、学校、管理员注册入口的 a11y 与 visual 独立门禁 |
| `/recover` | 公开入口 / 全角色 | 提交账号恢复请求并获得服务时效 | 已覆盖 | 已覆盖 | 壳层覆盖 | 空表单有说明；提交中禁用；限流、成功状态用 `alert/status` | 补各角色恢复入口的 smoke 参数化覆盖 |
| `/student` | 学生 | 查看今天最值得开始的学习动作 | 流程覆盖 | 已覆盖 | 壳层覆盖 | 无任务时给练习/课堂/计划 CTA；加载中保留工作台骨架；接口失败给重试与登录边界 | 补 dashboard 数据空态和接口失败场景 |
| `/teacher` | 教师 | 从备课、课堂、作业和学情里选择今天先做什么 | 流程覆盖 | 已覆盖 | 壳层覆盖 | 无班级/无作业时给建班和发布 CTA；加载中保留导航；接口失败给重试 | 补无班级、无学生、API 失败的 smoke |
| `/parent` | 家长 | 查看孩子状态、陪伴动作、鼓励反馈 | 流程覆盖 | 未覆盖 | 壳层覆盖 | 未绑定孩子时显示观察码绑定路径；加载中保留家长工作台；提交失败可恢复 | 补 Axe 门禁和未绑定孩子空态 |
| `/school` | 学校管理员 | 查看学校质量治理、课堂应用和排课风险 | 未覆盖 | 未覆盖 | 壳层覆盖 | 无班级/无教师时给导入与邀请路径；加载中保留治理概览；接口失败给只读降级 | 补登录后直达 smoke 与 Axe 门禁 |
| `/admin` | 平台管理员 | 优先处理发布风险、账号恢复、模型链和内容治理 | 已覆盖 | 未覆盖 | 壳层覆盖 | 无工单/无告警时解释健康状态；高风险动作 loading/step-up/error 明确 | 补 Axe 门禁和异常队列空态 |
| `/practice` | 学生 | 进入智能练习并完成学习巩固 | 未覆盖 | 已覆盖 | 壳层覆盖 | 无题目时给生成或选择知识点 CTA；加载题目有 skeleton；提交错误可重试 | 补业务 smoke 与错误态 |
| `/ai-classroom` | 公开 / 学生 / 教师 | 带课堂上下文进入 AI 课堂生成主线 | 流程覆盖 | 未覆盖 | 壳层覆盖 | 未带上下文时解释可独立使用；生成中禁用提交；生成失败不伪装成功 | 补 Axe 门禁、直达 smoke、生成失败态 |
| `/student/interactive-classroom` | 学生 | 从学生端发起自学或兴趣培养课堂 | 已覆盖 | 未覆盖 | 壳层覆盖 | 未登录或接口失败时标注体验模式；加载画像不跳动；错误说明真实画像未接入 | 补 Axe 门禁，并把体验模式边界纳入 visual 断言 |
| `/teacher/classroom-live` | 教师 | 发起课堂练习并查看实时课堂反馈 | 已覆盖 | 已覆盖 | 壳层覆盖 | 无班级/无人作答要有空态；推进中禁用；课堂 API 失败可重试 | 补更多真实班级数据态与移动交互断言 |
| `/school/interactive-classrooms` | 学校管理员 | 查看互动课堂交付和质量治理数据 | 已覆盖 | 未覆盖 | 壳层覆盖 | 无交付记录时说明如何发起；加载中保留指标位；接口失败可重试 | 补 Axe 门禁和无数据空态 |
| `/classroom/[id]` | 学生 / 教师 / 课堂参与者 | 进入沉浸式课堂详情或预览 | 未覆盖 | 未覆盖 | 未覆盖 | 缺失 id、未授权、课堂不存在、加载中都要有明确边界 | 建立可复现课堂 fixture，并加入 smoke/a11y/visual |

## 4. 核心 P1 覆盖矩阵

| 路由 | 角色 | 用户意图 | smoke | a11y | visual | empty/loading/error 状态要求 | 下一步缺口 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/notifications` | 全角色 / 管理员当前已触达 | 查看通知、异常登录与已读状态 | 已覆盖 | 未覆盖 | 未覆盖 | 无通知时解释健康状态；加载中保留列表结构；标记已读失败可重试 | 补全角色通知过滤、Axe、visual |
| `/library` | 管理员 / 教师 / 学校 | 上传、检索、下载教材与课件 | 已覆盖 | 未覆盖 | 未覆盖 | 无资料时给导入 CTA；上传中禁用；上传、下载、step-up 错误可恢复 | 补列表页 visual/a11y 与非管理员只读态 |
| `/library/[id]` | 管理员 / 教师 / 学校 | 查看资料详情、下载、分享 | 动态覆盖 | 未覆盖 | 未覆盖 | 资料不存在、无权限、文件缺失、下载失败都有说明 | 补详情页 Axe 与动态视觉 fixture |
| `/library/shared/[token]` | 外部分享访问者 | 通过分享链接查看资料 | 动态覆盖 | 未覆盖 | 未覆盖 | token 失效、资料删除、下载失败要有公开错误页 | 将 share token 流程纳入路由矩阵 |
| `/student/exams` | 学生 | 查看待完成和历史考试 | 已覆盖 | 未覆盖 | 未覆盖 | 无考试时给学习建议；加载中保留列表；拉取失败可重试 | 补 Axe、visual、空态 |
| `/student/exams/[id]` | 学生 | 作答、提交考试并查看结果 | 动态覆盖 | 未覆盖 | 未覆盖 | 未授权/不存在/已提交/提交失败都要可读；提交中禁用 | 补作答页 Axe、移动 visual、异常提交 |
| `/student/assignments/[id]` | 学生 | 查看作业详情、上传附件、提交 | 动态覆盖 | 未覆盖 | 未覆盖 | 无附件、上传中、超额、提交失败、已提交状态清晰 | 补上传控件 a11y、visual 和错误态 |
| `/teacher/assignments/[id]/reviews/[studentId]` | 教师 | 批改学生作业并下载附件 | 动态覆盖 | 未覆盖 | 未覆盖 | 学生不存在、作业未提交、附件缺失、下载失败要可恢复 | 补批改页 Axe、visual、空提交态 |
| `/teacher/lesson-planner` | 教师 | 输入主题并生成备课方案 | 已覆盖 | 未覆盖 | 未覆盖 | 空主题校验；生成中禁用；生成失败给重试和人工编辑出口 | 补 a11y、visual、AI 失败态 |
| `/teacher/projects` | 教师 | 生成和管理 PBL 项目 | 已覆盖 | 未覆盖 | 未覆盖 | 无项目时给生成 CTA；生成中保留结构；保存/展示失败可恢复 | 补 a11y、visual、空态 |
| `/student/projects` | 学生 | 查看展示项目并提交阶段成果 | 已覆盖 | 未覆盖 | 未覆盖 | 无展示项目时给说明；提交中禁用；提交失败可重试 | 补入 P1/P2 归属并加 UI 门禁 |
| `/teacher/ai-tools` | 教师 | 从 AI 工具带班级上下文发起课堂 | 已覆盖 | 未覆盖 | 未覆盖 | 无班级时给建班路径；启动中禁用；上下文缺失有提示 | 补 a11y、visual、无班级态 |
| `/school/schedules` | 学校管理员 | 预演、应用、回滚 AI 排课 | 已覆盖 | 未覆盖 | 未覆盖 | 无班级/无教师时解释前置条件；预演/应用/回滚 loading 与失败可读 | 补 Axe、visual、失败态 |
| `/school/classes` | 学校管理员 | 查看学校班级并验证组织边界 | 已覆盖 | 未覆盖 | 未覆盖 | 无班级时给导入/创建路径；加载中保留表格；越权错误明确 | 补 visual、Axe、空态 |
| `/admin/ai-models` | 平台管理员 | 配置模型链并执行 step-up | 已覆盖 | 未覆盖 | 未覆盖 | 无 provider 时给降级说明；保存中禁用；step-up 失败可恢复 | 补 a11y、visual、provider 异常态 |
| `/admin/recovery-requests` | 平台管理员 | 搜索、接单、解决账号恢复工单 | 已覆盖 | 未覆盖 | 未覆盖 | 无工单时解释队列健康；处理中禁用；step-up/解决失败可恢复 | 补 a11y、visual、空队列 |

## 5. 79 个 `page.tsx` 路由索引

| 路由 | 源文件 | seed 分层 | 角色桶 | 覆盖备注 |
| --- | --- | --- | --- | --- |
| `/` | `app/page.tsx` | P0 | 公开入口 | a11y + visual；smoke 缺口 |
| `/login` | `app/login/page.tsx` | P0 | 公开入口 | smoke + a11y + visual |
| `/register` | `app/register/page.tsx` | P0 | 公开入口 | smoke + a11y + visual |
| `/recover` | `app/recover/page.tsx` | P0 | 公开入口 | smoke + a11y + visual |
| `/student` | `app/student/page.tsx` | P0 | 学生 | smoke flow + a11y + visual |
| `/teacher` | `app/teacher/page.tsx` | P0 | 教师 | smoke flow + a11y + visual |
| `/parent` | `app/parent/page.tsx` | P0 | 家长 | smoke flow + visual |
| `/school` | `app/school/page.tsx` | P0 | 学校管理员 | visual；smoke/a11y 缺口 |
| `/admin` | `app/admin/page.tsx` | P0 | 平台管理员 | smoke + visual；a11y 缺口 |
| `/practice` | `app/practice/page.tsx` | P0 | 学生 | a11y + visual；smoke 缺口 |
| `/ai-classroom` | `app/ai-classroom/page.tsx` | P0 | 学生 / 教师 / 公开 | smoke flow + visual |
| `/student/interactive-classroom` | `app/student/interactive-classroom/page.tsx` | P0 | 学生 | smoke + visual；a11y 缺口 |
| `/teacher/classroom-live` | `app/teacher/classroom-live/page.tsx` | P0 | 教师 | smoke + a11y + visual |
| `/school/interactive-classrooms` | `app/school/interactive-classrooms/page.tsx` | P0 | 学校管理员 | smoke + visual；a11y 缺口 |
| `/classroom/[id]` | `app/classroom/[id]/page.tsx` | P0 | 课堂参与者 | 未覆盖 |
| `/notifications` | `app/notifications/page.tsx` | P1 | 全角色 | smoke |
| `/library` | `app/library/page.tsx` | P1 | 管理员 / 教师 / 学校 | smoke |
| `/library/[id]` | `app/library/[id]/page.tsx` | P1 | 管理员 / 教师 / 学校 | dynamic smoke |
| `/library/shared/[token]` | `app/library/shared/[token]/page.tsx` | P1 | 外部分享访问者 | share flow smoke |
| `/student/exams` | `app/student/exams/page.tsx` | P1 | 学生 | smoke |
| `/student/exams/[id]` | `app/student/exams/[id]/page.tsx` | P1 | 学生 | dynamic smoke |
| `/student/assignments/[id]` | `app/student/assignments/[id]/page.tsx` | P1 | 学生 | dynamic smoke |
| `/teacher/assignments/[id]/reviews/[studentId]` | `app/teacher/assignments/[id]/reviews/[studentId]/page.tsx` | P1 | 教师 | dynamic smoke |
| `/teacher/lesson-planner` | `app/teacher/lesson-planner/page.tsx` | P1 | 教师 | smoke |
| `/teacher/projects` | `app/teacher/projects/page.tsx` | P1 | 教师 | smoke |
| `/student/projects` | `app/student/projects/page.tsx` | P1 | 学生 | smoke |
| `/teacher/ai-tools` | `app/teacher/ai-tools/page.tsx` | P1 | 教师 | smoke |
| `/school/schedules` | `app/school/schedules/page.tsx` | P1 | 学校管理员 | smoke |
| `/school/classes` | `app/school/classes/page.tsx` | P1 | 学校管理员 | smoke |
| `/admin/ai-models` | `app/admin/ai-models/page.tsx` | P1 | 平台管理员 | smoke |
| `/admin/recovery-requests` | `app/admin/recovery-requests/page.tsx` | P1 | 平台管理员 | smoke |
| `/admin/launch-readiness` | `app/admin/launch-readiness/page.tsx` | P1 | 平台管理员 | linked from `/admin`；缺独立门禁 |
| `/admin/register` | `app/admin/register/page.tsx` | P1 | 平台管理员 | smoke setup route |
| `/school/register` | `app/school/register/page.tsx` | P1 | 学校管理员 | smoke setup route |
| `/teacher/register` | `app/teacher/register/page.tsx` | P1 | 教师 | 未覆盖 |
| `/student/assignments` | `app/student/assignments/page.tsx` | P1 | 学生 | 未覆盖 |
| `/teacher/assignments/[id]` | `app/teacher/assignments/[id]/page.tsx` | P1 | 教师 | 未覆盖 |
| `/teacher/assignments/[id]/stats` | `app/teacher/assignments/[id]/stats/page.tsx` | P1 | 教师 | 未覆盖 |
| `/teacher/analysis` | `app/teacher/analysis/page.tsx` | P1 | 教师 | 未覆盖 |
| `/teacher/exams` | `app/teacher/exams/page.tsx` | P1 | 教师 | 未覆盖 |
| `/teacher/exams/[id]` | `app/teacher/exams/[id]/page.tsx` | P1 | 教师 | 未覆盖 |
| `/teacher/exams/create` | `app/teacher/exams/create/page.tsx` | P1 | 教师 | 未覆盖 |
| `/teacher/gradebook` | `app/teacher/gradebook/page.tsx` | P1 | 教师 | 未覆盖 |
| `/teacher/modules` | `app/teacher/modules/page.tsx` | P1 | 教师 | 未覆盖 |
| `/teacher/notifications` | `app/teacher/notifications/page.tsx` | P1 | 教师 | 未覆盖 |
| `/teacher/seating` | `app/teacher/seating/page.tsx` | P1 | 教师 | 未覆盖 |
| `/teacher/submissions` | `app/teacher/submissions/page.tsx` | P1 | 教师 | 未覆盖 |
| `/school/students` | `app/school/students/page.tsx` | P1 | 学校管理员 | 未覆盖 |
| `/school/teachers` | `app/school/teachers/page.tsx` | P1 | 学校管理员 | 未覆盖 |
| `/admin/experiments` | `app/admin/experiments/page.tsx` | P2 | 平台管理员 | 未覆盖 |
| `/admin/knowledge-points` | `app/admin/knowledge-points/page.tsx` | P2 | 平台管理员 | 未覆盖 |
| `/admin/knowledge-tree` | `app/admin/knowledge-tree/page.tsx` | P2 | 平台管理员 | 未覆盖 |
| `/admin/logs` | `app/admin/logs/page.tsx` | P2 | 平台管理员 | 未覆盖 |
| `/admin/questions` | `app/admin/questions/page.tsx` | P2 | 平台管理员 | 未覆盖 |
| `/announcements` | `app/announcements/page.tsx` | P2 | 全角色 | 未覆盖 |
| `/calendar` | `app/calendar/page.tsx` | P2 | 全角色 | 未覆盖 |
| `/challenge` | `app/challenge/page.tsx` | P2 | 学生 | 未覆盖 |
| `/coach` | `app/coach/page.tsx` | P2 | 学生 | 未覆盖 |
| `/course` | `app/course/page.tsx` | P2 | 学生 | 未覆盖 |
| `/dashboard` | `app/dashboard/page.tsx` | P2 | 通用工作台 | route-level error；其余门禁缺口 |
| `/diagnostic` | `app/diagnostic/page.tsx` | P2 | 学生 | 未覆盖 |
| `/discussions` | `app/discussions/page.tsx` | P2 | 全角色 | 未覆盖 |
| `/files` | `app/files/page.tsx` | P2 | 全角色 | 未覆盖 |
| `/focus` | `app/focus/page.tsx` | P2 | 学生 | 未覆盖 |
| `/generation-preview` | `app/generation-preview/page.tsx` | P2 | 教师 / 管理员 | 未覆盖 |
| `/inbox` | `app/inbox/page.tsx` | P2 | 全角色 | 未覆盖 |
| `/plan` | `app/plan/page.tsx` | P2 | 学生 | 未覆盖 |
| `/reading` | `app/reading/page.tsx` | P2 | 学生 | 未覆盖 |
| `/report` | `app/report/page.tsx` | P2 | 学生 / 家长 / 教师 | 未覆盖 |
| `/student/favorites` | `app/student/favorites/page.tsx` | P2 | 学生 | 未覆盖 |
| `/student/growth` | `app/student/growth/page.tsx` | P2 | 学生 | 未覆盖 |
| `/student/knowledge-map` | `app/student/knowledge-map/page.tsx` | P2 | 学生 | 未覆盖 |
| `/student/modules` | `app/student/modules/page.tsx` | P2 | 学生 | 未覆盖 |
| `/student/modules/[id]` | `app/student/modules/[id]/page.tsx` | P2 | 学生 | 未覆盖 |
| `/student/portrait` | `app/student/portrait/page.tsx` | P2 | 学生 | 未覆盖 |
| `/student/profile` | `app/student/profile/page.tsx` | P2 | 学生 | 未覆盖 |
| `/tutor` | `app/tutor/page.tsx` | P2 | 学生 | 未覆盖 |
| `/writing` | `app/writing/page.tsx` | P2 | 学生 | 未覆盖 |
| `/wrong-book` | `app/wrong-book/page.tsx` | P2 | 学生 | 未覆盖 |

## 6. 下一步补齐顺序

1. 把 P0 中仍缺 smoke/a11y/visual 的 `/`、`/parent`、`/school`、`/admin`、`/practice`、`/ai-classroom`、`/student/interactive-classroom`、`/school/interactive-classrooms`、`/classroom/[id]` 补齐到同一门禁口径。
2. 把 P1 已有 smoke 的列表/详情/高风险操作页补上 Axe 与 visual：`/library`、`/library/[id]`、`/student/exams*`、`/student/assignments/[id]`、`/teacher/lesson-planner`、`/teacher/projects`、`/school/schedules`、`/school/classes`、`/admin/ai-models`、`/admin/recovery-requests`。
3. 为动态详情页建立稳定 fixture：`/classroom/[id]`、`/library/[id]`、`/student/exams/[id]`、`/student/assignments/[id]`、`/teacher/assignments/[id]/reviews/[studentId]`。
4. 为所有 P0/P1 页面定义统一 empty/loading/error 状态验收样例，后续再扩到 P2 长尾学习页、管理页和通用协作页。
5. 每次新增、删除或重命名 `app/**/page.tsx`，同步更新本台账的 79 路由索引、覆盖摘要和路线图引用。

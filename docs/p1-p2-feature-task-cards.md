# P1/P2 功能任务卡（工程师执行版）

更新时间：2026-04-04
来源：`README.md` 第 5.2 节
适用阶段：P0 功能上线后持续迭代 / 回归维护

说明：
- P0 功能（知识图谱、游戏化系统、AI 思维脚手架）已完成，代码在 main。
- 本文记录本轮已完成的 P1/P2 功能交付，每张卡仍可直接对应一个 GitHub issue 或后续维护项。
- 每张卡包含：背景、验收标准、涉及文件、实现要点。

交付快照：
- 当前对应实现已完成落库、页面接入、API 打通与角色路径串联，可作为后续维护与回归入口。
- 2026-04-04 已通过：`corepack pnpm check:project-snapshot && corepack pnpm verify:strict`
- 本轮校验基线：`79` 个页面、`237` 个 API 路由、`109` 个单测文件、`362` 条单测、`23` 条浏览器自动化用例。

## Issue 总览

| ID | 标题 | 优先级 | 估时 | 状态 |
|----|------|--------|------|------|
| F-P1-01 | 学习状态感知与自适应难度降级 | P1 | 3-4d | 已完成 |
| F-P1-02 | AI 备课助手与差异化作业生成 | P1 | 3-4d | 已完成 |
| F-P1-03 | 家长端互动功能增强 | P1 | 2-3d | 已完成 |
| F-P1-04 | AI 对话交互体验优化 | P1 | 2-3d | 已完成 |
| F-P1-05 | 系统化新手引导 | P1 | 2-3d | 已完成 |
| F-P2-01 | 跨学科 AI 项目式学习（PBL） | P2 | 5-7d | 已完成 |
| F-P2-02 | AI 同伴学习（费曼学习法） | P2 | 4-5d | 已完成 |
| F-P2-03 | 课堂实时仪表盘 | P2 | 3-4d | 已完成 |
| F-P2-04 | AI 生成内容质量增强 | P2 | 3-4d | 已完成 |
| F-P2-05 | 无障碍与包容性设计合规 | P2 | 2-3d | 已完成 |

---

## F-P1-01 学习状态感知与自适应难度降级

GitHub issue 标题：`feat(practice): adaptive difficulty with fatigue detection`

### 背景

当前练习流程（`app/practice/`）在学生连续答错时没有任何干预机制，容易造成挫败感积累导致放弃。需要通过行为信号推断学习状态，并自动插入恢复性题目。

### 验收标准

- [x] 学生连续答错 3 题，自动插入 1 道该生已掌握的简单题（masteryScore > 85）
- [x] 连续练习超过 25 分钟，在题目切换时弹出休息建议卡片（可一键关闭）
- [x] 学习结束时展示情绪日记入口（3 个表情选一个）
- [x] 情绪数据落库，教师端和家长端可查看趋势

### 涉及文件

**新建：**
- `lib/learning-state.ts` — 状态推断逻辑
- `app/student/_components/StudentMoodCheckin.tsx` — 情绪日记组件
- `app/api/student/mood/route.ts` — 情绪记录 API
- `db/schema.sql` 追加 `student_mood_checkins` 表

**修改：**
- `app/practice/usePracticePage.ts` — 连错计数器，触发插题逻辑
- `app/practice/page.tsx` — 插入休息提示卡和情绪日记
- `app/api/practice/next/route.ts` — 支持 `insertRecovery: true` 参数时优先返回已掌握题目

### 实现要点

**连错计数：**
在 `usePracticePage.ts` 的 `submitAnswer` 回调内，维护 `consecutiveWrongCount` ref。连错达到 3 次且当前模式不是 `wrong_review`，在下一次 `loadQuestion` 时传入 `insertRecovery: true`。

**插题逻辑（`/api/practice/next`）：**
```typescript
// 收到 insertRecovery=true 时，从 mastery_records 查找同学科 masteryScore > 85 的 KP，
// 随机取一道题，优先级高于正常自适应推荐。
```

**休息提示：**
用 `useEffect` 监听 `sessionStartTime`（进入练习页时记录），每道题提交后检查是否超过 `25 * 60 * 1000` ms，达到后设 `showBreakSuggestion = true`，在题目切换间隙渲染 `<BreakSuggestionBanner />`（可复用 `status-note info` 样式）。

**情绪日记：**
练习结束（用户点击"完成"或离开页面）时，渲染 `StudentMoodCheckin`。组件展示 3 个表情按钮（😊 😐 😟），点击后 `POST /api/student/mood`，入库后消失。

**DB schema 追加：**
```sql
CREATE TABLE IF NOT EXISTS student_mood_checkins (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mood TEXT NOT NULL CHECK (mood IN ('good', 'neutral', 'tired')),
  context TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS student_mood_user_idx ON student_mood_checkins (user_id, created_at DESC);
```

---

## F-P1-02 AI 备课助手与差异化作业生成

GitHub issue 标题：`feat(teacher): AI lesson planner and differentiated assignment generator`

### 背景

教师端（`app/teacher/`）已有风险预警和 AI 教案生成，但缺少课前主动备课辅助。本任务新增两个功能：① 备课方案生成；② 基于班级学情的差异化作业一键分配。

### 验收标准

- [x] 教师在备课助手页面输入主题，AI 返回备课方案（含错误预测、互动设计、分层作业建议）
- [x] 教师可在作业布置界面勾选"差异化"，系统基于学情自动生成 A/B/C 三档难度题组
- [x] A 档（masteryScore < 60）、B 档（60-85）、C 档（>85）自动分配给对应学生
- [x] 学期末可生成教学反思报告（本班各知识点得分率趋势）

### 涉及文件

**新建：**
- `lib/ai-lesson-planner.ts` — 备课方案生成逻辑（复用 `lib/ai-router.ts` 的 `callRoutedLLM`）
- `app/teacher/lesson-planner/page.tsx` — 备课助手页面
- `app/teacher/lesson-planner/uselessonPlannerPage.ts` — 数据钩子
- `app/api/teacher/lesson-plan/route.ts` — POST，接收主题，返回备课方案
- `app/api/teacher/differentiated-assignment/route.ts` — POST，接收作业配置，返回三档题组 + 学生分配建议

**修改：**
- `app/teacher/_components/TeacherAssignmentComposerCard.tsx` — 新增"差异化"开关
- `lib/ai-task-policies.ts` — 新增 `lesson_plan` 任务类型

### 实现要点

**备课方案 prompt（`lib/ai-lesson-planner.ts`）：**
```typescript
// 入参: { subject, grade, topic, classMasteryStats }
// 出参: { commonMistakes: string[], interactionIdeas: string[], tieredAssignments: { easy: string[], medium: string[], hard: string[] } }
// 使用 callRoutedLLM({ taskType: "lesson_plan", prompt: buildLessonPlanPrompt(input) })
```

**差异化分配逻辑：**
```typescript
// 1. 从 mastery_records 查询班级每个学生对该主题 KP 的平均 masteryScore
// 2. 按 <60 / 60-85 / >85 分三档
// 3. 每档各选 5 道题（weak: easy难度, developing: medium, strong: hard）
// 4. 返回 { tierA: { students: string[], questions: Question[] }, ... }
```

**页面路由：** `/teacher/lesson-planner`，在教师端侧边导航"教学工具"分组下新增入口（修改 `app/teacher/utils.ts` 或对应导航配置文件）。

---

## F-P1-03 家长端互动功能增强

GitHub issue 标题：`feat(parent): interactive engagement features for parents`

### 背景

家长端（`app/parent/`）目前是"看报告 + 签收"模式，参与感弱。本任务新增亲子目标共设、家长鼓励卡片两个高频互动功能。

### 验收标准

- [x] 家长可与孩子共设本周目标（如"攻克分数运算"），系统追踪完成进度
- [x] 家长可发送文字鼓励卡片到学生端（附带预设模板选项）
- [x] 学生端在首屏展示最新鼓励卡片（可关闭）
- [x] 每周报告附带 AI 生成的 2-3 条具体可执行辅助建议（非泛化建议）

### 涉及文件

**新建：**
- `app/parent/_components/ParentGoalSetCard.tsx` — 亲子目标设置卡片
- `app/parent/_components/ParentEncouragementCard.tsx` — 鼓励卡片发送
- `app/student/_components/StudentEncouragementBanner.tsx` — 学生端展示横幅
- `app/api/parent/encouragement/route.ts` — POST 发送鼓励 / GET 查询最新
- `app/api/parent/goal/route.ts` — GET/POST 亲子目标
- `db/schema.sql` 追加两张表

**修改：**
- `app/parent/useParentPageView.tsx` — 加载鼓励卡片和目标数据
- `app/student/useStudentDashboardPageView.tsx` — 加载最新鼓励横幅

### 实现要点

**DB schema：**
```sql
CREATE TABLE IF NOT EXISTS parent_encouragements (
  id TEXT PRIMARY KEY,
  parent_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS parent_student_goals (
  id TEXT PRIMARY KEY,
  parent_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  target_date TEXT NOT NULL,
  knowledge_point_id TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**鼓励卡片模板**（前端写死，无需 AI）：
```
- "今天你最棒！"
- "加油，你可以的！"
- "妈妈/爸爸为你骄傲"
- "坚持就是胜利"
- 自定义输入（maxLength: 50）
```

**学生端横幅：** `StudentEncouragementBanner` 在 `student-growth-center` 区域顶部渲染，读取 `GET /api/parent/encouragement?unread=true`，点击"已看到"后调 `PATCH` 更新 `read_at`。

---

## F-P1-04 AI 对话交互体验优化

GitHub issue 标题：`feat(tutor): enhanced AI conversation experience with step animation`

### 背景

AI 家教页（`app/tutor/`）当前 AI 解题步骤一次性全部输出，缺乏沉浸感。本任务优化步骤展开动画和"我不懂"重新解释机制。

### 验收标准

- [x] 完整讲解揭晓时，`steps` 数组逐步展开（每步间隔 600ms），用户可点击"立即展开全部"跳过动画
- [x] 每个解释块底部有"我不懂，换种方式说"按钮，点击后 AI 以类比/图示方式重新解释该步骤
- [x] AI 连续答对 3 题后展示惊喜反馈消息（小横幅）

### 涉及文件

**新建：**
- `app/tutor/_components/TutorStepReveal.tsx` — 带动画的步骤逐步展开组件
- `app/api/ai/reexplain/route.ts` — POST，接收 step 文本，返回换种方式的解释

**修改：**
- `app/tutor/_components/TutorAnswerCard.tsx` — 用 `TutorStepReveal` 替换当前的 steps 列表渲染（第 424-431 行附近）
- `app/tutor/useTutorPage.ts` — 新增连续答对计数、惊喜反馈状态
- `lib/ai-task-policies.ts` — 新增 `reexplain` 任务类型

### 实现要点

**步骤动画（`TutorStepReveal.tsx`）：**
```typescript
// props: { steps: string[], onSkipAll: () => void }
// 内部维护 visibleCount state，useEffect + setTimeout 每 600ms 递增
// 渲染 steps.slice(0, visibleCount)，每步用 motion.div 的 y:10 -> y:0 入场动画
// 顶部右侧按钮"跳过动画"调 setVisibleCount(steps.length)
```

**换方式解释 API（`/api/ai/reexplain`）：**
```typescript
// body: { step: string, subject?: string, grade?: string }
// prompt: "请用生活中的类比或者画图的方式，重新解释下面这个解题步骤，避免用数学符号，用初中生能懂的语言：{step}"
// 复用 callRoutedLLM({ taskType: "reexplain" })
// 返回 { data: { explanation: string } }
```

**"我不懂"按钮：** 在每个 step 渲染后附加一个 `ghost` 按钮，点击后调 `/api/ai/reexplain`，响应内容替换在该步骤下方展开（不覆盖原步骤）。

**连续答对惊喜：** 在 `useTutorPage.ts` 维护 `consecutiveCorrectCount`，每次 coach 返回 `stage === "reveal"` 且学生提交了正确思路时递增。达到 3 时设 `showStreakCelebration = true`，渲染一个 3 秒自动消失的 `status-note success`。

---

## F-P1-05 系统化新手引导

GitHub issue 标题：`feat(onboarding): role-based guided tour with milestone reward`

### 背景

当前只有可关闭的 `GuideCard`（`StudentDashboardGuideCard.tsx`、`PracticeGuideCard.tsx`），对于多角色产品无法系统引导新用户。

### 验收标准

- [x] 新用户首次登录展示分步引导遮罩（Tooltip Tour），高亮核心功能区
- [x] 学生引导步骤：① 查看今日任务 → ② 开始第一道练习 → ③ 查看成长档案
- [x] 教师引导步骤：① 创建/查看班级 → ② 布置第一个作业 → ③ 查看风险预警
- [x] 完成引导后获得"新手起步"徽章（接入 `lib/progress.ts` 的 `getBadges`）
- [x] 用户可随时通过 ❓ 按钮重新触发引导

### 涉及文件

**新建：**
- `components/GuidedTour.tsx` — 通用 Tooltip Tour 组件
- `lib/onboarding.ts` — 引导完成状态读写（DB/JSON 双模式）
- `app/api/user/onboarding/route.ts` — GET 查询 / POST 标记完成
- `db/schema.sql` 追加 `user_onboarding_progress` 表

**修改：**
- `app/student/page.tsx` — 集成学生端引导
- `app/teacher/page.tsx` — 集成教师端引导
- `lib/progress.ts` — `getBadges` 新增 `onboarding-complete` 徽章

### 实现要点

**GuidedTour 组件接口：**
```typescript
type TourStep = {
  targetSelector: string;  // CSS selector，如 "#student-action-center"
  title: string;
  content: string;
  placement: "top" | "bottom" | "left" | "right";
};

type GuidedTourProps = {
  steps: TourStep[];
  onComplete: () => void;
  onSkip: () => void;
};
```

实现方式：用 `document.querySelector` 获取目标元素的 `getBoundingClientRect()`，在其旁边用 `position: fixed` 渲染高亮遮罩 + Tooltip 卡片。用 `framer-motion` 做位置过渡动画。

**DB schema：**
```sql
CREATE TABLE IF NOT EXISTS user_onboarding_progress (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  completed_steps TEXT[] NOT NULL DEFAULT '{}',
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**触发逻辑：** 在 `app/student/page.tsx` 顶部，通过 `useEffect` 调 `GET /api/user/onboarding`，若 `completed_at` 为 null 则 `setShowTour(true)`。引导完成后 `POST /api/user/onboarding { completed: true }`，同时触发 `onboarding-complete` 徽章。

**重新触发：** 在 `WorkspacePage` 的 actions 区域新增 `❓` 图标按钮，点击清空本地 `tourCompleted` state（不清 DB），重新展示引导。

---

## F-P2-01 跨学科 AI 项目式学习（PBL）

GitHub issue 标题：`feat(learning): cross-subject AI project-based learning`

### 背景

当前系统以单学科单知识点练习为主，缺乏综合应用场景。PBL 功能让学生完成跨学科项目，提升知识迁移能力。

### 验收标准

- [x] 教师/管理员可创建 PBL 项目，设定跨学科任务（每个子任务关联 1 个学科）
- [x] AI 根据主题自动生成项目骨架（子任务 + 关联学科 + 评分维度）
- [x] 学生分阶段提交成果，AI 给过程性评价
- [x] 优秀项目可由教师标记为"展示"，出现在班级展示墙

### 涉及文件

**新建：**
- `lib/pbl.ts` — PBL 数据模型和操作
- `lib/ai-pbl-generator.ts` — AI 生成项目骨架
- `app/student/projects/page.tsx` — 学生端项目列表与提交
- `app/teacher/projects/page.tsx` — 教师端项目管理与评价
- `app/api/projects/route.ts` — CRUD
- `app/api/projects/[id]/submit/route.ts` — 提交阶段成果
- `db/schema.sql` 追加 `pbl_projects`、`pbl_tasks`、`pbl_submissions` 三张表

**DB schema（简化版）：**
```sql
CREATE TABLE IF NOT EXISTS pbl_projects (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  subjects TEXT[] NOT NULL,
  class_id TEXT REFERENCES classes(id),
  created_by TEXT NOT NULL REFERENCES users(id),
  featured BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pbl_tasks (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES pbl_projects(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS pbl_submissions (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES pbl_tasks(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  ai_feedback TEXT,
  score INT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## F-P2-02 AI 同伴学习（费曼学习法）

GitHub issue 标题：`feat(learning): AI peer learning via Feynman technique`

### 背景

通过"教别人"来巩固知识是最有效的学习方式之一。本任务引入虚拟 AI 学伴，让学生通过发现和纠正"学伴的错误"来深化理解。

### 验收标准

- [x] 练习完一道题后，可点击"考考 AI 学伴"，AI 扮演犯了典型错误的同学
- [x] 学生指出错误后，AI 追问"你能解释为什么这里错了吗？"
- [x] 完成一次 AI 同伴纠错流程，获得 `peer-teacher` 徽章和额外 XP

### 涉及文件

**新建：**
- `lib/ai-peer-learner.ts` — 生成"含错误的解法"和追问逻辑
- `app/practice/_components/PracticePeerChallengeCard.tsx` — 同伴挑战卡片
- `app/api/ai/peer-learner/route.ts` — POST

**修改：**
- `app/practice/page.tsx` — 答题后在结果区展示"考考 AI 学伴"入口
- `lib/progress.ts` — 新增 `peer-teacher` 徽章
- `lib/gamification.ts` — 完成同伴纠错时调 `addXp(..., "peer_teaching", ..., +20)`

### 实现要点

**AI 学伴 prompt：**
```
你是一个刚学这道题的同学，你做出了一个典型错误的解法。请给出：
1. 错误解法（含具体错误步骤）
2. 一句"我觉得我的思路是对的"的困惑表达
题目：{question}，正确答案：{correctAnswer}，常见错误：{commonMistake}
```

---

## F-P2-03 课堂实时仪表盘

GitHub issue 标题：`feat(teacher): real-time classroom analytics dashboard`

### 背景

教师布置练习时，当前无法实时看到学生作答进度和正确率分布。本任务在教师端新增实时仪表盘页面。

### 验收标准

- [x] 教师发起"课堂练习"后，可进入实时仪表盘页面
- [x] 展示：已作答人数/总人数、当前题目正确率、最快/最慢学生列表
- [x] 每 10 秒自动刷新（或用 SSE 推送）
- [x] 教师可一键标记"继续下一题"，所有学生端看到提示

### 涉及文件

**新建：**
- `app/teacher/classroom-live/page.tsx` — 实时仪表盘页面
- `app/teacher/classroom-live/useClassroomLivePage.ts` — 数据钩子（10s 轮询）
- `app/api/teacher/classroom-live/[sessionId]/route.ts` — GET 实时数据
- `app/api/teacher/classroom-live/route.ts` — POST 创建课堂会话

**修改：**
- `app/teacher/page.tsx` 或导航 — 新增"发起课堂练习"入口

---

## F-P2-04 AI 生成内容质量增强

GitHub issue 标题：`feat(ai): enhanced quality assurance for AI-generated content`

### 背景

当前 `lib/ai-quality-control.ts` 有基础质量评分，但数学题缺少答案交叉验证，难度标定依赖 AI 预估而非实际数据。

### 验收标准

- [x] 数学题生成后，第二个 LLM provider 独立求解并比对答案，不一致时标记为"需人工复核"
- [x] 题目在积累 10 次以上作答后，自动校准实际难度系数（correct/total vs 预设 easy/medium/hard）
- [x] 管理端题库页展示每道题的"实际难度系数"与"预设难度"的偏差

### 涉及文件

**新建：**
- `lib/question-cross-validate.ts` — 双模型交叉验证逻辑
- `lib/difficulty-calibration.ts` — 难度校准计算

**修改：**
- `app/api/admin/questions/generate/route.ts` — 生成后触发交叉验证
- `lib/questions.ts` 或 DB schema — 增加 `actual_difficulty` 字段
- `app/admin/questions/page.tsx` — 展示实际 vs 预设难度偏差列

---

## F-P2-05 无障碍与包容性设计合规

GitHub issue 标题：`fix(a11y): WCAG 2.1 AA compliance audit and fixes`

### 背景

项目已有基础 ARIA 和 skip-link，但未做系统性无障碍审计。

### 验收标准

- [x] 使用 `axe-core` 或 `@axe-core/playwright` 自动扫描，zero critical violations
- [x] 深色模式下所有文本颜色对比度 ≥ 4.5:1（WCAG AA）
- [x] 数学公式区域（KaTeX/Temml）支持语音朗读替代文本
- [x] 所有 `<details>/<summary>` 折叠面板补齐 `aria-expanded`
- [x] 键盘 Tab 顺序正确，无 Focus 陷阱

### 涉及文件

**修改（按扫描结果定，以下为预估高发区）：**
- `app/styles/tokens.css` — 审查深色模式下的 `--ink-1`、`--surface-1` 对比度
- `components/MathText.tsx` — 为 LaTeX 输出添加 `aria-label` 或 `role="math"`
- 所有 `<details>` 使用处 — 补 `aria-expanded`

**新建：**
- `tests/browser/a11y.spec.ts` — Playwright + axe-core 自动扫描

**测试命令：**
```bash
npm run test:a11y  # 新增 npm script
```

import type {
  CapabilityBlock,
  Differentiator,
  FirstDayFlow,
  FirstLookItem,
  ProductStatusMetric,
  RoleLaunchCard
} from "./home.types";

export const HERO_PILLS = [
  "学生自主预习 / 复习",
  "教师数字人授课",
  "整班观看与导出",
  "家校回执闭环",
  "学校 AI 治理"
];

export const PRODUCT_STATUS_METRICS: ProductStatusMetric[] = [
  { label: "学生端", value: "学习主场", helper: "任务、课表、拍题与互动课堂合并为同一条学习主线" },
  { label: "教师端", value: "执行中枢", helper: "默认下一步、数字人、课堂分发和教学分析直接联动" },
  { label: "家长端", value: "行动闭环", helper: "今晚该做什么、如何回执、陪伴什么，不再让家长自己猜" },
  { label: "学校端", value: "治理驾驶舱", helper: "排课预演、回滚、模板与课堂治理形成完整管理链路" }
];

export const FIRST_LOOK_ITEMS: FirstLookItem[] = [
  { title: "学生", description: "先看到今天该推进什么，再进入课表、自学、拍题和成长沉淀。" },
  { title: "教师 / 家长", description: "先处理真正影响今天教学与陪伴节奏的动作，再展开分析和回执。" },
  { title: "学校 / 平台", description: "先看风险、策略与治理动作，再进入规则配置、排课、恢复和运营。" }
];

export const ROLE_LAUNCH_CARDS: RoleLaunchCard[] = [
  {
    id: "student",
    title: "学生",
    subtitle: "围绕今天该做什么组织学习流程，把课表、自学、拍题和成长沉淀放进同一主场。",
    tag: "学习主场",
    primaryLabel: "进入学生端",
    primaryHref: "/login?role=student&entry=landing",
    secondaryLabel: "学生注册",
    secondaryHref: "/register?role=student&entry=landing",
    highlights: ["先看今天该做什么", "卡住就拍题", "围绕课表推进"]
  },
  {
    id: "teacher",
    title: "教师",
    subtitle: "围绕真实教学节奏组织工作台，把默认下一步、互动课堂、作业与分析收束到一条执行链路。",
    tag: "教学执行",
    primaryLabel: "进入教师端",
    primaryHref: "/login?role=teacher&entry=landing",
    secondaryLabel: "教师注册",
    secondaryHref: "/teacher/register?entry=landing",
    highlights: ["先处理阻塞项", "再发作业和看分析", "按学期排座微调"]
  },
  {
    id: "parent",
    title: "家长",
    subtitle: "把今晚先做什么、怎样陪伴和如何回执讲清楚，让家长少焦虑、多行动。",
    tag: "陪伴闭环",
    primaryLabel: "进入家长端",
    primaryHref: "/login?role=parent&entry=landing",
    secondaryLabel: "家长注册",
    secondaryHref: "/register?role=parent&entry=landing",
    highlights: ["今晚优先动作", "回执闭环", "不再只看报告"]
  },
  {
    id: "school",
    title: "学校",
    subtitle: "用治理视角统筹课表、教师资源与课堂质量，做到先预演、再写入、可回滚。",
    tag: "学校治理",
    primaryLabel: "进入学校端",
    primaryHref: "/login?role=school_admin&entry=landing",
    secondaryLabel: "学校管理员注册",
    secondaryHref: "/school/register?entry=landing",
    highlights: ["排前检查", "先预演再写入", "课表问题可回滚"]
  },
  {
    id: "admin",
    title: "平台管理",
    subtitle: "围绕内容、模型、实验与恢复工单组织平台能力，保证产品持续稳定演进。",
    tag: "平台运营",
    primaryLabel: "进入管理端",
    primaryHref: "/login?role=admin&entry=landing",
    secondaryLabel: "管理员注册",
    secondaryHref: "/admin/register?entry=landing",
    highlights: ["处理异常与恢复", "看实验与发布", "管理 AI 路由"]
  }
];

export const FIRST_DAY_FLOWS: FirstDayFlow[] = [
  {
    id: "student",
    roleLabel: "学生首日",
    tag: "1 天上手",
    href: "/student",
    steps: [
      { title: "打开学习控制台", description: "系统先把课表、任务和下一步动作排好，不需要自己猜。" },
      { title: "按课表窗口推进", description: "临近上课先看课前准备，卡题直接拍题，不再来回切页面。" },
      { title: "收口今日任务", description: "统一任务队列会自动区分今天必须先清和适合课后做的任务。" }
    ]
  },
  {
    id: "teacher",
    roleLabel: "教师首日",
    tag: "1 天起跑",
    href: "/teacher",
    steps: [
      { title: "先看默认下一步", description: "优先处理入班申请、学情预警和未形成闭环的班级。" },
      { title: "快速发出第一份作业", description: "班级一旦有任务，成绩册、分析和家校协同都会跟着启动。" },
      { title: "必要时进入学期排座", description: "用 AI 先出预览，再微调，避免全学期反复重排。" }
    ]
  },
  {
    id: "parent",
    roleLabel: "家长首日",
    tag: "今晚可用",
    href: "/parent",
    steps: [
      { title: "先看今晚先做什么", description: "系统先推最影响今晚学习节奏的一步，而不是让家长自己判断。" },
      { title: "按行动卡回执", description: "周报行动卡和作业行动卡都能打卡或说明跳过原因。" },
      { title: "围绕薄弱点做短陪伴", description: "少说泛泛提醒，多做 10-15 分钟的针对性陪练。" }
    ]
  },
  {
    id: "school",
    roleLabel: "学校首日",
    tag: "本周可落地",
    href: "/school/schedules",
    steps: [
      { title: "先看治理总览", description: "学校控制台先告诉你哪些班级、教师或课表环节最值得优先修。" },
      { title: "补模板和约束", description: "先补教师禁排、教师规则、同年级同学科模板，再开 AI 预演。" },
      { title: "AI 预演后再写入", description: "写入前能看结果、写入后可回滚，避免误操作覆盖全校课表。" }
    ]
  }
];

export const DIFFERENTIATORS: Differentiator[] = [
  { title: "不是把功能堆在一起，而是把下一步讲清楚", description: "学生、教师、家长和学校都先被带入最适合的动作，而不是在一堆入口里做选择题。" },
  { title: "不是只放 AI 能力，而是把 AI 放进真实教学链路", description: "互动课堂、数字人、拍题、排课和治理能力都围绕真实场景组织，而不是孤立工具箱。" },
  { title: "不是只展示数据，而是让行动和回执发生", description: "从课堂交付、家校回执到学校治理，平台强调闭环感与后续动作，不让分析停在图表里。" }
];

export const CAPABILITY_BLOCKS: CapabilityBlock[] = [
  {
    title: "学生不再犹豫下一步",
    description: "把课表、今日执行摘要、快问快答和统一任务队列收敛到一个学习主场。",
    icon: "rocket",
    href: "/student"
  },
  {
    title: "教师先处理真正阻塞项",
    description: "从首页就能看到入班申请、活跃预警、临近截止作业和班级风险趋势。",
    icon: "chart",
    href: "/teacher"
  },
  {
    title: "家长端是行动台，不只是周报页",
    description: "先推今晚先做什么，再看作业、订正、薄弱点和收藏题复盘。",
    icon: "board",
    href: "/parent"
  },
  {
    title: "学校排课可预演、可回滚、可治理",
    description: "从模板、规则、禁排时段到 AI 一键排课，全都围绕真实管理体验。",
    icon: "brain",
    href: "/school/schedules"
  }
];

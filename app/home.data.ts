import type {
  CapabilityBlock,
  Differentiator,
  FirstDayFlow,
  FirstLookItem,
  ProductStatusMetric,
  RoleLaunchCard
} from "./home.types";

export const HERO_PILLS = [
  "学生学习主线",
  "教师教学执行",
  "家长陪伴回执",
  "学校质量视图"
];

export const PRODUCT_STATUS_METRICS: ProductStatusMetric[] = [
  { label: "学生端", value: "知序学习台", helper: "先看到今天要推进什么，再进入课表、自学、拍题与课堂。" },
  { label: "教师端", value: "知序教学台", helper: "把今日待处理、课堂准备和教学反馈收束成一条执行链路。" },
  { label: "家长端", value: "知序陪伴台", helper: "今晚先做什么、如何回执、需要陪伴什么都会被讲清楚。" },
  { label: "学校端", value: "知序校务台", helper: "从预演排课到课堂质量复盘，形成连续可治理视图。" }
];

export const FIRST_LOOK_ITEMS: FirstLookItem[] = [
  { title: "多角色直达", description: "学生、教师、家长和学校都能在第一屏直接进入自己的工作台。" },
  { title: "注册边界清晰", description: "学生与家长可自助注册，教师、学校和平台管理账号必须按授权路径开通。" },
  { title: "课堂作为次入口", description: "当目标已经明确为开课、看课或发布时，再进入知序课堂。" }
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
    subtitle: "围绕真实教学节奏组织教学台，把今日待处理、知序课堂、作业与分析收束到一条执行链路。",
    tag: "教学执行",
    primaryLabel: "进入教师端",
    primaryHref: "/login?role=teacher&entry=landing",
    secondaryLabel: "教师账号开通",
    secondaryHref: "/teacher/register?entry=landing&role=teacher",
    highlights: ["先看今日待办", "学校邀请码或授权开通", "再发作业和看分析"]
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
    subtitle: "用质量视角统筹课表、教师应用与课堂覆盖，做到先预演、再确认、可复盘。",
    tag: "课堂质量",
    primaryLabel: "进入学校端",
    primaryHref: "/login?role=school_admin&entry=landing",
    secondaryLabel: "学校账号开通",
    secondaryHref: "/school/register?entry=landing&role=school_admin",
    highlights: ["排前检查", "先预演再写入", "需学校授权后开通"]
  },
  {
    id: "admin",
    title: "平台管理",
    subtitle: "围绕内容、模型、实验与恢复工单组织平台能力，保证产品持续稳定演进。",
    tag: "平台运营",
    primaryLabel: "进入管理端",
    primaryHref: "/login?role=admin&entry=landing",
    secondaryLabel: "平台管理账号开通",
    secondaryHref: "/admin/register?entry=landing&role=admin",
    highlights: ["处理异常与恢复", "看实验与发布", "需平台授权开通"]
  }
];

export const FIRST_DAY_FLOWS: FirstDayFlow[] = [
  {
    id: "student",
    roleLabel: "学生首日",
    tag: "1 天上手",
    href: "/student",
    steps: [
      { title: "打开今日学习", description: "系统先把课表、任务和下一步动作排好，不需要自己猜。" },
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
      { title: "先看今日待处理", description: "优先处理入班申请、学情预警和未形成闭环的班级。" },
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
      { title: "先看质量总览", description: "学校首页先告诉你哪些班级、教师或课表环节最值得优先跟进。" },
      { title: "补模板和约束", description: "先补教师禁排、教师规则、同年级同学科模板，再开 AI 预演。" },
      { title: "AI 预演后再写入", description: "写入前能看结果、写入后可回滚，避免误操作覆盖全校课表。" }
    ]
  }
];

export const DIFFERENTIATORS: Differentiator[] = [
  { title: "不是把功能堆在一起，而是把下一步讲清楚", description: "学生、教师、家长和学校都先被带入最适合的动作，而不是在一堆入口里做选择题。" },
  { title: "不是只放 AI 能力，而是把 AI 放进真实教学", description: "知序课堂、教师讲解形象、拍题和排课都围绕真实场景组织，而不是孤立工具箱。" },
  { title: "不是只展示数据，而是让行动和回执发生", description: "从课堂分享、家校回执到学校质量视图，平台强调闭环感与后续动作，不让分析停在图表里。" }
];

export const CAPABILITY_BLOCKS: CapabilityBlock[] = [
  {
    title: "学生不再犹豫下一步",
    description: "把课表、今日执行摘要、快问快答和统一任务队列收敛到一个学习主场。",
    icon: "rocket",
    href: "/student"
  },
  {
    title: "教师先处理真正影响课堂的事",
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
    title: "学校排课可预演、可复盘",
    description: "从模板、规则、禁排时段到 AI 一键排课，全都围绕真实管理体验。",
    icon: "brain",
    href: "/school/schedules"
  }
];

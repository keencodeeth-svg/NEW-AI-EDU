import { CLASSROOM_PRODUCT_NAME } from "@/lib/classroom/brand";

export type AppRole = "student" | "teacher" | "parent" | "admin" | "school_admin";

export type NavLink = { href: string; label: string };
export type NavGroup = { title: string; links: NavLink[] };
export type RoleNavConfig = {
  primary: NavLink[];
  groups: NavGroup[];
};

export const roleNavConfig: Record<AppRole, RoleNavConfig> = {
  student: {
    primary: [
      { href: "/student", label: "学习控制台" },
      { href: "/student/assignments", label: "作业中心" },
      { href: "/student/exams", label: "在线考试" },
      { href: "/wrong-book", label: "错题复练" },
      { href: "/tutor", label: "AI 辅导" },
      { href: "/student/interactive-classroom", label: CLASSROOM_PRODUCT_NAME },
    ],
    groups: [
      {
        title: "学习节奏",
        links: [
          { href: "/dashboard", label: "学习总看板" },
          { href: "/plan", label: "学习计划" },
          { href: "/practice", label: "练习" },
          { href: "/coach", label: "学习陪练" },
        ],
      },
      {
        title: "专项能力",
        links: [
          { href: "/student/modules", label: "课程模块" },
          { href: "/diagnostic", label: "诊断测评" },
          { href: "/student/knowledge-map", label: "知识图谱" },
          { href: "/student/projects", label: "项目式学习" },
          { href: "/reading", label: "朗读评分" },
          { href: "/writing", label: "写作批改" },
        ],
      },
      {
        title: "成长追踪",
        links: [
          { href: "/report", label: "学习报告" },
          { href: "/student/growth", label: "成长画像" },
          { href: "/challenge", label: "挑战任务" },
          { href: "/focus", label: "专注计时" },
        ],
      },
      {
        title: "资源协作",
        links: [
          { href: "/course", label: "课程主页" },
          { href: "/library", label: "教材课件" },
          { href: "/discussions", label: "讨论区" },
          { href: "/files", label: "文件中心" },
          { href: "/inbox", label: "收件箱" },
          { href: "/calendar", label: "课程表" },
          { href: "/announcements", label: "班级公告" },
          { href: "/notifications", label: "通知中心" },
        ],
      },
    ],
  },
  teacher: {
    primary: [
      { href: "/teacher", label: "教师工作台" },
      { href: "/teacher/analysis", label: "学情分析" },
      { href: "/teacher/gradebook", label: "成绩册" },
      { href: "/teacher/submissions", label: "提交箱" },
      { href: "/teacher/exams", label: "在线考试" },
      { href: "/ai-classroom", label: CLASSROOM_PRODUCT_NAME },
    ],
    groups: [
      {
        title: "教学总览",
        links: [
          { href: "/dashboard", label: "教学总看板" },
          { href: "/teacher/modules", label: "课程模块" },
          { href: "/teacher/seating", label: "学期排座" },
        ],
      },
      {
        title: "教学执行",
        links: [
          { href: "/teacher/notifications", label: "通知规则" },
          { href: "/teacher/lesson-planner", label: "AI 备课助手" },
          { href: "/teacher/classroom-live", label: "课堂实时仪表盘" },
          { href: "/teacher/projects", label: "项目式学习" },
          { href: "/teacher/ai-tools", label: "教师 AI 工具" },
        ],
      },
      {
        title: "课程资源",
        links: [
          { href: "/course", label: "课程主页" },
          { href: "/library", label: "教材课件" },
          { href: "/files", label: "文件中心" },
          { href: "/calendar", label: "教学课表" },
          { href: "/announcements", label: "班级公告" },
        ],
      },
      {
        title: "班级协作",
        links: [
          { href: "/discussions", label: "讨论区" },
          { href: "/inbox", label: "收件箱" },
        ],
      },
    ],
  },
  parent: {
    primary: [
      { href: "/parent", label: "家长端" },
      { href: "/calendar", label: "课程表" },
      { href: "/notifications", label: "通知中心" },
    ],
    groups: [
      {
        title: "补充总览",
        links: [{ href: "/dashboard", label: "家长总看板" }],
      },
      {
        title: "家校协同",
        links: [
          { href: "/course", label: "课程主页" },
          { href: "/discussions", label: "讨论区" },
          { href: "/files", label: "文件中心" },
          { href: "/inbox", label: "收件箱" },
          { href: "/announcements", label: "班级公告" },
        ],
      },
    ],
  },
  admin: {
    primary: [
      { href: "/admin", label: "管理端" },
      { href: "/library", label: "教材课件" },
      { href: "/admin/questions", label: "题库管理" },
      { href: "/admin/knowledge-points", label: "知识点管理" },
      { href: "/admin/knowledge-tree", label: "知识点树" },
      { href: "/admin/experiments", label: "实验中心" },
      { href: "/admin/ai-models", label: "AI模型中心" },
      { href: "/admin/launch-readiness", label: "上线准备中心" },
      { href: "/admin/recovery-requests", label: "账号恢复工单" },
      { href: "/admin/logs", label: "操作日志" },
    ],
    groups: [
      {
        title: "内容治理",
        links: [
          { href: "/admin/questions", label: "题库管理" },
          { href: "/admin/knowledge-points", label: "知识点管理" },
          { href: "/admin/knowledge-tree", label: "知识点树" },
          { href: "/library", label: "教材课件" },
        ],
      },
      {
        title: "实验与模型",
        links: [
          { href: "/admin/experiments", label: "A/B与灰度" },
          { href: "/admin/ai-models", label: "模型路由策略" },
          { href: "/admin/launch-readiness", label: "上线准备中心" },
        ],
      },
      {
        title: "审计运维",
        links: [
          { href: "/admin/recovery-requests", label: "账号恢复工单" },
          { href: "/admin/logs", label: "操作日志" },
          { href: "/admin", label: "控制台总览" },
        ],
      },
    ],
  },
  school_admin: {
    primary: [
      { href: "/school", label: "学校控制台" },
      { href: "/school/interactive-classrooms", label: "课堂质量" },
      { href: "/school/classes", label: "学校班级" },
      { href: "/school/schedules", label: "课程表管理" },
      { href: "/school/teachers", label: "教师管理" },
      { href: "/school/students", label: "学生管理" },
    ],
    groups: [
      {
        title: "组织治理",
        links: [
          { href: "/school/classes", label: "班级总览" },
          { href: "/school/teachers", label: "教师名单" },
          { href: "/school/students", label: "学生名单" },
        ],
      },
      {
        title: "教学协同",
        links: [
          { href: "/dashboard", label: "数据看板" },
          { href: "/school/interactive-classrooms", label: "课堂质量中心" },
          { href: "/school/schedules", label: "课程表管理" },
          { href: "/library", label: "教材课件" },
        ],
      },
    ],
  },
};

export const guestPrimaryLinks: NavLink[] = [
  { href: "/", label: "首页" },
  { href: "/ai-classroom", label: CLASSROOM_PRODUCT_NAME },
  { href: "/login", label: "登录" },
  { href: "/register", label: "学生/家长注册" },
];

export const guestGroups: NavGroup[] = [
  {
    title: "注册入口",
    links: [
      { href: "/teacher/register", label: "教师注册" },
      { href: "/admin/register", label: "管理员注册" },
      { href: "/school/register", label: "学校管理员注册" },
    ],
  },
];

export const roleLabelMap: Record<AppRole, string> = {
  student: "学生空间",
  teacher: "教师空间",
  parent: "家长空间",
  admin: "管理空间",
  school_admin: "学校空间",
};

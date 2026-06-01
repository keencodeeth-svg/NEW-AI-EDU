import type { TTSProviderId } from "./audio/types";
import type { ImageProviderId } from "./media/types";
import { SUBJECT_LABELS } from "./constants";
import { PRODUCT_BRAND_NAME as PRODUCT_BRAND_NAME_VALUE } from "./classroom/brand";
export {
  CLASSROOM_PRODUCT_NAME,
  PLATFORM_BRAND_NAME,
  PLATFORM_BRAND_SUBTITLE,
  PLATFORM_BRAND_TAGLINE,
  PLATFORM_PRODUCT_NAME,
  PRODUCT_BRAND_NAME,
  PRODUCT_BRAND_SUBTITLE,
  PRODUCT_BRAND_TAGLINE,
  PRODUCT_SERVICE_NAME,
} from "./classroom/brand";

const PRODUCT_BRAND_NAME = PRODUCT_BRAND_NAME_VALUE;

export type ClassroomSource = "teacher-tools" | "library" | "direct" | "student-self-study";
export type ClassroomAudienceMode = "teacher-private" | "whole-class";
export type ClassroomExportFormat = "pptx" | "resource-pack";
export type ClassroomDeliveryKind = "publish" | "export";
export type ClassroomDeliveryActorRole = "teacher" | "student" | "school_admin" | "admin";
export type ClassroomLearningMode =
  | "teacher-led"
  | "preview-preparation"
  | "subject-reinforcement"
  | "interest-cultivation"
  | "classroom-review";

export interface TeacherDigitalHumanProfile {
  teacherId: string;
  displayName: string;
  title?: string;
  portraitPrompt?: string;
  portraitUrl?: string;
  imageProviderId?: ImageProviderId;
  voiceProviderId?: TTSProviderId;
  voiceId?: string;
  voiceLabel?: string;
  introduction?: string;
  sampleScript?: string;
  updatedAt: string;
}

export interface ClassroomTeacherContext {
  id: string;
  name: string;
  email?: string;
  subject?: string;
  title?: string;
  digitalHuman?: TeacherDigitalHumanProfile | null;
}

export interface ClassroomStudentContext {
  id: string;
  name: string;
  grade?: string;
  email?: string;
}

export interface ClassroomContext {
  source: ClassroomSource;
  classId?: string;
  className?: string;
  subject?: string;
  grade?: string;
  learningMode?: ClassroomLearningMode;
  teacher?: ClassroomTeacherContext | null;
  learner?: ClassroomStudentContext | null;
  students?: ClassroomStudentContext[];
  audienceMode?: ClassroomAudienceMode;
  exportFormats?: ClassroomExportFormat[];
  learnerGoal?: string;
  focusKnowledgePointTitle?: string;
  interestTopic?: string;
}

export interface StageClassroomMeta {
  brandName: string;
  source: ClassroomSource;
  classId?: string;
  className?: string;
  subject?: string;
  grade?: string;
  learningMode?: ClassroomLearningMode;
  audienceMode: ClassroomAudienceMode;
  exportFormats: ClassroomExportFormat[];
  teacher?: ClassroomTeacherContext | null;
  learner?: ClassroomStudentContext | null;
  students?: ClassroomStudentContext[];
  speakerStudentIds?: string[];
  studentCount: number;
  learnerGoal?: string;
  focusKnowledgePointTitle?: string;
  interestTopic?: string;
  publishedUrl?: string;
  publishedAt?: string;
  deliveryRecords?: ClassroomDeliveryRecord[];
}

export interface ClassroomDeliveryRecord {
  id: string;
  kind: ClassroomDeliveryKind;
  createdAt: string;
  audienceMode?: ClassroomAudienceMode;
  format?: ClassroomExportFormat | "share-link";
  label: string;
  fileName?: string;
  publishedUrl?: string;
}

export interface ClassroomDeliveryAuditRecord {
  id: string;
  schoolId: string;
  actorUserId: string;
  actorName?: string;
  actorRole: ClassroomDeliveryActorRole;
  stageId: string;
  stageName: string;
  source?: ClassroomSource;
  classId?: string;
  className?: string;
  subject?: string;
  grade?: string;
  learningMode?: ClassroomLearningMode;
  audienceMode?: ClassroomAudienceMode;
  studentCount?: number;
  teacherId?: string;
  teacherName?: string;
  learnerId?: string;
  learnerName?: string;
  kind: ClassroomDeliveryKind;
  format?: ClassroomExportFormat | "share-link";
  label: string;
  fileName?: string;
  publishedUrl?: string;
  createdAt: string;
}

export interface ClassroomDeliveryClassSummary {
  key: string;
  classId?: string;
  className: string;
  subject?: string;
  grade?: string;
  deliveryCount: number;
  publishCount: number;
  exportCount: number;
  lastDeliveredAt: string;
}

export interface SchoolClassroomDeliverySummary {
  schoolId: string;
  totalDeliveries: number;
  deliveredClassroomCount: number;
  coveredClassCount: number;
  publishCount: number;
  exportCount: number;
  pptxExportCount: number;
  resourcePackExportCount: number;
  wholeClassDeliveryCount: number;
  studentInitiatedCount: number;
  teacherInitiatedCount: number;
  recentDeliveries: ClassroomDeliveryAuditRecord[];
  topClasses: ClassroomDeliveryClassSummary[];
}

export interface SchoolClassroomDeliveryFilterOptions {
  actorRoles: ClassroomDeliveryActorRole[];
  audienceModes: ClassroomAudienceMode[];
  learningModes: ClassroomLearningMode[];
  kinds: ClassroomDeliveryKind[];
  formats: Array<ClassroomExportFormat | "share-link">;
  classNames: string[];
  subjects: string[];
  grades: string[];
}

export interface SchoolClassroomDeliveryDetailPayload {
  summary: SchoolClassroomDeliverySummary;
  records: ClassroomDeliveryAuditRecord[];
  filterOptions: SchoolClassroomDeliveryFilterOptions;
}

type GeneratedParticipantProfile = {
  id: string;
  name: string;
  role: "teacher" | "student";
  persona: string;
  avatar: string;
  color: string;
  priority: number;
};

const TEACHER_AVATAR_FALLBACKS = [
  "/avatars/hangke-mentor.svg",
  "/avatars/hangke-assistant.svg",
];

const STUDENT_AVATAR_FALLBACKS = [
  "/avatars/hangke-explorer.svg",
  "/avatars/hangke-analyst.svg",
  "/avatars/hangke-builder.svg",
  "/avatars/hangke-reflector.svg",
  "/avatars/hangke-learner.svg",
];

const PARTICIPANT_COLORS = [
  "#1D4ED8",
  "#0F766E",
  "#0E7490",
  "#F59E0B",
  "#EA580C",
  "#334155",
  "#14B8A6",
];

const STUDENT_PERSONA_SEEDS = [
  "会主动提问、乐于追问“为什么”，适合在关键节点代表全班发起追问。",
  "擅长整理课堂笔记，喜欢把老师的讲解拆成步骤，适合承担总结和复述。",
  "偏实践型，遇到例题会第一时间尝试作答，适合推动课堂练习和即时反馈。",
  "更关注易错点和边界条件，适合提醒全班避免常见误区。",
];

function stableIndex(input: string, modulo: number) {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }
  return modulo > 0 ? hash % modulo : 0;
}

function cleanText(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export function buildAudienceModeLabel(mode?: ClassroomAudienceMode | null) {
  if (mode === "teacher-private") {
    return "私享启动";
  }
  return "全班观看";
}

export function buildSubjectLabel(subject?: string | null) {
  const normalized = cleanText(subject);
  if (!normalized) {
    return "综合";
  }
  return SUBJECT_LABELS[normalized] ?? normalized;
}

export function buildLearningModeLabel(mode?: ClassroomLearningMode | null) {
  if (mode === "preview-preparation") {
    return "课前预习";
  }
  if (mode === "subject-reinforcement") {
    return "学科巩固";
  }
  if (mode === "interest-cultivation") {
    return "兴趣培养";
  }
  if (mode === "classroom-review") {
    return "课堂回看";
  }
  return "课堂教学";
}

export function buildExportFormatLabel(format: ClassroomExportFormat) {
  if (format === "resource-pack") {
    return "资源包";
  }
  return "PPTX 课件";
}

export function buildExportFormatDescription(format: ClassroomExportFormat) {
  if (format === "resource-pack") {
    return "包含 PPT、互动页面与课堂说明，适合归档、二次分发与课后复用。";
  }
  return "适合整班投屏、备课演示与学校常规课件流转。";
}

export function buildDeliveryFormatLabel(format?: ClassroomExportFormat | "share-link") {
  if (format === "share-link") {
    return "全班观看链接";
  }
  if (format === "resource-pack") {
    return "资源包";
  }
  if (format === "pptx") {
    return "PPTX 课件";
  }
  return "课堂交付";
}

export function buildDeliveryRecordLabel(input: {
  kind: ClassroomDeliveryKind;
  format?: ClassroomExportFormat | "share-link";
}) {
  if (input.kind === "publish") {
    return "全班观看发布";
  }
  if (input.format === "resource-pack") {
    return "课堂资源包导出";
  }
  return "班级课件导出";
}

export function appendClassroomDeliveryRecord(
  classroomMeta: StageClassroomMeta,
  record: Omit<ClassroomDeliveryRecord, "id" | "label"> & { label?: string },
) {
  const nextRecord: ClassroomDeliveryRecord = {
    ...record,
    id: `${record.kind}-${record.format || "default"}-${Date.now()}`,
    label:
      record.label ||
      buildDeliveryRecordLabel({
        kind: record.kind,
        format: record.format,
      }),
  };

  return {
    ...classroomMeta,
    deliveryRecords: [nextRecord, ...(classroomMeta.deliveryRecords ?? [])].slice(0, 8),
  };
}

export function buildStageClassroomMeta(
  classroomContext?: ClassroomContext | null,
): StageClassroomMeta | undefined {
  if (!classroomContext) {
    return undefined;
  }

  const students = (classroomContext.students ?? []).filter((item) => cleanText(item.name));
  const learner = classroomContext.learner && cleanText(classroomContext.learner.name)
    ? classroomContext.learner
    : null;
  const participants = students.length > 0 ? students : learner ? [learner] : [];
  const speakerStudentIds = participants.slice(0, 4).map((item) => item.id);

  return {
    brandName: PRODUCT_BRAND_NAME,
    source: classroomContext.source,
    classId: classroomContext.classId,
    className: classroomContext.className,
    subject: classroomContext.subject,
    grade: classroomContext.grade,
    learningMode: classroomContext.learningMode,
    audienceMode: classroomContext.audienceMode ?? "whole-class",
    exportFormats: classroomContext.exportFormats ?? ["pptx", "resource-pack"],
    teacher: classroomContext.teacher ?? null,
    learner,
    students: participants,
    speakerStudentIds,
    studentCount: participants.length,
    learnerGoal: cleanText(classroomContext.learnerGoal),
    focusKnowledgePointTitle: cleanText(classroomContext.focusKnowledgePointTitle),
    interestTopic: cleanText(classroomContext.interestTopic),
  };
}

export function buildClassroomAgents(
  classroomContext?: ClassroomContext | null,
): GeneratedParticipantProfile[] {
  if (!classroomContext?.teacher && !classroomContext?.learner) {
    return [];
  }

  const teacher = classroomContext.teacher;
  const learner = classroomContext.learner;
  const teacherDigitalHuman = teacher?.digitalHuman;
  const subject = classroomContext.subject ? `${classroomContext.subject}学科` : "当前学科";
  const grade = classroomContext.grade ? `${classroomContext.grade}年级` : "当前年级";
  const className = classroomContext.className ?? "当前班级";
  const teacherName = teacherDigitalHuman?.displayName || teacher?.name || `${subject}学习教练`;
  const teacherTitle =
    cleanText(teacherDigitalHuman?.title) ||
    cleanText(teacher?.title) ||
    (learner ? "一对一学习教练" : "授课教师");
  const teacherIntro =
    cleanText(teacherDigitalHuman?.introduction) ||
    (learner
      ? `${teacherTitle}，负责围绕${learner.name}的学习目标，把${subject}内容讲清楚、讲有趣，并在关键节点安排追问、互动和鼓励反馈。`
      : `${teacherTitle}，负责把${className}的${subject}课堂讲清楚、讲扎实，并根据学生反馈即时调整讲解节奏。`);

  const teacherAgent: GeneratedParticipantProfile = {
    id: teacher ? `teacher-${teacher.id}` : `mentor-${learner?.id || "self-study"}`,
    name: teacherName,
    role: "teacher",
    persona: [
      learner
        ? `你是为${learner.name}提供一对一支持的${teacherTitle}，面向${grade}${subject}开展学生自主学习课堂。`
        : `你是${className}的${teacherTitle}，面向${grade}${subject}开展真实课堂教学。`,
      teacherIntro,
      learner
        ? "你需要像优秀教师一样先搭好学习情境，再组织讲解、提问、小练习和总结，确保内容适合学生独立观看、跟练和回放。"
        : "你需要像真正授课一样组织导入、讲解、互动提问、板书推进和课堂总结，确保内容适合整班投屏观看与课后导出复用。",
    ].join(" "),
    avatar: teacherDigitalHuman?.portraitUrl || TEACHER_AVATAR_FALLBACKS[0],
    color: PARTICIPANT_COLORS[0],
    priority: 10,
  };

  const studentPool = (
    classroomContext.students?.length
      ? classroomContext.students
      : learner
        ? [learner]
        : []
  )
    .filter((item) => cleanText(item.name))
    .slice(0, learner ? 1 : 4)
    .map((student, index) => {
      const styleSeed = STUDENT_PERSONA_SEEDS[index % STUDENT_PERSONA_SEEDS.length];
      const avatar =
        STUDENT_AVATAR_FALLBACKS[stableIndex(student.id || student.name, STUDENT_AVATAR_FALLBACKS.length)];
      const color = PARTICIPANT_COLORS[(index + 1) % PARTICIPANT_COLORS.length];
      return {
        id: `student-${student.id}`,
        name: student.name,
        role: "student" as const,
        persona: [
          learner
            ? `你是正在自主使用知序课堂学习的学生 ${student.name}${student.grade ? `，当前所在年级为${student.grade}` : ""}。`
            : `你是${className}的真实学生 ${student.name}${student.grade ? `，当前所在年级为${student.grade}` : ""}。`,
          styleSeed,
          learner
            ? "回答要像真实学习中的学生自述，体现提问、尝试作答和自我修正，不要像老师一样长篇讲解。"
            : "回答要像真实课堂中的学生发言，简洁自然，不要像助教或讲师一样长篇讲解。",
        ].join(" "),
        avatar,
        color,
        priority: Math.max(4, 7 - index),
      };
    });

  if (studentPool.length === 0) {
    studentPool.push({
      id: `student-class-${classroomContext.classId || "audience"}`,
      name: learner ? `${learner.name}学习分身` : `${className}学生代表`,
      role: "student",
      persona: [
        learner
          ? `你代表${learner.name}在自主学习课堂中发言。`
          : `你代表${className}的真实学生在课堂上发言。`,
        learner
          ? "你会提出学习中最容易出现的困惑，并用真实学生语气简短反馈自己的理解进度。"
          : "你会提出同学最容易产生的疑问，并用真实课堂中的学生语气作出简短回应。",
        "不要长篇讲解，重点体现学生提问、尝试作答和反馈理解的过程。",
      ].join(" "),
      avatar: STUDENT_AVATAR_FALLBACKS[0],
      color: PARTICIPANT_COLORS[1],
      priority: 5,
    });
  }

  return [teacherAgent, ...studentPool];
}

export function buildLaunchRequirementWithClassroomContext(input: {
  baseRequirement: string;
  classroomContext?: ClassroomContext | null;
}) {
  const requirement = input.baseRequirement.trim();
  if (!input.classroomContext) {
    return requirement;
  }

  const context = input.classroomContext;
  if (context.source === "student-self-study") {
    const learnerName = context.learner?.name || "当前学生";
    const isExperienceMode = isExperienceModeClassroomContext(context);
    const modeSpecificLines =
      context.learningMode === "preview-preparation"
        ? [
            "- 先用学生已有认知做旧知激活，再搭出本节内容的知识主线和进入课堂前的问题清单。",
            "- 预习模式不要一次讲完整章，而要优先帮助学生知道“这节课要学什么、哪里可能听不懂”。",
            "- 预习检测以理解准备度为主，题量小但要能快速暴露盲点。",
          ]
        : context.learningMode === "subject-reinforcement"
          ? [
              "- 学科巩固要围绕薄弱知识点或最近刚练过的主题安排巩固环节和即时练习。",
              "- 讲解要强调分步拆解、易错点提醒和讲后立练，避免只讲概念不检验。",
              "- 最后给出一题迁移或变式，帮助学生把“听懂”转成“做稳”。",
            ]
          : context.learningMode === "classroom-review"
            ? [
                "- 课堂回看要优先回收主线、提炼重点和纠正常见误区，不要重新讲成一节全新课堂。",
                "- 回看模式要引导学生复述关键概念、题型或步骤，形成自己的总结卡。",
                "- 最后给出 1 轮短追练或回看后的下一步建议，帮助学生完成收口。",
              ]
            : [
                "- 兴趣探索要兼顾趣味性与启发性，用学生能听懂的语言把概念讲清楚。",
                "- 可以加入故事化情境、项目式追问和延伸任务，让学生愿意继续探索。",
                "- 最后要留下一个适合学生继续查找或动手尝试的下一步问题。",
              ];
    const contextLines = [
      requirement,
      "",
      isExperienceMode
        ? "请将本次内容按体验模式示例课堂进行编排，不要宣称已接入真实学生画像、任务或课表："
        : "请将本次内容按学生自主使用的互动课堂进行编排：",
      `学习者：${learnerName}`,
      context.grade ? `年级：${context.grade}` : "",
      context.subject ? `学习学科：${buildSubjectLabel(context.subject)}` : "",
      `使用模式：${buildLearningModeLabel(context.learningMode)}`,
      isExperienceMode ? "体验边界：真实画像、任务、课表未接入，本次仅展示示例课堂流程。" : "",
      context.focusKnowledgePointTitle ? `当前巩固重点：${context.focusKnowledgePointTitle}` : "",
      context.interestTopic ? `兴趣主题：${context.interestTopic}` : "",
      context.learnerGoal ? `学习目标：${context.learnerGoal}` : "",
      `观看方式：${buildAudienceModeLabel(context.audienceMode)}`,
      "课堂要求：",
      "- 内容适合单人自主观看与跟练，先建立情境，再进行讲解、追问、小练习和鼓励反馈。",
      ...modeSpecificLines,
      isExperienceMode
        ? "- 成品只作为体验模式示例课堂展示，必须持续提醒真实个人进度、学习画像和课表尚未接入。"
        : "- 成品既要适合学生自主学习，也要支持回看与导出复用。",
    ].filter(Boolean);

    return contextLines.join("\n");
  }

  const teacherName =
    context.teacher?.digitalHuman?.displayName || context.teacher?.name || "当前授课教师";
  const studentCount = context.students?.length ?? 0;

  const contextLines = [
    requirement,
    "",
    "请将本次内容按真实教务课堂进行编排，不要使用虚构身份：",
    context.className ? `班级：${context.className}` : "",
    context.grade ? `年级：${context.grade}` : "",
    context.subject ? `学科：${buildSubjectLabel(context.subject)}` : "",
    `授课教师：${teacherName}`,
    studentCount ? `班级学生数：${studentCount}` : "",
    `观看方式：${buildAudienceModeLabel(context.audienceMode)}`,
    "课堂要求：",
    "- 互动角色优先使用真实教师与真实学生的课堂身份进行对话。",
    "- 课堂成品要适合整班投屏、录播回看和课后导出复用。",
    "- 语言风格保持学校正式课堂表达，不要出现虚构项目品牌。",
  ].filter(Boolean);

  return contextLines.join("\n");
}

export function isExperienceModeClassroomContext(
  classroomContext?: ClassroomContext | null,
) {
  return (
    classroomContext?.source === "student-self-study" &&
    (classroomContext.className === "体验模式示例课堂" ||
      classroomContext.learner?.id === "experience-mode-student" ||
      classroomContext.learner?.name === "体验模式" ||
      classroomContext.learnerGoal?.includes("体验模式"))
  );
}

export function resolveTeacherVoice(
  classroomContext?: ClassroomContext | StageClassroomMeta | null,
): { providerId?: TTSProviderId; voiceId?: string; voiceLabel?: string } {
  const digitalHuman = classroomContext?.teacher?.digitalHuman;
  return {
    providerId: digitalHuman?.voiceProviderId,
    voiceId: digitalHuman?.voiceId,
    voiceLabel: digitalHuman?.voiceLabel,
  };
}

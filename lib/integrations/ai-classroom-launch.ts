'use client';

import { SUBJECT_LABELS } from '@/lib/constants';
import { storePdfBlob } from '@/lib/utils/image-storage';
import {
  buildAudienceModeLabel,
  buildLaunchRequirementWithClassroomContext,
  type ClassroomContext,
} from '@/lib/classroom-integration';

const AI_CLASSROOM_LAUNCH_KEY = 'aiClassroomLaunchPayload';

type SupportedLanguage = 'zh-CN' | 'en-US';

export type AiClassroomLaunchPayload = {
  requirement: string;
  language?: SupportedLanguage;
  webSearch?: boolean;
  sourceLabel?: string;
  sourceSummary?: string;
  pdfStorageKey?: string;
  pdfFileName?: string;
  classroomContext?: ClassroomContext;
};

type LibraryLaunchItem = {
  title: string;
  description?: string;
  subject: string;
  grade: string;
  contentType?: 'textbook' | 'courseware' | 'lesson_plan';
  fileName?: string;
  mimeType?: string;
  contentBase64?: string;
  textContent?: string;
  extractedKnowledgePoints?: string[];
};

type TeacherLaunchClass = {
  name: string;
  subject: string;
  grade: string;
};

type TeacherLaunchKnowledgePoint = {
  id: string;
  title: string;
  chapter: string;
};

export type StudentSelfStudyMode =
  | 'preview-preparation'
  | 'subject-reinforcement'
  | 'interest-cultivation'
  | 'classroom-review';

type StudentSelfStudyProfile = {
  id: string;
  name?: string;
  preferredName?: string;
  grade?: string;
  subjects?: string[];
  target?: string;
  strengths?: string;
};

function getSubjectLabel(subject: string) {
  return SUBJECT_LABELS[subject] ?? subject;
}

function trimExcerpt(value: string | undefined, maxLength: number) {
  const normalized = value?.trim();
  if (!normalized) return '';
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized;
}

function isPdfFile(item: Pick<LibraryLaunchItem, 'mimeType' | 'fileName'>) {
  return Boolean(
    item.mimeType?.toLowerCase().includes('pdf') || item.fileName?.toLowerCase().endsWith('.pdf'),
  );
}

function base64ToFile(base64: string, filename: string, mimeType: string) {
  const byteString = atob(base64);
  const arrayBuffer = new ArrayBuffer(byteString.length);
  const uint8Array = new Uint8Array(arrayBuffer);

  for (let index = 0; index < byteString.length; index += 1) {
    uint8Array[index] = byteString.charCodeAt(index);
  }

  return new File([uint8Array], filename, { type: mimeType });
}

export function saveAiClassroomLaunchPayload(payload: AiClassroomLaunchPayload) {
  sessionStorage.setItem(AI_CLASSROOM_LAUNCH_KEY, JSON.stringify(payload));
}

export function consumeAiClassroomLaunchPayload() {
  const raw = sessionStorage.getItem(AI_CLASSROOM_LAUNCH_KEY);
  if (!raw) return null;
  sessionStorage.removeItem(AI_CLASSROOM_LAUNCH_KEY);

  try {
    return JSON.parse(raw) as AiClassroomLaunchPayload;
  } catch {
    return null;
  }
}

export async function buildAiClassroomLaunchPayloadFromLibraryItem(
  item: LibraryLaunchItem,
): Promise<AiClassroomLaunchPayload> {
  const subjectLabel = getSubjectLabel(item.subject);
  const knowledgePoints = Array.from(new Set(item.extractedKnowledgePoints ?? [])).filter(Boolean);
  const excerpt = trimExcerpt(item.textContent, 3200);
  const contentTypeLabel =
    item.contentType === 'courseware'
      ? '课件'
      : item.contentType === 'lesson_plan'
        ? '教案'
        : '教材';

  let pdfStorageKey: string | undefined;
  let pdfFileName: string | undefined;

  if (item.contentBase64 && isPdfFile(item)) {
    const nextFileName = item.fileName || `${item.title}.pdf`;
    const file = base64ToFile(
      item.contentBase64,
      nextFileName,
      item.mimeType || 'application/pdf',
    );
    pdfStorageKey = await storePdfBlob(file);
    pdfFileName = nextFileName;
  }

  const requirementSections = [
    `请基于以下${contentTypeLabel}资料，生成一节适合${item.grade}年级${subjectLabel}教学场景的航科互动课堂。`,
    `资料标题：${item.title}`,
    item.description ? `资料说明：${item.description}` : '',
    knowledgePoints.length ? `重点知识点：${knowledgePoints.join('、')}` : '',
    '课堂要求：包含导入、讲解、互动追问、板书推进、课堂练习与总结，适合多智能体分工协作。',
    excerpt ? `资料正文摘要：\n${excerpt}` : '',
  ].filter(Boolean);

  return {
    requirement: requirementSections.join('\n\n'),
    language: 'zh-CN',
    webSearch: false,
    sourceLabel: `资料已带入：${item.title}`,
    sourceSummary: pdfStorageKey
      ? `已同步 PDF 资料《${item.title}》，并预填课堂生成要求。`
      : `已基于资料《${item.title}》预填课堂生成要求。`,
    pdfStorageKey,
    pdfFileName,
  };
}

export function buildAiClassroomLaunchPayloadFromTeacherOutline(input: {
  classItem: TeacherLaunchClass;
  topic?: string;
  knowledgePoints?: TeacherLaunchKnowledgePoint[];
  classroomContext?: ClassroomContext;
}) {
  const subjectLabel = getSubjectLabel(input.classItem.subject);
  const topic = input.topic?.trim();
  const knowledgePoints = (input.knowledgePoints ?? []).map((item) => item.title).filter(Boolean);

  const baseRequirement = [
    `请为${input.classItem.name}设计一节适合${input.classItem.grade}年级${subjectLabel}的航科互动课堂。`,
    topic ? `课堂主题：${topic}` : '',
    knowledgePoints.length ? `关联知识点：${knowledgePoints.join('、')}` : '',
    '课堂要求：适合教师授课演示，包含角色互动、分步讲解、课堂提问、板书推进和课后延伸。',
  ].filter(Boolean);

  const requirement = buildLaunchRequirementWithClassroomContext({
    baseRequirement: baseRequirement.join('\n\n'),
    classroomContext: input.classroomContext,
  });

  const teacherName =
    input.classroomContext?.teacher?.digitalHuman?.displayName ||
    input.classroomContext?.teacher?.name;
  const studentCount = input.classroomContext?.students?.length ?? 0;

  return {
    requirement,
    language: 'zh-CN' as const,
    webSearch: false,
    sourceLabel: `教师工具已带入：${input.classItem.name}`,
    sourceSummary: topic
      ? `已将“${topic}”及当前班级上下文带入互动课堂，${teacherName ? `由 ${teacherName} 发起，` : ''}${studentCount ? `覆盖 ${studentCount} 名学生，` : ''}默认按${buildAudienceModeLabel(input.classroomContext?.audienceMode)}编排。`
      : `已将当前班级上下文带入互动课堂，默认按${buildAudienceModeLabel(input.classroomContext?.audienceMode)}编排。`,
    classroomContext: input.classroomContext,
  };
}

export function buildAiClassroomLaunchPayloadFromStudentSelfStudy(input: {
  student: StudentSelfStudyProfile;
  mode: StudentSelfStudyMode;
  subject?: string;
  topic?: string;
  learnerGoal?: string;
  focusKnowledgePointTitle?: string;
}) {
  const learnerName =
    input.student.preferredName?.trim() || input.student.name?.trim() || '当前学生';
  const subject = input.subject?.trim() || input.student.subjects?.[0] || '';
  const subjectLabel = subject ? getSubjectLabel(subject) : '综合';
  const topic =
    input.topic?.trim() ||
    input.focusKnowledgePointTitle?.trim() ||
    (input.mode === 'preview-preparation'
      ? `${subjectLabel}新课预习`
      : input.mode === 'subject-reinforcement'
        ? `${subjectLabel}重点巩固`
        : input.mode === 'classroom-review'
          ? `${subjectLabel}课堂重点回看`
          : `${subjectLabel}兴趣探索`);
  const learnerGoal = input.learnerGoal?.trim() || input.student.target?.trim() || '';

  const modeIntro =
    input.mode === 'preview-preparation'
      ? `请为${learnerName}设计一节适合学生自主使用的${subjectLabel}课前预习课堂。`
      : input.mode === 'subject-reinforcement'
        ? `请为${learnerName}设计一节适合学生自主使用的${subjectLabel}巩固课堂。`
        : input.mode === 'classroom-review'
          ? `请为${learnerName}设计一节适合学生自主使用的${subjectLabel}课堂回看课堂。`
          : `请围绕“${topic}”为${learnerName}设计一节适合学生自主使用的兴趣培养课堂。`;
  const modeRequirement =
    input.mode === 'preview-preparation'
      ? '课堂要求：先激活旧知，再建立主线、提出问题、安排 2 到 3 个预习检测点，帮助学生带着问题进入真实课堂。'
      : input.mode === 'subject-reinforcement'
        ? '课堂要求：聚焦薄弱点收口，包含例题拆解、即时练习、错因提醒和最后的迁移检验。'
        : input.mode === 'classroom-review'
          ? '课堂要求：适合课后回看，帮助学生回收课堂主线、复述重点、纠正常见误区，并给出下一轮追练建议。'
          : '课堂要求：适合单人观看与跟练，包含导入、启发式讲解、互动追问、即时练习、总结，并支持课后回看与导出。';

  const baseRequirement = [
    modeIntro,
    `学习主题：${topic}`,
    input.focusKnowledgePointTitle
      ? input.mode === 'classroom-review'
        ? `优先回看知识点：${input.focusKnowledgePointTitle}`
        : `优先巩固知识点：${input.focusKnowledgePointTitle}`
      : '',
    learnerGoal ? `当前学习目标：${learnerGoal}` : '',
    input.student.strengths?.trim() ? `可结合学生优势：${input.student.strengths.trim()}` : '',
    modeRequirement,
  ].filter(Boolean);

  const classroomContext: ClassroomContext = {
    source: 'student-self-study',
    className: `${learnerName}的自学课堂`,
    subject: subject || undefined,
    grade: input.student.grade?.trim() || undefined,
    learningMode: input.mode,
    teacher: null,
    learner: {
      id: input.student.id,
      name: learnerName,
      grade: input.student.grade?.trim() || undefined,
    },
    students: [],
    audienceMode: 'teacher-private',
    exportFormats: ['pptx', 'resource-pack'],
    learnerGoal: learnerGoal || undefined,
    focusKnowledgePointTitle:
      input.mode === 'subject-reinforcement' || input.mode === 'classroom-review'
        ? input.focusKnowledgePointTitle?.trim() || undefined
        : undefined,
    interestTopic: input.mode === 'interest-cultivation' ? topic : undefined,
  };

  const sourceLabel =
    input.mode === 'preview-preparation'
      ? `课前预习已准备：${learnerName}`
      : input.mode === 'subject-reinforcement'
        ? `学习巩固已准备：${learnerName}`
        : input.mode === 'classroom-review'
          ? `课堂回看已准备：${learnerName}`
          : `兴趣培养已准备：${learnerName}`;
  const sourceSummary =
    input.mode === 'preview-preparation'
      ? `已按课前预习模式为 ${learnerName} 预填课堂，主题聚焦“${topic}”，会优先帮助学生建立主线和问题清单。`
      : input.mode === 'subject-reinforcement'
        ? `已按学科巩固模式为 ${learnerName} 预填课堂，${input.focusKnowledgePointTitle ? `优先围绕“${input.focusKnowledgePointTitle}”展开。` : '可继续围绕当前学科做针对性巩固。'}`
        : input.mode === 'classroom-review'
          ? `已按课堂回看模式为 ${learnerName} 预填课堂，主题聚焦“${topic}”，会优先帮助学生复述重点并完成课后收口。`
          : `已按兴趣培养模式为 ${learnerName} 预填课堂，主题聚焦“${topic}”。`;

  return {
    requirement: buildLaunchRequirementWithClassroomContext({
      baseRequirement: baseRequirement.join('\n\n'),
      classroomContext,
    }),
    language: 'zh-CN' as const,
    webSearch: false,
    sourceLabel,
    sourceSummary,
    classroomContext,
  };
}

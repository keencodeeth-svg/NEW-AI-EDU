import type { StageClassroomMeta } from '@/lib/classroom-integration';
import type { StudentSelfStudyMode } from '@/lib/integrations/ai-classroom-launch';
import {
  buildStudentSelfStudyHref,
  resolveStudentSelfStudyFollowUpMode,
} from '@/lib/student-self-study-recent';

const STUDENT_SELF_STUDY_ARTIFACTS_STORAGE_KEY = 'studentSelfStudyArtifacts';

export const STUDENT_SELF_STUDY_ARTIFACTS_UPDATED_EVENT =
  'student-self-study-artifacts-updated';

export type StudentSelfStudyArtifactSaveTarget = 'growth' | 'favorites';

export type StudentSelfStudyArtifact = {
  stageId: string;
  stageName: string;
  stageHref: string;
  studentLaunchHref: string;
  learningMode: StudentSelfStudyMode;
  followUpMode?: StudentSelfStudyMode;
  followUpHref?: string;
  subject?: string;
  grade?: string;
  learnerName?: string;
  learnerGoal?: string;
  topic?: string;
  sceneCount: number;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string;
  savedToGrowthAt?: string;
  savedToFavoritesAt?: string;
};

type StudentSelfStudyArtifactInput = {
  stageId: string;
  stageName?: string | null;
  sceneCount?: number;
  classroomMeta?: StageClassroomMeta | null;
  stageHref?: string | null;
};

function normalizeText(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function isStudentSelfStudyMode(value?: string | null): value is StudentSelfStudyMode {
  return (
    value === 'preview-preparation' ||
    value === 'subject-reinforcement' ||
    value === 'interest-cultivation' ||
    value === 'classroom-review'
  );
}

function sortArtifacts(items: StudentSelfStudyArtifact[]) {
  return [...items].sort((left, right) => {
    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
  });
}

function readArtifacts() {
  if (typeof window === 'undefined') {
    return [] as StudentSelfStudyArtifact[];
  }

  try {
    const raw = window.localStorage.getItem(STUDENT_SELF_STUDY_ARTIFACTS_STORAGE_KEY);
    if (!raw) {
      return [] as StudentSelfStudyArtifact[];
    }

    const parsed = JSON.parse(raw) as Partial<StudentSelfStudyArtifact>[] | null;
    if (!Array.isArray(parsed)) {
      return [] as StudentSelfStudyArtifact[];
    }

    return sortArtifacts(
      parsed.flatMap((item) => {
        const stageId = normalizeText(item?.stageId);
        if (!item || !stageId || !isStudentSelfStudyMode(item.learningMode)) {
          return [];
        }

        const safeStageId = stageId as string;
        const stageHref = normalizeText(item.stageHref) || `/classroom/${safeStageId}`;
        const stageName = normalizeText(item.stageName) || '未命名互动课堂';

        return [
          {
            stageId: safeStageId,
            stageName,
            stageHref,
            studentLaunchHref:
              normalizeText(item.studentLaunchHref) ||
              buildStudentSelfStudyHref({
                mode: item.learningMode,
                subject: item.subject,
                topic: item.topic,
                goal: item.learnerGoal,
              }),
            learningMode: item.learningMode,
            followUpMode: isStudentSelfStudyMode(item.followUpMode)
              ? item.followUpMode
              : undefined,
            followUpHref: normalizeText(item.followUpHref),
            subject: normalizeText(item.subject),
            grade: normalizeText(item.grade),
            learnerName: normalizeText(item.learnerName),
            learnerGoal: normalizeText(item.learnerGoal),
            topic: normalizeText(item.topic),
            sceneCount: typeof item.sceneCount === 'number' ? Math.max(0, item.sceneCount) : 0,
            createdAt: normalizeText(item.createdAt) || new Date(0).toISOString(),
            updatedAt: normalizeText(item.updatedAt) || new Date(0).toISOString(),
            lastOpenedAt:
              normalizeText(item.lastOpenedAt) ||
              normalizeText(item.updatedAt) ||
              new Date(0).toISOString(),
            savedToGrowthAt: normalizeText(item.savedToGrowthAt),
            savedToFavoritesAt: normalizeText(item.savedToFavoritesAt),
          } satisfies StudentSelfStudyArtifact,
        ];
      }),
    );
  } catch {
    return [] as StudentSelfStudyArtifact[];
  }
}

function writeArtifacts(items: StudentSelfStudyArtifact[]) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(
      STUDENT_SELF_STUDY_ARTIFACTS_STORAGE_KEY,
      JSON.stringify(sortArtifacts(items)),
    );
    window.dispatchEvent(new CustomEvent(STUDENT_SELF_STUDY_ARTIFACTS_UPDATED_EVENT));
  } catch {
    /* localStorage unavailable */
  }
}

export function listStudentSelfStudyArtifacts() {
  return readArtifacts();
}

export function getStudentSelfStudyArtifact(stageId: string) {
  return readArtifacts().find((item) => item.stageId === stageId) ?? null;
}

export function upsertStudentSelfStudyArtifact(input: StudentSelfStudyArtifactInput) {
  if (!input.classroomMeta || input.classroomMeta.source !== 'student-self-study') {
    return null;
  }

  if (!isStudentSelfStudyMode(input.classroomMeta.learningMode)) {
    return null;
  }

  const now = new Date().toISOString();
  const stageId = normalizeText(input.stageId);
  if (!stageId) {
    return null;
  }

  const topic =
    normalizeText(input.classroomMeta.focusKnowledgePointTitle) ||
    normalizeText(input.classroomMeta.interestTopic) ||
    normalizeText(input.stageName);
  const learnerGoal = normalizeText(input.classroomMeta.learnerGoal);
  const followUpMode = resolveStudentSelfStudyFollowUpMode(input.classroomMeta.learningMode);
  const stageHref = normalizeText(input.stageHref) || `/classroom/${stageId}`;

  const nextArtifactBase: StudentSelfStudyArtifact = {
    stageId,
    stageName: normalizeText(input.stageName) || topic || '未命名互动课堂',
    stageHref,
    studentLaunchHref: buildStudentSelfStudyHref({
      mode: input.classroomMeta.learningMode,
      subject: input.classroomMeta.subject,
      topic,
      goal: learnerGoal,
    }),
    learningMode: input.classroomMeta.learningMode,
    followUpMode,
    followUpHref: buildStudentSelfStudyHref({
      mode: followUpMode,
      subject: input.classroomMeta.subject,
      topic,
      goal: learnerGoal,
    }),
    subject: normalizeText(input.classroomMeta.subject),
    grade: normalizeText(input.classroomMeta.grade),
    learnerName: normalizeText(input.classroomMeta.learner?.name),
    learnerGoal,
    topic,
    sceneCount: typeof input.sceneCount === 'number' ? Math.max(0, input.sceneCount) : 0,
    createdAt: now,
    updatedAt: now,
    lastOpenedAt: now,
  };

  const currentArtifacts = readArtifacts();
  const existingArtifact =
    currentArtifacts.find((artifact) => artifact.stageId === nextArtifactBase.stageId) ?? null;

  const nextArtifact: StudentSelfStudyArtifact = existingArtifact
    ? {
        ...existingArtifact,
        ...nextArtifactBase,
        createdAt: existingArtifact.createdAt || nextArtifactBase.createdAt,
        savedToGrowthAt: existingArtifact.savedToGrowthAt,
        savedToFavoritesAt: existingArtifact.savedToFavoritesAt,
      }
    : nextArtifactBase;

  writeArtifacts(
    sortArtifacts([
      nextArtifact,
      ...currentArtifacts.filter((artifact) => artifact.stageId !== nextArtifact.stageId),
    ]),
  );

  return nextArtifact;
}

export function markStudentSelfStudyArtifactSaved(
  stageId: string,
  target: StudentSelfStudyArtifactSaveTarget,
) {
  const normalizedStageId = normalizeText(stageId);
  if (!normalizedStageId) {
    return null;
  }

  const now = new Date().toISOString();
  const currentArtifacts = readArtifacts();
  const nextArtifacts = currentArtifacts.map((artifact) => {
    if (artifact.stageId !== normalizedStageId) {
      return artifact;
    }

    return {
      ...artifact,
      updatedAt: now,
      savedToGrowthAt:
        target === 'growth' ? artifact.savedToGrowthAt || now : artifact.savedToGrowthAt,
      savedToFavoritesAt:
        target === 'favorites'
          ? artifact.savedToFavoritesAt || now
          : artifact.savedToFavoritesAt,
    } satisfies StudentSelfStudyArtifact;
  });

  writeArtifacts(nextArtifacts);
  return nextArtifacts.find((artifact) => artifact.stageId === normalizedStageId) ?? null;
}

export function buildStudentSelfStudyArtifactDetail(artifact: StudentSelfStudyArtifact) {
  if (artifact.topic && artifact.learnerGoal) {
    return `主题：${artifact.topic} · 目标：${artifact.learnerGoal}`;
  }
  if (artifact.topic) {
    return `主题：${artifact.topic}`;
  }
  if (artifact.learnerGoal) {
    return `目标：${artifact.learnerGoal}`;
  }
  return '围绕当前主题继续推进这节互动课堂即可。';
}

export function formatStudentSelfStudyArtifactTime(value?: string | null) {
  if (!value) {
    return '刚刚更新';
  }

  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    return '刚刚更新';
  }

  return timestamp.toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

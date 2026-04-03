import { buildLearningModeLabel } from '@/lib/classroom-integration';
import { SUBJECT_LABELS } from '@/lib/constants';
import type { StudentSelfStudyMode } from '@/lib/integrations/ai-classroom-launch';

const STUDENT_SELF_STUDY_RECENT_STORAGE_KEY = 'studentRecentInteractiveClassroom';

export type RecentStudentSelfStudySession = {
  mode: StudentSelfStudyMode;
  subject?: string;
  topic?: string;
  learnerGoal?: string;
  updatedAt: string;
};

function normalizeText(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : '';
}

function isStudentSelfStudyMode(value?: string | null): value is StudentSelfStudyMode {
  return (
    value === 'preview-preparation' ||
    value === 'subject-reinforcement' ||
    value === 'interest-cultivation' ||
    value === 'classroom-review'
  );
}

export function buildStudentSelfStudyHref(input: {
  mode: StudentSelfStudyMode;
  subject?: string | null;
  topic?: string | null;
  goal?: string | null;
}) {
  const searchParams = new URLSearchParams({
    mode: input.mode,
  });

  const subject = normalizeText(input.subject);
  const topic = normalizeText(input.topic);
  const goal = normalizeText(input.goal);

  if (subject) {
    searchParams.set('subject', subject);
  }
  if (topic) {
    searchParams.set('topic', topic);
  }
  if (goal) {
    searchParams.set('goal', goal);
  }

  return `/student/interactive-classroom?${searchParams.toString()}`;
}

export function saveRecentStudentSelfStudySession(
  session: Omit<RecentStudentSelfStudySession, 'updatedAt'> & { updatedAt?: string },
) {
  const payload: RecentStudentSelfStudySession = {
    mode: session.mode,
    subject: normalizeText(session.subject) || undefined,
    topic: normalizeText(session.topic) || undefined,
    learnerGoal: normalizeText(session.learnerGoal) || undefined,
    updatedAt: session.updatedAt ?? new Date().toISOString(),
  };

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(
        STUDENT_SELF_STUDY_RECENT_STORAGE_KEY,
        JSON.stringify(payload),
      );
    } catch {
      /* localStorage unavailable */
    }
  }

  return payload;
}

export function loadRecentStudentSelfStudySession() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(STUDENT_SELF_STUDY_RECENT_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<RecentStudentSelfStudySession> | null;
    if (!parsed || !isStudentSelfStudyMode(parsed.mode)) {
      return null;
    }

    return {
      mode: parsed.mode,
      subject: normalizeText(parsed.subject) || undefined,
      topic: normalizeText(parsed.topic) || undefined,
      learnerGoal: normalizeText(parsed.learnerGoal) || undefined,
      updatedAt: normalizeText(parsed.updatedAt) || new Date(0).toISOString(),
    } satisfies RecentStudentSelfStudySession;
  } catch {
    return null;
  }
}

export function buildRecentStudentSelfStudySummary(session: RecentStudentSelfStudySession) {
  const subjectLabel = session.subject
    ? (SUBJECT_LABELS[session.subject] ?? session.subject)
    : '综合';
  return `${buildLearningModeLabel(session.mode)} · ${subjectLabel}`;
}

export function buildRecentStudentSelfStudyDetail(session: RecentStudentSelfStudySession) {
  if (session.topic && session.learnerGoal) {
    return `主题：${session.topic} · 目标：${session.learnerGoal}`;
  }
  if (session.topic) {
    return `主题：${session.topic}`;
  }
  if (session.learnerGoal) {
    return `目标：${session.learnerGoal}`;
  }
  return '保留上次学习主线，继续推进即可。';
}

export function formatRecentStudentSelfStudyTime(value?: string | null) {
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

export function resolveStudentSelfStudyFollowUpMode(
  mode: StudentSelfStudyMode,
): StudentSelfStudyMode {
  if (mode === 'preview-preparation') {
    return 'classroom-review';
  }
  if (mode === 'subject-reinforcement') {
    return 'classroom-review';
  }
  if (mode === 'classroom-review') {
    return 'subject-reinforcement';
  }
  return 'preview-preparation';
}

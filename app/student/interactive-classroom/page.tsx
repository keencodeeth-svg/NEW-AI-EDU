'use client';

import type { ComponentProps } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import WorkspacePage, {
  WorkspaceErrorState,
  WorkspaceLoadingState,
} from '@/components/WorkspacePage';
import StatePanel from '@/components/StatePanel';
import EduIcon from '@/components/EduIcon';
import {
  getRequestErrorMessage,
  getRequestStatus,
  isAuthError,
  requestJson,
} from '@/lib/client-request';
import type { ScheduleResponse } from '@/lib/class-schedules';
import { SUBJECT_LABELS, SUBJECT_OPTIONS, getGradeLabel } from '@/lib/constants';
import { buildLearningModeLabel } from '@/lib/classroom-integration';
import {
  buildAiClassroomLaunchPayloadFromStudentSelfStudy,
  saveAiClassroomLaunchPayload,
  type StudentSelfStudyMode,
} from '@/lib/integrations/ai-classroom-launch';
import {
  buildRecentStudentSelfStudyDetail,
  buildRecentStudentSelfStudySummary,
  buildStudentSelfStudyHref,
  formatRecentStudentSelfStudyTime,
  loadRecentStudentSelfStudySession,
  resolveStudentSelfStudyFollowUpMode,
  saveRecentStudentSelfStudySession,
  type RecentStudentSelfStudySession,
} from '@/lib/student-self-study-recent';
import { studentProfileInputStyle, studentProfileTextareaStyle } from '../profile/utils';
import type { ProfileResponse, StudentProfilePayload } from '../profile/types';
import type { RadarResponse, WeakKnowledgePoint } from '../portrait/types';
import type { TodayTaskPayload } from '../types';
import type { StudentAssignmentItem } from '../assignments/types';
import type { StudentClassModules, StudentModule, StudentModulesResponse } from '../modules/types';

type LearningMode = StudentSelfStudyMode;
type LearningModeConfig = {
  icon: ComponentProps<typeof EduIcon>['name'];
  sectionTag: string;
  summary: string;
  helper: string;
  topicLabel: string;
  topicPlaceholder: string;
  gradient: string;
  accent: string;
  quickPills: string[];
  deliverables: string[];
  learningSteps: string[];
};

type TopicDrafts = Record<LearningMode, string>;

type AuthMeResponse = {
  user?: {
    id: string;
    name?: string;
    email?: string;
  };
};

type ScheduleData = NonNullable<ScheduleResponse['data']>;

const GUEST_STUDENT_USER: NonNullable<AuthMeResponse['user']> = {
  id: 'guest-student',
  name: '访客同学',
};

const GUEST_STUDENT_PROFILE: StudentProfilePayload = {
  grade: '7',
  subjects: ['math', 'english'],
  preferredName: '访客同学',
  target: '先把这一节的主线听懂，再做一轮互动练习把理解做稳。',
  strengths: '喜欢先看主线，再跟着例题一步步理解概念。',
};

type TodayTasksResponse = {
  data?: TodayTaskPayload | null;
};

type StudentAssignmentsResponse = {
  data?: StudentAssignmentItem[];
  error?: string;
};

type ModeAssetCard = {
  id: string;
  title: string;
  badge: string;
  description: string;
  href: string;
  cta: string;
  secondaryHref?: string;
  secondaryLabel?: string;
};

type StudentSelfStudyPanel = 'flow' | 'context';

type ModuleMatch = {
  classId: string;
  className: string;
  subject: string;
  grade: string;
  module: StudentModule;
  progress: number;
};

const MODE_ORDER: LearningMode[] = [
  'preview-preparation',
  'subject-reinforcement',
  'interest-cultivation',
  'classroom-review',
];
const APP_TIME_ZONE = 'Asia/Shanghai';

const MODE_CONFIG: Record<LearningMode, LearningModeConfig> = {
  'preview-preparation': {
    icon: 'book',
    sectionTag: '课前预习',
    summary: '先帮你搭好主线和问题清单，再带着问题进入老师的真实课堂。',
    helper: '适合新课前 10 到 15 分钟使用，重点不是学完，而是带着框架和问题去上课。',
    topicLabel: '准备预习的主题、课文或章节',
    topicPlaceholder: '例如：圆柱的表面积、阿房宫赋、光合作用',
    gradient: 'linear-gradient(135deg, rgba(14, 116, 144, 0.16), rgba(236, 253, 245, 0.92))',
    accent: 'rgba(14, 116, 144, 0.35)',
    quickPills: ['旧知激活', '主线预热', '问题清单', '预习检测'],
    deliverables: ['预习导读', '关键概念地图', '提问清单', '预习自测'],
    learningSteps: ['先回忆旧知', '搭出新课主线', '生成预习问题', '做一轮小检测'],
  },
  'subject-reinforcement': {
    icon: 'brain',
    sectionTag: '学科巩固',
    summary: '围绕一个薄弱点集中收口，讲完就练，练完就纠偏。',
    helper: '最适合错题后、作业后、考前专题补弱时使用，目标是把“会一点”变成“做得稳”。',
    topicLabel: '优先巩固的知识点或题型',
    topicPlaceholder: '例如：分数加减法、病句修改、过去进行时',
    gradient: 'linear-gradient(135deg, rgba(12, 74, 110, 0.18), rgba(239, 246, 255, 0.94))',
    accent: 'rgba(37, 99, 235, 0.35)',
    quickPills: ['弱项收口', '分步讲解', '即时练习', '错因提醒'],
    deliverables: ['定向讲解', '例题拆解', '跟练题', '错因总结卡'],
    learningSteps: ['先定位弱项', '拆开关键步骤', '马上插题检验', '最后做迁移收口'],
  },
  'interest-cultivation': {
    icon: 'rocket',
    sectionTag: '兴趣探索',
    summary: '把好奇心变成一节有故事线、有互动、有启发的探索课堂。',
    helper: '适合课后拓展、项目式学习和跨学科探索，目标是让你愿意继续追问和延展。',
    topicLabel: '想探索的兴趣主题',
    topicPlaceholder: '例如：火箭为什么能升空、古诗里的季节、概率小游戏',
    gradient: 'linear-gradient(135deg, rgba(249, 115, 22, 0.16), rgba(255, 247, 237, 0.94))',
    accent: 'rgba(249, 115, 22, 0.35)',
    quickPills: ['情境导入', '故事推进', '互动追问', '拓展任务'],
    deliverables: ['主题故事线', '启发式追问', '小项目任务', '兴趣探索卡'],
    learningSteps: ['先勾起好奇心', '用故事把主题讲活', '在追问里深入', '留下一步探索任务'],
  },
  'classroom-review': {
    icon: 'chart',
    sectionTag: '课堂回看',
    summary: '把上过的内容重新压缩成你能复述、能迁移、能追练的一节回看课堂。',
    helper: '适合课后复盘和考前回收主线，重点是把“听过”变成“说得出、做得对”。',
    topicLabel: '想回看的课堂重点、题型或单元',
    topicPlaceholder: '例如：今天课堂重点、一次函数图像、文言文翻译套路',
    gradient: 'linear-gradient(135deg, rgba(180, 83, 9, 0.14), rgba(254, 249, 195, 0.92))',
    accent: 'rgba(180, 83, 9, 0.32)',
    quickPills: ['重点回收', '复述训练', '易错纠偏', '追练建议'],
    deliverables: ['回看主线', '重点复述卡', '易错提醒', '课后追练入口'],
    learningSteps: ['先捞回课堂主线', '再压缩核心概念', '用复述检验理解', '最后布置一轮追练'],
  },
};

function normalizeText(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : '';
}

function shouldUseGuestExperience(error: unknown) {
  const status = getRequestStatus(error);
  const message = getRequestErrorMessage(error, '').toLowerCase();
  return (
    status === 500 ||
    status === 503 ||
    status === 504 ||
    message.includes('service temporarily unavailable') ||
    message.includes('runtime-guardrails') ||
    message.includes('database_url') ||
    message.includes('object_storage_root')
  );
}

function buildInterestTopicSuggestion(profile: StudentProfilePayload | null, subject: string) {
  const subjectLabel = SUBJECT_LABELS[subject] ?? subject;
  const target = normalizeText(profile?.target);
  if (target) {
    return target;
  }

  const strengths = normalizeText(profile?.strengths);
  if (strengths) {
    return subjectLabel ? `${subjectLabel}兴趣拓展：${strengths}` : strengths;
  }

  return subjectLabel ? `${subjectLabel}趣味探索` : '我的兴趣主题';
}

function buildPreviewTopicSuggestion(profile: StudentProfilePayload | null, subject: string) {
  const subjectLabel = SUBJECT_LABELS[subject] ?? subject;
  const target = normalizeText(profile?.target);
  if (target) {
    return `${target}预习`;
  }
  return subjectLabel ? `${subjectLabel}新课预习` : '本周新课预习';
}

function buildReviewTopicSuggestion(
  weakKnowledgePoint: WeakKnowledgePoint | null,
  subject: string,
) {
  if (weakKnowledgePoint?.title) {
    return `${weakKnowledgePoint.title}课堂回看`;
  }
  const subjectLabel = SUBJECT_LABELS[subject] ?? subject;
  return subjectLabel ? `${subjectLabel}课堂重点回看` : '课堂重点回看';
}

function buildPrimaryGoalTemplate(mode: LearningMode, subjectLabel: string) {
  if (mode === 'preview-preparation') {
    return `先建立${subjectLabel}这节内容的主线，再带着 2 到 3 个问题进入课堂。`;
  }
  if (mode === 'subject-reinforcement') {
    return `把这轮${subjectLabel}薄弱点真正做稳，讲完后马上能自己完成一轮跟练。`;
  }
  if (mode === 'classroom-review') {
    return `把今天${subjectLabel}课堂重点重新吃透，最后能自己复述主线并完成一轮追练。`;
  }
  return `先听懂这次主题，再完成一轮互动练习，最后留下还想继续探索的问题。`;
}

function buildSecondaryGoalTemplate(mode: LearningMode, subjectLabel: string) {
  if (mode === 'preview-preparation') {
    return `先不追求学完，重点是知道${subjectLabel}这一讲在讲什么、哪里容易卡住。`;
  }
  if (mode === 'subject-reinforcement') {
    return `先听懂，再做对，再能自己讲出为什么这样做。`;
  }
  if (mode === 'classroom-review') {
    return `把课堂里“听懂但还不会做”的地方重新讲顺，再做一题确认收口。`;
  }
  return `先把兴趣主题讲透，再留下 1 个我想继续查下去的延伸方向。`;
}

function formatDateTimeLabel(value?: string | null) {
  if (!value) {
    return '时间待老师安排';
  }

  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    return '时间待老师安排';
  }

  return timestamp.toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: APP_TIME_ZONE,
  });
}

function formatTimeRangeLabel(startAt?: string | null, endAt?: string | null) {
  if (!startAt || !endAt) {
    return '查看课程安排';
  }

  const start = new Date(startAt);
  const end = new Date(endAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return '查看课程安排';
  }

  const startLabel = start.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: APP_TIME_ZONE,
  });
  const endLabel = end.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: APP_TIME_ZONE,
  });

  return `${startLabel}-${endLabel}`;
}

function isPendingAssignment(item: StudentAssignmentItem) {
  return item.status !== 'completed';
}

function isOverdueAssignment(item: StudentAssignmentItem, nowTs = Date.now()) {
  return isPendingAssignment(item) && new Date(item.dueDate).getTime() < nowTs;
}

function formatAssignmentDueLabel(item: StudentAssignmentItem) {
  if (isOverdueAssignment(item)) {
    return '已逾期';
  }
  return formatDateTimeLabel(item.dueDate);
}

function buildPracticeHref(mode: LearningMode) {
  if (mode === 'subject-reinforcement' || mode === 'classroom-review') {
    return '/practice?mode=review';
  }
  return '/practice';
}

function flattenModules(data: StudentClassModules[]): ModuleMatch[] {
  return data.flatMap((klass) =>
    klass.modules.map((module) => ({
      classId: klass.classId,
      className: klass.className,
      subject: klass.subject,
      grade: klass.grade,
      module,
      progress: module.assignmentCount
        ? Math.round((module.completedCount / module.assignmentCount) * 100)
        : 0,
    })),
  );
}

export default function StudentInteractiveClassroomPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const lastAppliedDeepLinkRef = useRef<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [bootstrapNotice, setBootstrapNotice] = useState<string | null>(null);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);
  const [authUser, setAuthUser] = useState<AuthMeResponse['user'] | null>(null);
  const [profile, setProfile] = useState<StudentProfilePayload | null>(null);
  const [weakKnowledgePoint, setWeakKnowledgePoint] = useState<WeakKnowledgePoint | null>(null);
  const [todayTasks, setTodayTasks] = useState<TodayTaskPayload | null>(null);
  const [schedule, setSchedule] = useState<ScheduleData | null>(null);
  const [modules, setModules] = useState<StudentClassModules[]>([]);
  const [assignments, setAssignments] = useState<StudentAssignmentItem[]>([]);
  const [mode, setMode] = useState<LearningMode>('subject-reinforcement');
  const [subject, setSubject] = useState('');
  const [topicDrafts, setTopicDrafts] = useState<TopicDrafts>({
    'preview-preparation': '',
    'subject-reinforcement': '',
    'interest-cultivation': '',
    'classroom-review': '',
  });
  const [learnerGoal, setLearnerGoal] = useState('');
  const [initialized, setInitialized] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [recentSession, setRecentSession] = useState<RecentStudentSelfStudySession | null>(null);
  const [editorPanel, setEditorPanel] = useState<StudentSelfStudyPanel>('flow');
  const [guestExperienceMode, setGuestExperienceMode] = useState(false);

  const loadPage = useCallback(async (nextMode: 'initial' | 'refresh' = 'initial') => {
    const isRefresh = nextMode === 'refresh';
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setPageError(null);
    setBootstrapNotice(null);

    try {
      let authMePayload: AuthMeResponse;
      try {
        authMePayload = await requestJson<AuthMeResponse>('/api/auth/me');
      } catch (error) {
        if (isAuthError(error)) {
          setAuthRequired(true);
          return;
        }
        if (shouldUseGuestExperience(error)) {
          setAuthRequired(false);
          setGuestExperienceMode(true);
          setAuthUser(GUEST_STUDENT_USER);
          setProfile(GUEST_STUDENT_PROFILE);
          setWeakKnowledgePoint(null);
          setTodayTasks(null);
          setSchedule(null);
          setModules([]);
          setAssignments([]);
          setBootstrapNotice(
            '当前已切换为访客体验模式。教务、画像和个人进度暂未接入，系统已带入一套可直接开课的默认学习档案。',
          );
          setLastLoadedAt(new Date().toISOString());
          return;
        }
        throw error;
      }

      const nextAuthUser = authMePayload.user ?? null;
      if (!nextAuthUser) {
        setAuthRequired(true);
        return;
      }
      setGuestExperienceMode(false);

      const [
        profileResult,
        radarResult,
        todayTasksResult,
        scheduleResult,
        modulesResult,
        assignmentsResult,
      ] = await Promise.allSettled([
        requestJson<ProfileResponse>('/api/student/profile'),
        requestJson<RadarResponse>('/api/student/radar'),
        requestJson<TodayTasksResponse>('/api/student/today-tasks'),
        requestJson<ScheduleResponse>('/api/schedule'),
        requestJson<StudentModulesResponse>('/api/student/modules'),
        requestJson<StudentAssignmentsResponse>('/api/student/assignments'),
      ]);

      const settledResults = [
        profileResult,
        radarResult,
        todayTasksResult,
        scheduleResult,
        modulesResult,
        assignmentsResult,
      ];
      const hasAuthError = settledResults.some(
        (result) => result.status === 'rejected' && isAuthError(result.reason),
      );

      if (hasAuthError) {
        setAuthRequired(true);
        return;
      }

      const nextProfile =
        profileResult.status === 'fulfilled' ? (profileResult.value.data ?? null) : null;
      const nextWeakKnowledgePoint =
        radarResult.status === 'fulfilled'
          ? (radarResult.value.data?.mastery?.weakKnowledgePoints?.[0] ?? null)
          : null;
      const nextTodayTasks =
        todayTasksResult.status === 'fulfilled' ? (todayTasksResult.value.data ?? null) : null;
      const nextSchedule =
        scheduleResult.status === 'fulfilled' ? (scheduleResult.value.data ?? null) : null;
      const nextModules =
        modulesResult.status === 'fulfilled' ? (modulesResult.value.data ?? []) : [];
      const nextAssignments =
        assignmentsResult.status === 'fulfilled' ? (assignmentsResult.value.data ?? []) : [];

      if (!nextProfile && !nextWeakKnowledgePoint && !nextAuthUser) {
        setPageError('学生互动课堂初始化失败，请稍后重试。');
        return;
      }

      const notices: string[] = [];
      if (profileResult.status === 'rejected') {
        notices.push(getRequestErrorMessage(profileResult.reason, '学生资料加载失败'));
      }
      if (radarResult.status === 'rejected') {
        notices.push(getRequestErrorMessage(radarResult.reason, '学习画像加载失败'));
      }
      if (todayTasksResult.status === 'rejected') {
        notices.push(getRequestErrorMessage(todayTasksResult.reason, '今日任务加载失败'));
      }
      if (scheduleResult.status === 'rejected') {
        notices.push(getRequestErrorMessage(scheduleResult.reason, '课程表加载失败'));
      }
      if (modulesResult.status === 'rejected') {
        notices.push(getRequestErrorMessage(modulesResult.reason, '课程模块加载失败'));
      }
      if (assignmentsResult.status === 'rejected') {
        notices.push(getRequestErrorMessage(assignmentsResult.reason, '作业数据加载失败'));
      }

      setAuthRequired(false);
      setAuthUser(nextAuthUser);
      setProfile(nextProfile);
      setWeakKnowledgePoint(nextWeakKnowledgePoint);
      setTodayTasks(nextTodayTasks);
      setSchedule(nextSchedule);
      setModules(nextModules);
      setAssignments(nextAssignments);
      setBootstrapNotice(notices.length ? notices.join('；') : null);
      setLastLoadedAt(new Date().toISOString());
    } catch (error) {
      if (isAuthError(error)) {
        setAuthRequired(true);
      } else {
        setPageError(getRequestErrorMessage(error, '学生互动课堂初始化失败，请稍后重试。'));
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadPage('initial');
  }, [loadPage]);

  useEffect(() => {
    setRecentSession(loadRecentStudentSelfStudySession());
  }, []);

  useEffect(() => {
    if (initialized) {
      return;
    }
    if (!profile && !weakKnowledgePoint && !authUser) {
      return;
    }

    const defaultMode: LearningMode = weakKnowledgePoint
      ? 'subject-reinforcement'
      : profile?.subjects?.length
        ? 'preview-preparation'
        : 'interest-cultivation';
    const defaultSubject = weakKnowledgePoint?.subject ?? profile?.subjects?.[0] ?? '';
    const defaultSubjectLabel = defaultSubject
      ? (SUBJECT_LABELS[defaultSubject] ?? defaultSubject)
      : '综合';

    setMode(defaultMode);
    setSubject(defaultSubject);
    setTopicDrafts({
      'preview-preparation': buildPreviewTopicSuggestion(profile, defaultSubject),
      'subject-reinforcement':
        weakKnowledgePoint?.title ??
        (defaultSubject
          ? `${SUBJECT_LABELS[defaultSubject] ?? defaultSubject}重点巩固`
          : '当前重点巩固'),
      'interest-cultivation': buildInterestTopicSuggestion(profile, defaultSubject),
      'classroom-review': buildReviewTopicSuggestion(weakKnowledgePoint, defaultSubject),
    });
    setLearnerGoal(
      normalizeText(profile?.target) || buildPrimaryGoalTemplate(defaultMode, defaultSubjectLabel),
    );
    setInitialized(true);
  }, [authUser, initialized, profile, weakKnowledgePoint]);

  const learnerName = useMemo(() => {
    const preferredName = normalizeText(profile?.preferredName);
    const authName = normalizeText(authUser?.name);
    return preferredName || authName || '当前学生';
  }, [authUser?.name, profile?.preferredName]);

  const subjectOptions = useMemo(() => {
    const values = new Set(profile?.subjects?.filter(Boolean) ?? []);
    if (weakKnowledgePoint?.subject) {
      values.add(weakKnowledgePoint.subject);
    }
    const candidateValues = values.size
      ? Array.from(values)
      : SUBJECT_OPTIONS.map((item) => item.value);

    return candidateValues.map((value) => ({
      value,
      label: SUBJECT_LABELS[value] ?? value,
    }));
  }, [profile?.subjects, weakKnowledgePoint?.subject]);

  const selectedSubjectLabel = subject ? (SUBJECT_LABELS[subject] ?? subject) : '综合';
  const stageLabel = getGradeLabel(profile?.grade);
  const activeTopic = normalizeText(topicDrafts[mode]);
  const activeConfig = MODE_CONFIG[mode];
  const deepLinkedMode = useMemo<LearningMode | null>(() => {
    const value = searchParams.get('mode');
    if (
      value === 'preview-preparation' ||
      value === 'subject-reinforcement' ||
      value === 'interest-cultivation' ||
      value === 'classroom-review'
    ) {
      return value;
    }
    return null;
  }, [searchParams]);
  const deepLinkedSubject = useMemo(
    () => normalizeText(searchParams.get('subject')),
    [searchParams],
  );
  const deepLinkedTopic = useMemo(() => normalizeText(searchParams.get('topic')), [searchParams]);
  const deepLinkedGoal = useMemo(() => normalizeText(searchParams.get('goal')), [searchParams]);
  const deepLinkKey = useMemo(
    () =>
      [deepLinkedMode ?? '', deepLinkedSubject, deepLinkedTopic, deepLinkedGoal]
        .filter(Boolean)
        .join('|'),
    [deepLinkedGoal, deepLinkedMode, deepLinkedSubject, deepLinkedTopic],
  );

  const recommendedTopics = useMemo<TopicDrafts>(
    () => ({
      'preview-preparation': buildPreviewTopicSuggestion(profile, subject),
      'subject-reinforcement':
        weakKnowledgePoint?.title ??
        (subject ? `${SUBJECT_LABELS[subject] ?? subject}重点巩固` : '当前重点巩固'),
      'interest-cultivation': buildInterestTopicSuggestion(profile, subject),
      'classroom-review': buildReviewTopicSuggestion(weakKnowledgePoint, subject),
    }),
    [profile, subject, weakKnowledgePoint],
  );

  const recommendedMode = useMemo<LearningMode>(() => {
    if (weakKnowledgePoint) {
      return 'subject-reinforcement';
    }
    if (normalizeText(profile?.target)) {
      return 'preview-preparation';
    }
    if (profile?.subjects?.length) {
      return 'classroom-review';
    }
    return 'interest-cultivation';
  }, [profile?.subjects, profile?.target, weakKnowledgePoint]);

  const recommendedReason = useMemo(() => {
    if (recommendedMode === 'subject-reinforcement' && weakKnowledgePoint) {
      return `当前最值得优先收口的是“${weakKnowledgePoint.title}”，先把薄弱点做稳，最容易转化为真实提升。`;
    }
    if (recommendedMode === 'preview-preparation') {
      return '你已经有明确学习目标，先用预习模式建立主线和问题清单，再进入正式课堂，效率更高。';
    }
    if (recommendedMode === 'classroom-review') {
      return '你已经有稳定学科基础，适合把上过的内容压缩回收，形成可复述的主线和自己的总结。';
    }
    return '如果还没有明确任务，先从兴趣探索把学习状态拉起来，再转入正式巩固。';
  }, [recommendedMode, weakKnowledgePoint]);

  const primaryGoalTemplate = useMemo(
    () => buildPrimaryGoalTemplate(mode, selectedSubjectLabel),
    [mode, selectedSubjectLabel],
  );
  const secondaryGoalTemplate = useMemo(
    () => buildSecondaryGoalTemplate(mode, selectedSubjectLabel),
    [mode, selectedSubjectLabel],
  );
  const recentSessionSummary = useMemo(
    () => (recentSession ? buildRecentStudentSelfStudySummary(recentSession) : null),
    [recentSession],
  );
  const recentSessionDetail = useMemo(
    () => (recentSession ? buildRecentStudentSelfStudyDetail(recentSession) : null),
    [recentSession],
  );
  const recentFollowUpMode = useMemo(
    () => (recentSession ? resolveStudentSelfStudyFollowUpMode(recentSession.mode) : null),
    [recentSession],
  );
  const recentResumeHref = useMemo(
    () =>
      recentSession
        ? buildStudentSelfStudyHref({
            mode: recentSession.mode,
            subject: recentSession.subject,
            topic: recentSession.topic,
            goal: recentSession.learnerGoal,
          })
        : null,
    [recentSession],
  );
  const recentFollowUpHref = useMemo(
    () =>
      recentSession && recentFollowUpMode
        ? buildStudentSelfStudyHref({
            mode: recentFollowUpMode,
            subject: recentSession.subject,
            topic: recentSession.topic,
            goal: recentSession.learnerGoal,
          })
        : null,
    [recentFollowUpMode, recentSession],
  );
  const normalizedLearnerGoal = useMemo(() => normalizeText(learnerGoal), [learnerGoal]);
  const flattenedModules = useMemo(() => flattenModules(modules), [modules]);
  const scopedModules = useMemo(() => {
    if (!subject) {
      return flattenedModules;
    }
    const matched = flattenedModules.filter((item) => item.subject === subject);
    return matched.length ? matched : flattenedModules;
  }, [flattenedModules, subject]);
  const recommendedModule = useMemo(() => {
    const sorted = [...scopedModules].sort((left, right) => {
      if (left.progress !== right.progress) {
        return left.progress - right.progress;
      }
      if (left.module.assignmentCount !== right.module.assignmentCount) {
        return right.module.assignmentCount - left.module.assignmentCount;
      }
      return left.module.title.localeCompare(right.module.title, 'zh-CN');
    });
    return sorted[0] ?? null;
  }, [scopedModules]);
  const scopedAssignments = useMemo(() => {
    const filtered = subject
      ? assignments.filter((item) => item.classSubject === subject)
      : assignments;
    const pool = filtered.length ? filtered : assignments;
    return [...pool].sort((left, right) => {
      const leftCompleted = left.status === 'completed';
      const rightCompleted = right.status === 'completed';
      if (leftCompleted !== rightCompleted) {
        return leftCompleted ? 1 : -1;
      }
      return new Date(left.dueDate).getTime() - new Date(right.dueDate).getTime();
    });
  }, [assignments, subject]);
  const pendingAssignments = useMemo(
    () => scopedAssignments.filter((item) => isPendingAssignment(item)),
    [scopedAssignments],
  );
  const priorityAssignment = useMemo(() => pendingAssignments[0] ?? null, [pendingAssignments]);
  const recentCompletedAssignment = useMemo(() => {
    const completed = scopedAssignments
      .filter((item) => item.status === 'completed')
      .sort((left, right) => {
        const leftAt = new Date(left.completedAt ?? left.dueDate).getTime();
        const rightAt = new Date(right.completedAt ?? right.dueDate).getTime();
        return rightAt - leftAt;
      });
    return completed[0] ?? null;
  }, [scopedAssignments]);
  const relevantLesson = useMemo(() => {
    if (!schedule) {
      return null;
    }

    const candidates = [
      ...(schedule.nextLesson ? [schedule.nextLesson] : []),
      ...schedule.todayLessons,
    ];
    if (!candidates.length) {
      return null;
    }

    if (subject) {
      const sameSubject = candidates.find((item) => item.subject === subject);
      if (sameSubject) {
        return sameSubject;
      }
    }

    return candidates[0] ?? null;
  }, [schedule, subject]);
  const linkedLessonTask = useMemo(
    () =>
      relevantLesson && todayTasks?.tasks?.length
        ? (todayTasks.tasks.find(
            (task) => task.source === 'lesson' && task.sourceId === relevantLesson.id,
          ) ?? null)
        : null,
    [relevantLesson, todayTasks],
  );
  const recommendedTodayTask = useMemo(() => {
    if (!todayTasks?.topTasks?.length) {
      return null;
    }

    return (
      linkedLessonTask ??
      todayTasks.topTasks.find(
        (task) =>
          task.source === 'wrong_review' || task.source === 'plan' || task.source === 'assignment',
      ) ??
      todayTasks.topTasks[0] ??
      null
    );
  }, [linkedLessonTask, todayTasks]);
  const currentModeHref = useMemo(
    () =>
      buildStudentSelfStudyHref({
        mode,
        subject,
        topic: activeTopic || recommendedTopics[mode],
        goal: normalizedLearnerGoal || undefined,
      }),
    [activeTopic, mode, normalizedLearnerGoal, recommendedTopics, subject],
  );
  const modeAssetHeadline = useMemo(() => {
    if (mode === 'preview-preparation') {
      return '把预习主线、课程进度和课前任务串成一个起步闭环';
    }
    if (mode === 'subject-reinforcement') {
      return '把薄弱点、错题和复练动作串成一个收口闭环';
    }
    if (mode === 'classroom-review') {
      return '把课堂主线、作业反馈和追练动作串成一个回看闭环';
    }
    return '把兴趣主题、课程拓展和成果沉淀串成一个探索闭环';
  }, [mode]);
  const modeAssetDescription = useMemo(() => {
    const parts: string[] = [];
    if (recommendedModule) {
      parts.push(`已匹配 ${recommendedModule.className} 的课程模块`);
    }
    if (pendingAssignments.length) {
      parts.push(`待完成作业 ${pendingAssignments.length} 份`);
    }
    if (relevantLesson) {
      parts.push(`最近课程 ${relevantLesson.subjectLabel}`);
    }
    if (todayTasks?.summary?.mustDo) {
      parts.push(`今日必做 ${todayTasks.summary.mustDo} 项`);
    }

    if (parts.length) {
      return parts.join(' · ');
    }

    if (mode === 'preview-preparation') {
      return '先看课程主线，再决定要不要直接进入互动课堂，预习会更贴近真实教学节奏。';
    }
    if (mode === 'subject-reinforcement') {
      return '先把错因、练习和作业串起来，巩固课堂才能真正转化为会做题。';
    }
    if (mode === 'classroom-review') {
      return '先回收上课主线，再做一轮追练，回看课堂才不会停留在“听过”。';
    }
    return '先把兴趣主题和现有学习资产接起来，再沉淀为可复用的长期学习成果。';
  }, [
    mode,
    pendingAssignments.length,
    recommendedModule,
    relevantLesson,
    todayTasks?.summary?.mustDo,
  ]);
  const modeAssetCards = useMemo<ModeAssetCard[]>(() => {
    if (mode === 'preview-preparation') {
      return [
        recommendedModule
          ? {
              id: 'preview-module',
              title: `先看「${recommendedModule.module.title}」`,
              badge: `${SUBJECT_LABELS[recommendedModule.subject] ?? recommendedModule.subject}模块`,
              description: `来自 ${recommendedModule.className}，当前模块共有 ${recommendedModule.module.assignmentCount} 个任务，已完成 ${recommendedModule.module.completedCount} 个。先用模块主线热身，再进入预习课堂会更贴近老师的真实节奏。`,
              href: `/student/modules/${recommendedModule.module.id}`,
              cta: '进入这个模块',
              secondaryHref: '/student/modules',
              secondaryLabel: '查看全部模块',
            }
          : {
              id: 'preview-module-fallback',
              title: '先看课程模块',
              badge: '课程路径',
              description:
                '如果还没有明确预习切口，先进入课程模块查看当前单元和任务，最容易确定这节预习课堂的主线。',
              href: '/student/modules',
              cta: '查看课程模块',
            },
        relevantLesson
          ? {
              id: 'preview-lesson',
              title: `联动下一节${relevantLesson.subjectLabel}课`,
              badge: formatTimeRangeLabel(relevantLesson.startAt, relevantLesson.endAt),
              description: `${relevantLesson.className}${relevantLesson.focusSummary ? ` · 课堂焦点：${relevantLesson.focusSummary}` : ''}${relevantLesson.pendingAssignmentCount ? ` · 关联任务 ${relevantLesson.pendingAssignmentCount} 项` : ''}。先看清老师即将讲什么，预习课堂会更有方向。`,
              href: relevantLesson.actionHref ?? '/calendar',
              cta: relevantLesson.actionLabel ?? '查看课前准备',
              secondaryHref: '/calendar',
              secondaryLabel: '打开完整课表',
            }
          : {
              id: 'preview-lesson-fallback',
              title: '先确认今天课程安排',
              badge: '课表联动',
              description:
                '没有识别到紧邻课程时，也建议先看一眼课表和老师安排，再决定预习课堂围绕哪节内容展开。',
              href: '/calendar',
              cta: '查看课程表',
            },
        priorityAssignment
          ? {
              id: 'preview-assignment',
              title: `课前先清「${priorityAssignment.title}」`,
              badge: formatAssignmentDueLabel(priorityAssignment),
              description: `${priorityAssignment.className} · ${SUBJECT_LABELS[priorityAssignment.classSubject] ?? priorityAssignment.classSubject}${priorityAssignment.moduleTitle ? ` · ${priorityAssignment.moduleTitle}` : ''}。先完成最靠前的一份任务，再进入预习课堂，能更快对上老师节奏。`,
              href: `/student/assignments/${priorityAssignment.id}`,
              cta: '打开这份作业',
              secondaryHref: '/student/assignments',
              secondaryLabel: '进入作业中心',
            }
          : recommendedTodayTask
            ? {
                id: 'preview-today-task',
                title: `先处理「${recommendedTodayTask.title}」`,
                badge: `预计 ${recommendedTodayTask.effortMinutes} 分钟`,
                description: `${recommendedTodayTask.description}。如果你想先用真实任务热身，再进入互动课堂，这是今天最顺手的一步。`,
                href: recommendedTodayTask.href,
                cta: '进入今日任务',
                secondaryHref: currentModeHref,
                secondaryLabel: '保留当前预习设定',
              }
            : {
                id: 'preview-direct',
                title: '直接进入预习课堂',
                badge: '轻启动',
                description:
                  '如果你已经知道要预习什么，就保留当前主题和目标，直接生成一节预习课堂即可。',
                href: currentModeHref,
                cta: '保留当前设定',
              },
      ];
    }

    if (mode === 'subject-reinforcement') {
      const weakPointTitle =
        activeTopic || weakKnowledgePoint?.title || `${selectedSubjectLabel}当前重点`;
      return [
        {
          id: 'reinforcement-wrong-book',
          title: `围绕「${weakPointTitle}」先做错因回收`,
          badge: '错题收口',
          description: weakKnowledgePoint
            ? `画像已经识别到这个薄弱点，先回到错题本看同类错因，再进入互动课堂，会让这节巩固课更聚焦。`
            : '如果暂时没有明确画像薄弱点，也可以先从错题本里找最近最常错的一类题，作为本次巩固课堂的切入口。',
          href: '/wrong-book',
          cta: '进入错题本',
          secondaryHref: '/student/portrait',
          secondaryLabel: '查看学习画像',
        },
        recentSession && recentSession.mode === 'subject-reinforcement'
          ? {
              id: 'reinforcement-practice-recent',
              title: '接着最近一次巩固继续复练',
              badge: buildLearningModeLabel(recentSession.mode),
              description: `${buildRecentStudentSelfStudyDetail(recentSession)}。先续上刚才的讲解和练习，再去做新题，最容易把理解转成稳定得分。`,
              href: recentResumeHref ?? buildPracticeHref(mode),
              cta: recentResumeHref ? '继续上次主题' : '开始复练',
              secondaryHref: buildPracticeHref(mode),
              secondaryLabel: '先做一轮定向复练',
            }
          : {
              id: 'reinforcement-practice',
              title: '马上接一轮定向复练',
              badge: recentSession ? '继续练' : '即时练习',
              description: todayTasks?.recentStudyVariantActivity
                ? `最近你已练习 ${todayTasks.recentStudyVariantActivity.recentAttemptCount} 题，做对 ${todayTasks.recentStudyVariantActivity.recentCorrectCount} 题。现在接一轮复练，最容易把掌握度继续抬上去。`
                : '巩固课堂最怕只听不练。建议在讲解后立刻接一轮定向练习，把“听懂了”变成“能做对”。',
              href: buildPracticeHref(mode),
              cta: '开始定向复练',
              secondaryHref: currentModeHref,
              secondaryLabel: '保留当前巩固设定',
            },
        priorityAssignment
          ? {
              id: 'reinforcement-assignment',
              title: `同步对照「${priorityAssignment.title}」`,
              badge: formatAssignmentDueLabel(priorityAssignment),
              description: `${priorityAssignment.className} · ${SUBJECT_LABELS[priorityAssignment.classSubject] ?? priorityAssignment.classSubject}。把这份作业和互动课堂一起使用，更容易判断这次巩固是否真的收口。`,
              href: `/student/assignments/${priorityAssignment.id}`,
              cta: '打开当前作业',
              secondaryHref: recommendedModule
                ? `/student/modules/${recommendedModule.module.id}`
                : '/student/modules',
              secondaryLabel: recommendedModule ? '回到相关模块' : '查看课程模块',
            }
          : recommendedModule
            ? {
                id: 'reinforcement-module',
                title: `把巩固课堂接回「${recommendedModule.module.title}」`,
                badge: `${recommendedModule.progress}% 进度`,
                description: `这节巩固课结束后，可以回到 ${recommendedModule.className} 的模块继续推进。把自学课堂和班级模块接在一起，学习痕迹会更完整。`,
                href: `/student/modules/${recommendedModule.module.id}`,
                cta: '回到相关模块',
                secondaryHref: '/student/modules',
                secondaryLabel: '查看全部模块',
              }
            : {
                id: 'reinforcement-fallback',
                title: '巩固后回到作业与模块',
                badge: '学习闭环',
                description:
                  '如果当前还没有清晰的班级任务，也建议在巩固课堂后去作业中心或课程模块再做一轮确认，避免停留在“听完了”。',
                href: '/student/assignments',
                cta: '进入作业中心',
                secondaryHref: '/student/modules',
                secondaryLabel: '查看课程模块',
              },
      ];
    }

    if (mode === 'classroom-review') {
      return [
        recommendedModule
          ? {
              id: 'review-module',
              title: `回看「${recommendedModule.module.title}」主线`,
              badge: `${recommendedModule.className}`,
              description: `${recommendedModule.className} 这条模块路径最适合做本次课堂回看的主线。先把模块和课堂内容对齐，再做回看课堂，复盘会更清晰。`,
              href: `/student/modules/${recommendedModule.module.id}`,
              cta: '查看相关模块',
              secondaryHref: '/student/modules',
              secondaryLabel: '打开全部模块',
            }
          : {
              id: 'review-module-fallback',
              title: '先确认回看范围',
              badge: '课程路径',
              description:
                '如果暂时没有锁定要回看的单元，先进入课程模块看一眼本周内容，再决定这节回看课堂围绕哪段主线展开。',
              href: '/student/modules',
              cta: '进入课程模块',
            },
        recentCompletedAssignment
          ? {
              id: 'review-completed-assignment',
              title: `对照最近完成的「${recentCompletedAssignment.title}」`,
              badge:
                recentCompletedAssignment.score !== null && recentCompletedAssignment.total !== null
                  ? `得分 ${recentCompletedAssignment.score}/${recentCompletedAssignment.total}`
                  : '已完成',
              description: `这份作业最适合拿来做回看证据。先复述课堂主线，再对照作业反馈找出还没真正吃透的地方。`,
              href: `/student/assignments/${recentCompletedAssignment.id}`,
              cta: '查看作业反馈',
              secondaryHref: buildPracticeHref(mode),
              secondaryLabel: '回看后做追练',
            }
          : priorityAssignment
            ? {
                id: 'review-pending-assignment',
                title: `回看后处理「${priorityAssignment.title}」`,
                badge: formatAssignmentDueLabel(priorityAssignment),
                description: `这份作业还没完成，最适合做完课堂回看后立即验证。先回看，再回到作业，最容易发现哪里只是“听过”。`,
                href: `/student/assignments/${priorityAssignment.id}`,
                cta: '打开这份作业',
                secondaryHref: buildPracticeHref(mode),
                secondaryLabel: '先做一轮追练',
              }
            : {
                id: 'review-practice',
                title: '回看后立刻做一轮追练',
                badge: '追练收口',
                description:
                  '课堂回看真正有价值的地方，不是重新听一遍，而是听完后马上做一轮题，确认自己真的能复述也能迁移。',
                href: buildPracticeHref(mode),
                cta: '开始追练',
                secondaryHref: '/wrong-book',
                secondaryLabel: '回到错题本',
              },
        relevantLesson
          ? {
              id: 'review-lesson',
              title: '对照最近课堂节奏回收重点',
              badge: relevantLesson.subjectLabel,
              description: `${relevantLesson.className}${relevantLesson.focusSummary ? ` · 课堂焦点：${relevantLesson.focusSummary}` : ''}。把老师真实课堂节奏和 AI 回看课堂对照起来，复盘会更贴近你的真实学习现场。`,
              href: relevantLesson.actionHref ?? '/calendar',
              cta: relevantLesson.actionLabel ?? '查看课堂关联',
              secondaryHref: '/calendar',
              secondaryLabel: '查看课程表',
            }
          : {
              id: 'review-follow-up',
              title: '回看后切到学科巩固',
              badge: '下一步',
              description:
                '如果这节回看课堂把主线捋顺了，下一步最值得做的是切到学科巩固模式，用讲解加练习把薄弱点真正收口。',
              href: buildStudentSelfStudyHref({
                mode: 'subject-reinforcement',
                subject,
                topic: activeTopic || weakKnowledgePoint?.title,
                goal: normalizedLearnerGoal || undefined,
              }),
              cta: '切到学科巩固',
              secondaryHref: buildPracticeHref(mode),
              secondaryLabel: '先做一轮追练',
            },
      ];
    }

    return [
      {
        id: 'interest-explore',
        title: `围绕「${activeTopic || recommendedTopics[mode]}」继续拓展`,
        badge: selectedSubjectLabel,
        description:
          '兴趣探索不是随便聊聊，而是把好奇心拉进一条有主题、有追问、有产出的学习路径。先把主题说清楚，再启动探索课堂。 ',
        href: currentModeHref,
        cta: '保留当前探索设定',
        secondaryHref: '/student/modules',
        secondaryLabel: '看看课程拓展路径',
      },
      recommendedModule
        ? {
            id: 'interest-module',
            title: `把兴趣主题接到「${recommendedModule.module.title}」`,
            badge: `${recommendedModule.className}`,
            description: `当前主题可以顺手延展到 ${recommendedModule.className} 的课程模块。把兴趣主题和正式课程接在一起，更容易形成长期学习成果。`,
            href: `/student/modules/${recommendedModule.module.id}`,
            cta: '进入相关模块',
            secondaryHref: '/student/modules',
            secondaryLabel: '查看全部模块',
          }
        : {
            id: 'interest-module-fallback',
            title: '从课程模块里找延展入口',
            badge: '课程拓展',
            description:
              '如果你想把兴趣探索继续做深，可以去课程模块里找同主题或同学科内容，把一次探索变成长期积累。',
            href: '/student/modules',
            cta: '查看课程模块',
          },
      {
        id: 'interest-follow-up',
        title: '把兴趣课堂沉淀成可回看的成果',
        badge: '成果沉淀',
        description:
          '探索完后别停在“挺有意思”。建议切到课堂回看模式，把这次探索压缩成可以复述、可以分享、可以继续追练的一条成果路径。',
        href: buildStudentSelfStudyHref({
          mode: 'classroom-review',
          subject,
          topic: activeTopic || recommendedTopics[mode],
          goal: normalizedLearnerGoal || undefined,
        }),
        cta: '切到课堂回看',
        secondaryHref: '/student/growth',
        secondaryLabel: '打开成长档案',
      },
    ];
  }, [
    activeTopic,
    currentModeHref,
    mode,
    normalizedLearnerGoal,
    priorityAssignment,
    recentCompletedAssignment,
    recentResumeHref,
    recentSession,
    recommendedModule,
    recommendedTodayTask,
    recommendedTopics,
    relevantLesson,
    selectedSubjectLabel,
    subject,
    todayTasks?.recentStudyVariantActivity,
    weakKnowledgePoint,
  ]);
  const currentTopicDisplay = activeTopic || recommendedTopics[mode];
  const currentGoalDisplay = normalizeText(learnerGoal) || primaryGoalTemplate;
  const nextLessonSummary = relevantLesson
    ? `${relevantLesson.className} · ${formatTimeRangeLabel(relevantLesson.startAt, relevantLesson.endAt)}`
    : '暂无紧邻课程';
  const moduleSummary = recommendedModule
    ? `${recommendedModule.className} · ${recommendedModule.module.title}`
    : '暂未匹配课程模块';
  const taskSummary = priorityAssignment
    ? `${priorityAssignment.title} · ${formatAssignmentDueLabel(priorityAssignment)}`
    : pendingAssignments.length
      ? `待完成作业 ${pendingAssignments.length} 份`
      : '当前没有待完成作业';
  const mustDoCount = todayTasks?.summary?.mustDo ?? 0;
  const recommendedBridgeSummary = relevantLesson
    ? nextLessonSummary
    : priorityAssignment
      ? taskSummary
      : moduleSummary;
  const recommendedBridgeHelper = relevantLesson
    ? '优先把这次自学接到真实课堂节奏里'
    : priorityAssignment
      ? '课堂前后都能直接对照真实任务做验证'
      : recommendedModule
        ? '开课后可把学习痕迹继续接回课程模块'
        : '没有上下文也能先按当前主题独立启动';
  const focusContextSummary = [
    relevantLesson ? '课程已联动' : null,
    recommendedModule ? '模块已匹配' : null,
    pendingAssignments.length ? `待办 ${pendingAssignments.length}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const modeOutcomeSummary = activeConfig.deliverables.slice(0, 2).join(' / ');
  const actionChecklist = [
    {
      id: 'mode',
      label: '先定模式',
      value: buildLearningModeLabel(mode),
      helper: '预习、巩固、兴趣探索或课堂回看都可以直接开课',
    },
    {
      id: 'goal',
      label: '再带目标',
      value: normalizedLearnerGoal ? '课堂目标已带入' : '系统会自动补目标',
      helper: normalizedLearnerGoal
        ? '本次课堂会围绕你的当前目标推进'
        : '没有手填目标时也能先启动，再由系统补齐主推荐目标',
    },
    {
      id: 'launch',
      label: '最后开课',
      value: recentResumeHref ? '可以继续上次进度' : '一键进入互动课堂',
      helper: '课堂结束后再回到作业、模块或追练页面做收口',
    },
  ];
  const quickStartHighlights = [
    {
      id: 'launch',
      label: '开课方式',
      value: recentResumeHref ? '可继续上次课堂' : '只填核心信息就能开课',
      helper: recentResumeHref ? '会延续上次主题、目标和课堂节奏' : '先开课，再按课堂反馈细调更省心',
    },
    {
      id: 'bridge',
      label: '课堂衔接',
      value: recommendedBridgeSummary,
      helper: recommendedBridgeHelper,
    },
  ];
  const focusOverviewItems = [
    ...quickStartHighlights,
    {
      id: 'topic',
      label: '当前主题',
      value: currentTopicDisplay,
      helper: activeConfig.topicLabel,
    },
    {
      id: 'goal',
      label: '学习目标',
      value: currentGoalDisplay,
      helper: normalizedLearnerGoal ? '会作为本次课堂目标带入' : '已按当前模式补入主推荐目标',
    },
  ];
  const actionPills = [
    recentResumeHref ? '可无缝续学' : '3 步可开课',
    '支持回看导出',
  ];
  const guestBenefitItems = [
    {
      id: 'profile-sync',
      label: '登录后系统会同步',
      value: '年级、学科、目标与薄弱点',
      helper: '开课时不需要重复填写背景，课堂会更贴近你的真实学习状态。',
    },
    {
      id: 'delivery-chain',
      label: '这节课会自动形成',
      value: '数字讲解、互动练习与回看导出',
      helper: '不止是看一遍内容，而是能继续回看、展示、沉淀和接后续练习。',
    },
  ];
  const guestPreviewItems = [
    {
      id: 'mode',
      label: '当前正在预览',
      value: buildLearningModeLabel(mode),
      helper: activeConfig.helper,
    },
    {
      id: 'entry',
      label: '登录后会先这样开始',
      value: activeConfig.learningSteps[0],
      helper: `${activeConfig.deliverables.slice(0, 2).join(' / ')} 会一起准备好。`,
    },
  ];
  const editorMetaItems = [
    {
      id: 'required',
      label: '现在要填',
      value: '学科、主题、目标',
      helper: '至少确定一个主题方向，系统就能开始编排课堂。',
    },
    {
      id: 'automatic',
      label: '系统会补齐',
      value: '角色、节奏、上下文',
      helper: '会自动带入教务角色、学习画像、模块和任务联动。',
    },
    {
      id: 'outcome',
      label: '生成后得到',
      value: '可播放课堂与导出结果',
      helper: '默认支持数字人讲解、互动练习、回看与成果沉淀。',
    },
  ];
  const editorPreviewItems =
    editorPanel === 'flow'
      ? [
          {
            id: 'opening',
            label: '开场方式',
            value: activeConfig.learningSteps[0] ?? '先快速进入主题',
            helper: '先把主题、问题和进入方式拉齐，避免一开场就进入长对话。',
          },
          {
            id: 'middle',
            label: '中段推进',
            value: activeConfig.learningSteps[1] ?? '边讲边练',
            helper: '会把解释、追问和即时练习交错推进，不让节奏断掉。',
          },
          {
            id: 'ending',
            label: '结束收口',
            value:
              activeConfig.learningSteps[activeConfig.learningSteps.length - 1] ?? '回到复盘与沉淀',
            helper: '课堂尾段会自然接到回看、任务或导出沉淀。',
          },
        ]
      : [
          {
            id: 'learner',
            label: '学习者身份',
            value: learnerName,
            helper: `${stageLabel} · ${selectedSubjectLabel}`,
          },
          {
            id: 'bridge',
            label: '自动衔接',
            value: recommendedBridgeSummary,
            helper: recommendedBridgeHelper,
          },
          {
            id: 'delivery',
            label: '课堂产出',
            value: activeConfig.deliverables.slice(0, 2).join(' / '),
            helper: '数字人讲解、互动练习、回看与导出会按课堂模式一起生成。',
          },
        ];
  const editorQuickGlanceItems = [
    {
      id: 'entry',
      label: editorPanel === 'flow' ? '建议先做' : '默认入口',
      value: activeConfig.learningSteps[0] ?? '先进入主题',
      helper:
        editorPanel === 'flow'
          ? '先抓住这节课的进入方式，再决定是否展开完整编排。'
          : '即使不展开完整上下文，系统也会按这个入口先带你进入课堂。',
    },
    {
      id: 'bridge',
      label: '最顺手衔接',
      value: recommendedBridgeSummary,
      helper: recommendedBridgeHelper,
    },
    {
      id: 'after',
      label: '课后出口',
      value: recentFollowUpMode
        ? `切到${buildLearningModeLabel(recentFollowUpMode)}`
        : modeAssetCards[0]?.cta ?? '继续当前学习主线',
      helper: '课堂结束后可以继续接任务、模块、回看或导出沉淀。',
    },
  ];
  const editorSideDescription =
    editorPanel === 'flow'
      ? '先看这节课会怎么展开，再决定要不要打开完整编排细节。'
      : '先看系统会自动带入哪些真实学习上下文，再决定要不要展开全部信息。';
  const editorDisclosureLabel = editorPanel === 'flow' ? '展开完整课堂推进' : '展开自动带入细节';
  const editorDisclosureChip =
    editorPanel === 'flow' ? `${activeConfig.learningSteps.length} 个环节` : '角色 / 画像 / 任务';
  const editorSideNote =
    editorPanel === 'flow'
      ? `${buildLearningModeLabel(mode)}不会只生成一段话，而是会按课堂节奏依次推进讲解、互动、练习和收口。`
      : '这些上下文会在你开课后自动带入，不需要在这里重复填写。';

  const updateTopicDraft = (nextMode: LearningMode, value: string) => {
    setTopicDrafts((prev) => ({
      ...prev,
      [nextMode]: value,
    }));
  };

  useEffect(() => {
    if (!initialized || !deepLinkKey || deepLinkKey === lastAppliedDeepLinkRef.current) {
      return;
    }

    lastAppliedDeepLinkRef.current = deepLinkKey;
    const targetMode = deepLinkedMode ?? mode;

    if (deepLinkedMode) {
      setMode(deepLinkedMode);
    }
    if (deepLinkedSubject) {
      setSubject(deepLinkedSubject);
    }
    if (deepLinkedTopic) {
      setTopicDrafts((prev) => ({
        ...prev,
        [targetMode]: deepLinkedTopic,
      }));
    }
    if (deepLinkedGoal) {
      setLearnerGoal(deepLinkedGoal);
    }
  }, [
    deepLinkKey,
    deepLinkedGoal,
    deepLinkedMode,
    deepLinkedSubject,
    deepLinkedTopic,
    initialized,
    mode,
  ]);

  const applyQuickTopic = (nextMode: LearningMode) => {
    if (nextMode === 'interest-cultivation') {
      updateTopicDraft(nextMode, '火箭为什么能升空');
      return;
    }
    if (nextMode === 'classroom-review') {
      updateTopicDraft(
        nextMode,
        recommendedTopics[nextMode] || `${selectedSubjectLabel}课堂重点回看`,
      );
      return;
    }
    if (nextMode === 'preview-preparation') {
      updateTopicDraft(nextMode, recommendedTopics[nextMode] || `${selectedSubjectLabel}新课预习`);
      return;
    }
    updateTopicDraft(nextMode, recommendedTopics[nextMode] || `${selectedSubjectLabel}重点巩固`);
  };

  const launchButtonLabel = useMemo(() => {
    if (mode === 'preview-preparation') return '生成预习课堂并进入';
    if (mode === 'subject-reinforcement') return '生成巩固课堂并进入';
    if (mode === 'classroom-review') return '生成回看课堂并进入';
    return '生成探索课堂并进入';
  }, [mode]);

  const handleLaunch = async () => {
    if (mode === 'interest-cultivation' && !activeTopic) {
      setLaunchError('请先填写你想探索的兴趣主题。');
      return;
    }

    if (mode !== 'interest-cultivation' && !subject && !activeTopic) {
      setLaunchError(`请至少选择一门学科，或填写“${activeConfig.topicLabel}”。`);
      return;
    }

    setLaunching(true);
    setLaunchError(null);

    try {
      const payload = buildAiClassroomLaunchPayloadFromStudentSelfStudy({
        student: {
          id: authUser?.id ?? 'student-self-study',
          name: authUser?.name,
          preferredName: profile?.preferredName,
          grade: profile?.grade,
          subjects: subject ? [subject] : profile?.subjects,
          target: profile?.target,
          strengths: profile?.strengths,
        },
        mode,
        subject: subject || undefined,
        topic: activeTopic || recommendedTopics[mode] || undefined,
        learnerGoal: normalizeText(learnerGoal) || undefined,
        focusKnowledgePointTitle:
          mode === 'subject-reinforcement' || mode === 'classroom-review'
            ? activeTopic || weakKnowledgePoint?.title
            : undefined,
      });

      const nextRecentSession = saveRecentStudentSelfStudySession({
        mode,
        subject: subject || undefined,
        topic: activeTopic || recommendedTopics[mode] || undefined,
        learnerGoal: normalizedLearnerGoal || undefined,
      });
      setRecentSession(nextRecentSession);
      saveAiClassroomLaunchPayload(payload);
      router.push('/ai-classroom');
    } catch (error) {
      setLaunchError(error instanceof Error ? error.message : '互动课堂启动失败，请稍后重试。');
    } finally {
      setLaunching(false);
    }
  };

  if (loading && !profile && !weakKnowledgePoint && !authUser) {
    return (
      <WorkspaceLoadingState
        title="学生互动课堂加载中"
        description="正在同步你的学习画像、目标和课堂预设。"
      />
    );
  }

  if (authRequired) {
    const authModeCards = MODE_ORDER.map((item) => ({
      id: item,
      label: buildLearningModeLabel(item),
      ...MODE_CONFIG[item],
    }));

    return (
      <WorkspacePage
        className="grid dashboard-stack student-self-study-shell"
        title="知序课堂"
        subtitle="登录后，预习、巩固、兴趣探索和课堂回看会收进同一条可持续推进的学习主线。"
        chips={[
          <span key="student-auth-preview" className="chip">
            学生自主学习入口
          </span>,
          <span key="student-auth-modes" className="chip">
            四种学习模式
          </span>,
          <span key="student-auth-outcome" className="chip">
            回看与导出已接入
          </span>,
        ]}
        actions={
          <>
            <Link className="button ghost" href="/ai-classroom">
              先看互动课堂主页
            </Link>
            <Link className="button primary" href="/login">
              学生登录后开始
            </Link>
          </>
        }
      >
        <div className="student-self-study-guest-grid">
          <div
            className="workflow-spotlight-card student-self-study-guest-hero"
            style={{
              background: activeConfig.gradient,
              border: `1px solid ${activeConfig.accent}`,
            }}
          >
            <div className="student-self-study-focus-kicker">未登录也可以先了解怎么学</div>
            <div className="student-self-study-focus-title">
              登录后，把{buildLearningModeLabel(mode)}、互动课堂和后续练习接成一条完整学习链路
            </div>
            <p className="student-self-study-focus-description">
              系统会自动同步你的年级、学科、学习目标、课堂模式和后续衔接建议。不是只给一段聊天内容，而是把讲解、互动、回看、导出和继续学习组织成真正能反复使用的一节课。
            </p>
            <div className="pill-list" style={{ marginTop: 14 }}>
              <span className="pill">{buildLearningModeLabel(mode)}</span>
              <span className="pill">{activeConfig.sectionTag}</span>
              <span className="pill">自动带入画像与目标</span>
              <span className="pill">支持学习成果沉淀</span>
            </div>
            <div className="student-self-study-guest-benefit-grid">
              {guestBenefitItems.map((item) => (
                <div className="workflow-summary-card" key={item.id}>
                  <div className="workflow-summary-label">{item.label}</div>
                  <div className="student-self-study-glance-value">{item.value}</div>
                  <div className="workflow-summary-helper">{item.helper}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="workflow-spotlight-card student-self-study-guest-side">
            <StatePanel
              tone="info"
              title="需要学生账号登录"
              description="登录后，系统才能把你的个人画像、学习任务和课堂目标带进互动课堂，自动为你选择更合适的讲解方式与后续学习路径。"
              action={
                <Link className="button secondary" href="/login">
                  前往登录
                </Link>
              }
            />
            <div className="workflow-summary-grid student-self-study-guest-summary-grid">
              {guestPreviewItems.map((item) => (
                <div className="workflow-summary-card" key={item.id}>
                  <div className="workflow-summary-label">{item.label}</div>
                  <div className="student-self-study-glance-value">{item.value}</div>
                  <div className="workflow-summary-helper">{item.helper}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="student-self-study-guest-mode-grid">
          {authModeCards.map((item) => {
            const selected = item.id === mode;
            return (
              <Link
                key={item.id}
                className={`student-self-study-guest-mode-card${selected ? ' is-active' : ''}`}
                href={`/student/interactive-classroom?mode=${item.id}`}
              >
                <div className="student-self-study-guest-mode-header">
                  <div className="student-self-study-guest-mode-icon">
                    <EduIcon name={item.icon} />
                  </div>
                  <div>
                    <div className="workflow-summary-label">{item.sectionTag}</div>
                    <div className="student-self-study-guest-mode-title">{item.label}</div>
                  </div>
                </div>
                <div className="student-self-study-guest-mode-description">{item.summary}</div>
                <div className="pill-list" style={{ marginTop: 10 }}>
                  {item.quickPills.slice(0, 2).map((pill) => (
                    <span key={`${item.id}-${pill}`} className="pill">
                      {pill}
                    </span>
                  ))}
                </div>
              </Link>
            );
          })}
        </div>
      </WorkspacePage>
    );
  }

  if (pageError && !profile && !weakKnowledgePoint && !authUser) {
    return (
      <WorkspaceErrorState
        title="学生互动课堂加载失败"
        description={pageError}
        onRetry={() => {
          void loadPage('refresh');
        }}
      />
    );
  }

  return (
    <WorkspacePage
      className="grid dashboard-stack student-self-study-shell"
      title="知序课堂"
      subtitle="把预习、巩固、兴趣探索和课堂回看收进一个可以反复使用的自主学习空间。"
      lastLoadedAt={lastLoadedAt}
      chips={[
        <span key="student-self-study-mode" className="chip">
          学生自主学习
        </span>,
        <span key="student-mode-current" className="chip">
          {buildLearningModeLabel(mode)}
        </span>,
        weakKnowledgePoint ? (
          <span key="student-weak-point" className="chip">
            已识别薄弱点
          </span>
        ) : null,
        guestExperienceMode ? (
          <span key="student-guest-mode" className="chip">
            访客体验
          </span>
        ) : null,
      ].filter(Boolean)}
      actions={
        <>
          <Link className="button ghost" href="/student">
            返回今日学习
          </Link>
          {guestExperienceMode ? (
            <Link className="button secondary" href="/login">
              登录同步个人进度
            </Link>
          ) : (
            <Link className="button secondary" href="/student/profile">
              调整学生资料
            </Link>
          )}
          <button
            className="button primary"
            type="button"
            onClick={() => {
              void loadPage('refresh');
            }}
            disabled={loading || refreshing}
          >
            {refreshing ? '刷新中...' : '刷新推荐'}
          </button>
        </>
      }
    >
      {bootstrapNotice ? <div className="status-note info">{bootstrapNotice}</div> : null}

      <div className="student-self-study-top-grid">
        <div
          className="workflow-spotlight-card student-self-study-focus-card"
          style={{
            background: activeConfig.gradient,
            border: `1px solid ${activeConfig.accent}`,
          }}
        >
          <div className="student-self-study-focus-kicker">现在最重要</div>
          <div className="student-self-study-focus-title">
            围绕「{currentTopicDisplay}」开始一节{buildLearningModeLabel(mode)}
          </div>
          <p className="student-self-study-focus-description">
            {activeConfig.summary} 系统会自动带入真实课堂上下文，让讲解、练习、回看与导出保持同一条学习主线。
          </p>
          <div className="pill-list" style={{ marginTop: 14 }}>
            <span className="pill">{stageLabel}</span>
            <span className="pill">{selectedSubjectLabel}</span>
            <span className="pill">{buildLearningModeLabel(mode)}</span>
            {mustDoCount ? <span className="pill">{`今日必做 ${mustDoCount} 项`}</span> : null}
          </div>
          <div className="student-self-study-focus-overview-grid">
            {focusOverviewItems.map((item) => (
              <div className="student-self-study-focus-overview-item" key={item.id}>
                <div className="workflow-summary-label">{item.label}</div>
                <div className="student-self-study-glance-value">{item.value}</div>
                <div className="student-self-study-glance-helper">{item.helper}</div>
              </div>
            ))}
          </div>

          <details className="workflow-collapsible student-self-study-inline-collapsible">
            <summary>
              <span>展开学习上下文与课堂衔接</span>
              <span className="chip">{focusContextSummary || '课程 / 模块 / 任务'}</span>
            </summary>
            <div className="workflow-collapsible-body">
              <div className="workflow-summary-grid student-self-study-context-grid">
                <div className="workflow-summary-card">
                  <div className="workflow-summary-label">优先衔接</div>
                  <div className="workflow-summary-value student-self-study-summary-text">
                    {recommendedBridgeSummary}
                  </div>
                  <div className="workflow-summary-helper">{recommendedBridgeHelper}</div>
                </div>
                <div className="workflow-summary-card">
                  <div className="workflow-summary-label">下一节课</div>
                  <div className="workflow-summary-value student-self-study-summary-text">
                    {nextLessonSummary}
                  </div>
                  <div className="workflow-summary-helper">
                    {relevantLesson
                      ? '优先把自主学习接到真实课堂节奏里'
                      : '暂时可先按当前主题独立启动'}
                  </div>
                </div>
                <div className="workflow-summary-card">
                  <div className="workflow-summary-label">课程模块</div>
                  <div className="workflow-summary-value student-self-study-summary-text">
                    {moduleSummary}
                  </div>
                  <div className="workflow-summary-helper">
                    {recommendedModule
                      ? `${recommendedModule.progress}% 已推进`
                      : '后续可在课程模块继续沉淀学习痕迹'}
                  </div>
                </div>
                <div className="workflow-summary-card">
                  <div className="workflow-summary-label">当前任务</div>
                  <div className="workflow-summary-value student-self-study-summary-text">
                    {taskSummary}
                  </div>
                  <div className="workflow-summary-helper">
                    {mustDoCount
                      ? `今日必做 ${mustDoCount} 项，建议课后回到任务清单继续收口`
                      : '没有必做任务时，更适合先建立学习节奏'}
                  </div>
                </div>
              </div>
            </div>
          </details>
        </div>

        <div className="workflow-spotlight-card student-self-study-action-card">
          <div className="student-self-study-focus-kicker">快速开课</div>
          <div className="student-self-study-action-title">从这里直接进入互动课堂</div>
          <p className="student-self-study-action-description">
            先用最少设定开课，再把这次学习接回任务、模块和后续追练。
          </p>
          <div className="student-self-study-action-note">当前建议：{recommendedReason}</div>
          <div className="cta-row" style={{ marginTop: 0 }}>
            <button
              className="button primary"
              type="button"
              onClick={() => void handleLaunch()}
              disabled={launching}
            >
              {launching ? '正在进入互动课堂...' : launchButtonLabel}
            </button>
            {recentResumeHref ? (
              <Link className="button secondary" href={recentResumeHref}>
                继续上次进度
              </Link>
            ) : (
              <a className="button secondary" href="#student-self-study-editor">
                先调整课堂设定
              </a>
            )}
            {recentFollowUpMode && recentFollowUpHref ? (
              <Link className="button ghost" href={recentFollowUpHref}>
                切到{buildLearningModeLabel(recentFollowUpMode)}
              </Link>
            ) : (
              <a className="button ghost" href="#student-self-study-modes">
                切换学习模式
              </a>
            )}
          </div>
          <div className="pill-list" style={{ marginTop: 12 }}>
            {actionPills.map((pill) => (
              <span className="pill" key={pill}>
                {pill}
              </span>
            ))}
          </div>
          <div className="student-self-study-action-grid">
            {actionChecklist.map((item, index) => (
              <div className="student-self-study-action-step" key={item.id}>
                <div className="student-self-study-action-step-header">
                  <span className="student-self-study-action-step-index">{index + 1}</span>
                  <div className="workflow-summary-label">{item.label}</div>
                </div>
                <div className="student-self-study-action-step-value">{item.value}</div>
                <div className="workflow-summary-helper">{item.helper}</div>
              </div>
            ))}
          </div>
          {recentSession && recentResumeHref ? (
            <details className="workflow-collapsible student-self-study-inline-collapsible student-self-study-recent-collapsible">
              <summary>
                <span>查看最近一次课堂</span>
                <span className="chip">{recentSessionSummary}</span>
              </summary>
              <div className="workflow-collapsible-body">
                <div className="student-self-study-recent-panel">
                  <div className="section-title">{recentSessionSummary}</div>
                  <div className="meta-text">
                    上次更新于 {formatRecentStudentSelfStudyTime(recentSession.updatedAt)}
                  </div>
                  <div className="student-self-study-recent-description">
                    {recentSessionDetail}
                  </div>
                </div>
              </div>
            </details>
          ) : (
            <div className="student-self-study-recent-panel">
              <div className="section-title">第一次启动也没关系</div>
              <div className="student-self-study-recent-description">
                不需要一次把设定写得很满。先确定一个主题和一个目标就能开课，系统会自动补全课程联动、画像上下文和课堂脚本。
              </div>
            </div>
          )}
          {launchError ? <div className="status-note error">{launchError}</div> : null}
        </div>
      </div>

      <details className="workflow-collapsible" id="student-self-study-modes">
        <summary>
          <span>模式切换与推荐路线</span>
          <span className="chip">{buildLearningModeLabel(mode)}</span>
        </summary>
        <div className="workflow-collapsible-body">
          <div className="workflow-tab-list">
            {MODE_ORDER.map((item) => {
              const selected = item === mode;
              const recommended = item === recommendedMode;

              return (
                <button
                  key={item}
                  type="button"
                  className={`workflow-tab-button${selected ? ' is-active' : ''}`}
                  onClick={() => setMode(item)}
                  aria-pressed={selected}
                >
                  {buildLearningModeLabel(item)}
                  {recommended ? ' · 推荐' : ''}
                </button>
              );
            })}
          </div>

          <div className="student-self-study-mode-panel">
            <div
              className="workflow-spotlight-card"
              style={{
                background: activeConfig.gradient,
                border: `1px solid ${activeConfig.accent}`,
              }}
            >
              <div className="feature-card" style={{ alignItems: 'flex-start' }}>
                <EduIcon name={activeConfig.icon} />
                <div>
                  <div className="section-title" style={{ fontSize: 20 }}>
                    {buildLearningModeLabel(mode)}更适合当下这个学习场景
                  </div>
                  <p className="student-self-study-focus-description" style={{ marginTop: 8 }}>
                    {activeConfig.summary}
                  </p>
                </div>
              </div>
              <div className="pill-list" style={{ marginTop: 14 }}>
                {activeConfig.quickPills.map((pill) => (
                  <span className="pill" key={`${mode}-${pill}`}>
                    {pill}
                  </span>
                ))}
              </div>
              <div className="workflow-summary-grid" style={{ marginTop: 16 }}>
                <div className="workflow-summary-card">
                  <div className="workflow-summary-label">系统推荐</div>
                  <div className="workflow-summary-value student-self-study-summary-text">
                    {buildLearningModeLabel(recommendedMode)}
                  </div>
                  <div className="workflow-summary-helper">{recommendedReason}</div>
                </div>
                <div className="workflow-summary-card">
                  <div className="workflow-summary-label">当前焦点</div>
                  <div className="workflow-summary-value student-self-study-summary-text">
                    {currentTopicDisplay}
                  </div>
                  <div className="workflow-summary-helper">
                    {normalizedLearnerGoal ? currentGoalDisplay : '建议补充一个更具体的课堂目标'}
                  </div>
                </div>
                <div className="workflow-summary-card">
                  <div className="workflow-summary-label">课堂产出</div>
                  <div className="workflow-summary-value student-self-study-summary-text">
                    {modeOutcomeSummary}
                  </div>
                  <div className="workflow-summary-helper">支持全班观看、课后回看和导出沉淀</div>
                </div>
              </div>
            </div>

            <div className="student-self-study-guidance-list">
              <div className="workflow-step-line">为什么现在适合这样学：{recommendedReason}</div>
              <div className="workflow-step-line">
                课堂会优先这样推进： {activeConfig.learningSteps.slice(0, 3).join(' → ')}
              </div>
              <div className="workflow-step-line">
                {modeAssetHeadline} {modeAssetDescription}
              </div>
              <div className="workflow-step-line">使用建议：{activeConfig.helper}</div>
            </div>
          </div>
        </div>
      </details>

      <details className="workflow-collapsible" id="student-self-study-editor" open>
        <summary>
          <span>课堂设定与生成脚本</span>
          <span className="chip">{activeConfig.sectionTag}</span>
        </summary>
        <div className="workflow-collapsible-body">
          <div className="student-self-study-editor-grid">
            <div className="workflow-spotlight-card">
              <div className="section-title" style={{ fontSize: 18 }}>
                课堂任务设置
              </div>
              <div className="meta-text" style={{ marginTop: 8, lineHeight: 1.7 }}>
                这里只保留最关键的三件事：学什么、聚焦什么、这节课希望达到什么结果。
              </div>
              <div className="student-self-study-editor-meta-grid">
                {editorMetaItems.map((item) => (
                  <div className="student-self-study-editor-meta-card" key={item.id}>
                    <div className="workflow-summary-label">{item.label}</div>
                    <div className="student-self-study-editor-meta-value">{item.value}</div>
                    <div className="student-self-study-glance-helper">{item.helper}</div>
                  </div>
                ))}
              </div>
              <div className="grid" style={{ gap: 14, marginTop: 14 }}>
                <div className="student-self-study-editor-form-grid">
                  <label className="student-self-study-editor-field">
                    <div className="section-title">学习学科</div>
                    <select
                      value={subject}
                      onChange={(event) => setSubject(event.target.value)}
                      style={studentProfileInputStyle}
                    >
                      <option value="">自动判断 / 综合</option>
                      {subjectOptions.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="grid student-self-study-editor-field-stack" style={{ gap: 8 }}>
                    <label>
                      <div className="section-title">{activeConfig.topicLabel}</div>
                      <input
                        value={topicDrafts[mode]}
                        onChange={(event) => updateTopicDraft(mode, event.target.value)}
                        placeholder={activeConfig.topicPlaceholder}
                        style={studentProfileInputStyle}
                        data-testid="student-self-study-topic"
                      />
                    </label>
                    <div className="cta-row cta-row-tight">
                      <button
                        className="button ghost"
                        type="button"
                        onClick={() => updateTopicDraft(mode, recommendedTopics[mode])}
                      >
                        带入系统推荐
                      </button>
                      <button
                        className="button ghost"
                        type="button"
                        onClick={() => applyQuickTopic(mode)}
                      >
                        快速生成可用主题
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid student-self-study-editor-field-stack" style={{ gap: 8 }}>
                  <label>
                    <div className="section-title">这节课想帮你达到什么目标</div>
                    <textarea
                      value={learnerGoal}
                      onChange={(event) => setLearnerGoal(event.target.value)}
                      placeholder="例如：把这类题真正做稳；先听懂概念，再敢自己做一遍。"
                      rows={4}
                      style={studentProfileTextareaStyle}
                    />
                  </label>
                  <div className="cta-row cta-row-tight">
                    <button
                      className="button ghost"
                      type="button"
                      onClick={() => setLearnerGoal(primaryGoalTemplate)}
                    >
                      使用主推荐目标
                    </button>
                    <button
                      className="button ghost"
                      type="button"
                      onClick={() => setLearnerGoal(secondaryGoalTemplate)}
                    >
                      使用另一种表达
                    </button>
                  </div>
                </div>

                <div className="status-note info">
                  当前模式会按“{buildLearningModeLabel(mode)}
                  ”编排学习脚本，默认支持自主学习、全班观看、课后回看和导出。
                </div>

                <div className="workflow-step-line student-self-study-editor-note">
                  默认只保留开课必须输入。想看课堂推进方式或自动带入的上下文时，再展开“高级课堂编排”即可。
                </div>

                <div className="cta-row">
                  <button
                    className="button primary"
                    type="button"
                    onClick={() => void handleLaunch()}
                    disabled={launching}
                    data-testid="student-self-study-launch"
                  >
                    {launching ? '正在进入互动课堂...' : launchButtonLabel}
                  </button>
                  <Link className="button ghost" href="/student/portrait">
                    查看薄弱点
                  </Link>
                  <Link className="button ghost" href="/student/modules">
                    查看课程模块
                  </Link>
                </div>
              </div>
            </div>
            <div className="student-self-study-side-stack">
              <div className="workflow-spotlight-card student-self-study-side-panel">
                <div
                  className="cta-row"
                  style={{
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: 10,
                    flexWrap: 'wrap',
                    marginTop: 0,
                  }}
                >
                  <div>
                    <div className="section-title" style={{ fontSize: 18 }}>
                      {editorPanel === 'flow' ? '这节课会怎么展开' : '系统会自动带入什么'}
                    </div>
                    <div className="meta-text" style={{ marginTop: 8, lineHeight: 1.7 }}>
                      {editorSideDescription}
                    </div>
                  </div>
                  <div className="workflow-tab-list student-self-study-panel-switcher">
                    <button
                      type="button"
                      className={`workflow-tab-button${editorPanel === 'flow' ? ' is-active' : ''}`}
                      onClick={() => setEditorPanel('flow')}
                      aria-pressed={editorPanel === 'flow'}
                    >
                      课堂推进
                    </button>
                    <button
                      type="button"
                      className={`workflow-tab-button${editorPanel === 'context' ? ' is-active' : ''}`}
                      onClick={() => setEditorPanel('context')}
                      aria-pressed={editorPanel === 'context'}
                    >
                      自动带入
                    </button>
                  </div>
                </div>

                <div className="student-self-study-side-summary-grid">
                  {editorPreviewItems.map((item) => (
                    <div className="student-self-study-side-summary-card" key={item.id}>
                      <div className="workflow-summary-label">{item.label}</div>
                      <div className="student-self-study-editor-meta-value">{item.value}</div>
                      <div className="student-self-study-glance-helper">{item.helper}</div>
                    </div>
                  ))}
                </div>

                <div className="student-self-study-side-note">{editorSideNote}</div>

                <div className="student-self-study-side-glance-grid">
                  {editorQuickGlanceItems.map((item) => (
                    <div className="student-self-study-side-glance-card" key={item.id}>
                      <div className="workflow-summary-label">{item.label}</div>
                      <div className="student-self-study-glance-value">{item.value}</div>
                      <div className="student-self-study-glance-helper">{item.helper}</div>
                    </div>
                  ))}
                </div>

                <details className="workflow-collapsible student-self-study-advanced-panel">
                  <summary>
                    <span>{editorDisclosureLabel}</span>
                    <span className="chip">{editorDisclosureChip}</span>
                  </summary>
                  <div className="workflow-collapsible-body">
                    {editorPanel === 'flow' ? (
                      <div className="student-self-study-guidance-list student-self-study-flow-grid">
                        {activeConfig.learningSteps.map((step, index) => (
                          <div
                            className="workflow-step-line"
                            key={step}
                            style={{
                              border: `1px solid ${activeConfig.accent}`,
                              background: index === 0 ? activeConfig.gradient : undefined,
                            }}
                          >
                            <strong style={{ color: 'var(--ink-0)' }}>{`第 ${index + 1} 步`}</strong>
                            <div style={{ marginTop: 6 }}>{step}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <>
                        <div className="workflow-summary-grid">
                          <div className="workflow-summary-card">
                            <div className="workflow-summary-label">学习者</div>
                            <div className="workflow-summary-value student-self-study-summary-text">
                              {learnerName}
                            </div>
                            <div className="workflow-summary-helper">
                              {stageLabel} · {selectedSubjectLabel}
                            </div>
                          </div>
                          <div className="workflow-summary-card">
                            <div className="workflow-summary-label">课堂目标</div>
                            <div className="workflow-summary-value student-self-study-summary-text">
                              {currentGoalDisplay}
                            </div>
                            <div className="workflow-summary-helper">
                              如果没有手填目标，系统会按当前模式自动补全
                            </div>
                          </div>
                          <div className="workflow-summary-card">
                            <div className="workflow-summary-label">薄弱点</div>
                            <div className="workflow-summary-value student-self-study-summary-text">
                              {weakKnowledgePoint?.title ?? '暂无明显单点弱项'}
                            </div>
                            <div className="workflow-summary-helper">
                              {weakKnowledgePoint
                                ? `${SUBJECT_LABELS[weakKnowledgePoint.subject] ?? weakKnowledgePoint.subject} · 掌握度 ${weakKnowledgePoint.masteryScore}`
                                : '系统会先按学科和模式生成默认课堂'}
                            </div>
                          </div>
                          <div className="workflow-summary-card">
                            <div className="workflow-summary-label">课堂产出</div>
                            <div className="workflow-summary-value student-self-study-summary-text">
                              {activeConfig.deliverables.join(' / ')}
                            </div>
                            <div className="workflow-summary-helper">
                              含动漫数字老师、即时练习、总结与导出
                            </div>
                          </div>
                        </div>
                        {!weakKnowledgePoint ? (
                          <StatePanel
                            compact
                            tone="info"
                            title="当前没有明显薄弱点也可以直接开课"
                            description="这时更适合从预习、兴趣探索或课堂回看进入，系统会用主题和学习目标来搭建课堂。"
                          />
                        ) : null}
                        <div className="cta-row cta-row-tight" style={{ marginTop: 2 }}>
                          <Link className="button ghost" href="/student/profile">
                            调整个人画像
                          </Link>
                          <Link className="button ghost" href="/student/portrait">
                            查看学习画像
                          </Link>
                          <Link className="button ghost" href="/student/modules">
                            打开课程模块
                          </Link>
                        </div>
                      </>
                    )}
                  </div>
                </details>
              </div>
            </div>
          </div>
        </div>
      </details>

      <details className="workflow-collapsible" id="student-self-study-resources">
        <summary>
          <span>联动资源、班级任务与课后出口</span>
          <span className="chip">{mustDoCount ? `今日必做 ${mustDoCount}` : '按需展开'}</span>
        </summary>
        <div className="workflow-collapsible-body">
          <div className="workflow-spotlight-card">
            <div
              className="cta-row"
              style={{
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 10,
                flexWrap: 'wrap',
              }}
            >
              <div>
                <div className="section-title">{modeAssetHeadline}</div>
                <div className="meta-text" style={{ marginTop: 8, lineHeight: 1.7 }}>
                  {modeAssetDescription}
                </div>
              </div>
              <span className="pill">{buildLearningModeLabel(mode)}</span>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-2 student-self-study-resource-grid">
            {modeAssetCards.map((item) => (
              <div
                className="card student-self-study-resource-card"
                key={item.id}
                style={{ display: 'grid', gap: 12 }}
              >
                <div
                  className="cta-row"
                  style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}
                >
                  <div className="section-title">{item.title}</div>
                  <span className="pill">{item.badge}</span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--ink-1)', lineHeight: 1.8 }}>
                  {item.description}
                </div>
                <div className="cta-row cta-row-tight" style={{ flexWrap: 'wrap' }}>
                  <Link className="button secondary" href={item.href}>
                    {item.cta}
                  </Link>
                  {item.secondaryHref && item.secondaryLabel ? (
                    <Link className="button ghost" href={item.secondaryHref}>
                      {item.secondaryLabel}
                    </Link>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      </details>
    </WorkspacePage>
  );
}

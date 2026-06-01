'use client';

import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowUp,
  Check,
  ChevronDown,
  Clock,
  Copy,
  ImagePlus,
  Pencil,
  Trash2,
  Settings,
  Sun,
  Moon,
  Monitor,
  BotOff,
  ChevronUp,
} from 'lucide-react';
import { useI18n } from '@/lib/hooks/use-i18n';
import { detectPreferredLocale } from '@/lib/i18n';
import { createLogger } from '@/lib/logger';
import { SUBJECT_LABELS } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { ClassroomBrand } from '@/components/brand/classroom-brand';
import { Textarea as UITextarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { SettingsDialog } from '@/components/settings';
import { GenerationToolbar } from '@/components/generation/generation-toolbar';
import { AgentBar } from '@/components/agent/agent-bar';
import { useTheme } from '@/lib/hooks/use-theme';
import { nanoid } from 'nanoid';
import { storePdfBlob } from '@/lib/utils/image-storage';
import type { UserRequirements } from '@/lib/types/generation';
import { useSettingsStore } from '@/lib/store/settings';
import { useUserProfileStore, AVATAR_OPTIONS } from '@/lib/store/user-profile';
import {
  StageListItem,
  listStages,
  deleteStageData,
  getFirstSlideByStages,
} from '@/lib/utils/stage-storage';
import { ThumbnailSlide } from '@/components/slide-renderer/components/ThumbnailSlide';
import type { Slide } from '@/lib/types/slides';
import { useMediaGenerationStore } from '@/lib/store/media-generation';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useDraftCache } from '@/lib/hooks/use-draft-cache';
import { SpeechButton } from '@/components/audio/speech-button';
import {
  consumeAiClassroomLaunchPayload,
  type StudentSelfStudyMode,
} from '@/lib/integrations/ai-classroom-launch';
import { loadPdfBlob } from '@/lib/utils/image-storage';
import {
  buildStudentSelfStudyHref,
  loadRecentStudentSelfStudySession,
  resolveStudentSelfStudyFollowUpMode,
  saveRecentStudentSelfStudySession,
  type RecentStudentSelfStudySession,
} from '@/lib/student-self-study-recent';
import {
  buildAudienceModeLabel,
  buildExportFormatLabel,
  isExperienceModeClassroomContext,
  buildLearningModeLabel,
  PRODUCT_BRAND_NAME,
  type ClassroomContext,
} from '@/lib/classroom-integration';
import {
  classroomControlButton,
  classroomControlDivider,
  classroomControlToggle,
  classroomDropdownItem,
  classroomDropdownMenu,
  classroomHeroPanel,
  classroomInsetPanel,
  classroomOutlineButton,
  classroomPrimaryButton,
  classroomSectionPanel,
  classroomSoftButton,
  classroomSoftSurface,
  classroomToneCard,
  classroomToneIconBadge,
  classroomTonePill,
  classroomToolbarStrip,
  type ClassroomTone,
} from '@/lib/ui/classroom-theme';

const log = createLogger('Home');

const WEB_SEARCH_STORAGE_KEY = 'webSearchEnabled';
const LANGUAGE_STORAGE_KEY = 'generationLanguage';
const GENERATION_MODE_STORAGE_KEY = 'generationMode';
const RECENT_OPEN_STORAGE_KEY = 'recentClassroomsOpen';

function resolveStudentSelfStudyMode(
  classroomContext?: ClassroomContext | null,
): StudentSelfStudyMode | null {
  const mode = classroomContext?.learningMode;
  if (
    classroomContext?.source === 'student-self-study' &&
    (mode === 'preview-preparation' ||
      mode === 'subject-reinforcement' ||
      mode === 'interest-cultivation' ||
      mode === 'classroom-review')
  ) {
    return mode;
  }
  return null;
}

interface FormState {
  pdfFile: File | null;
  requirement: string;
  language: 'zh-CN' | 'en-US';
  generationMode: 'standard' | 'deep-interactive';
  webSearch: boolean;
}

type StudentSelfStudyActionCard = {
  id: string;
  title: string;
  description: string;
  href: string;
  cta: string;
  tone: ClassroomTone;
};

type StudentPromptPreset = {
  id: string;
  label: string;
  prompt: string;
};

type LaunchContextCard = {
  label: string;
  value: string;
  description?: string;
  tone: ClassroomTone;
};

const initialFormState: FormState = {
  pdfFile: null,
  requirement: '',
  language: 'zh-CN',
  generationMode: 'standard',
  webSearch: false,
};

function HomePage() {
  const { t, locale, setLocale } = useI18n();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const [form, setForm] = useState<FormState>(initialFormState);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<
    import('@/lib/types/settings').SettingsSection | undefined
  >(undefined);

  // Draft cache for requirement text
  const { cachedValue: cachedRequirement, updateCache: updateRequirementCache } =
    useDraftCache<string>({ key: 'requirementDraft' });

  // Model setup state
  const currentModelId = useSettingsStore((s) => s.modelId);
  const [storeHydrated, setStoreHydrated] = useState(false);
  const [recentOpen, setRecentOpen] = useState(true);
  const [launchSource, setLaunchSource] = useState<{
    label: string;
    summary?: string;
  } | null>(null);
  const [classroomContext, setClassroomContext] = useState<ClassroomContext | null>(null);
  const [recentStudentSession, setRecentStudentSession] =
    useState<RecentStudentSelfStudySession | null>(null);

  // Hydrate client-only state after mount (avoids SSR mismatch)
  /* eslint-disable react-hooks/set-state-in-effect -- Hydration from localStorage must happen in effect */
  useEffect(() => {
    setStoreHydrated(true);
    try {
      const saved = localStorage.getItem(RECENT_OPEN_STORAGE_KEY);
      if (saved !== null) setRecentOpen(saved !== 'false');
    } catch {
      /* localStorage unavailable */
    }
    setRecentStudentSession(loadRecentStudentSelfStudySession());
    try {
      const savedWebSearch = localStorage.getItem(WEB_SEARCH_STORAGE_KEY);
      const savedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY);
      const savedGenerationMode = localStorage.getItem(GENERATION_MODE_STORAGE_KEY);
      const updates: Partial<FormState> = {};
      if (savedWebSearch === 'true') updates.webSearch = true;
      if (savedLanguage === 'zh-CN' || savedLanguage === 'en-US') {
        updates.language = savedLanguage;
      } else {
        updates.language = detectPreferredLocale();
      }
      if (savedGenerationMode === 'standard' || savedGenerationMode === 'deep-interactive') {
        updates.generationMode = savedGenerationMode;
      }
      if (Object.keys(updates).length > 0) {
        setForm((prev) => ({ ...prev, ...updates }));
      }
    } catch {
      /* localStorage unavailable */
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!storeHydrated) return;

    let cancelled = false;

    const applyLaunchPayload = async () => {
      const payload = consumeAiClassroomLaunchPayload();
      if (!payload) return;

      if (payload.requirement) {
        setForm((prev) => ({
          ...prev,
          requirement: payload.requirement,
          language: payload.language ?? prev.language,
          webSearch: payload.webSearch ?? prev.webSearch,
        }));
        updateRequirementCache(payload.requirement);
      }

      if (!cancelled && payload.sourceLabel) {
        setLaunchSource({
          label: payload.sourceLabel,
          summary: payload.sourceSummary,
        });
      }

      if (!cancelled) {
        setClassroomContext(payload.classroomContext ?? null);
      }

      const studentMode = resolveStudentSelfStudyMode(payload.classroomContext ?? null);
      if (!cancelled && studentMode) {
        const persistedRecentSession = loadRecentStudentSelfStudySession();
        const nextRecentSession = saveRecentStudentSelfStudySession({
          mode: studentMode,
          subject: payload.classroomContext?.subject,
          topic:
            persistedRecentSession?.topic ||
            payload.classroomContext?.focusKnowledgePointTitle ||
            payload.classroomContext?.interestTopic,
          learnerGoal: payload.classroomContext?.learnerGoal || persistedRecentSession?.learnerGoal,
        });

        setRecentStudentSession(nextRecentSession);
      }

      if (!payload.pdfStorageKey) return;

      const blob = await loadPdfBlob(payload.pdfStorageKey);
      if (!blob || cancelled) return;

      const restoredFile = new File([blob], payload.pdfFileName || 'document.pdf', {
        type: blob.type || 'application/pdf',
      });

      if (!cancelled) {
        setForm((prev) => ({ ...prev, pdfFile: restoredFile }));
      }
    };

    void applyLaunchPayload();

    return () => {
      cancelled = true;
    };
  }, [storeHydrated, updateRequirementCache]);

  // Restore requirement draft from cache (derived state pattern — no effect needed)
  const [prevCachedRequirement, setPrevCachedRequirement] = useState(cachedRequirement);
  if (cachedRequirement !== prevCachedRequirement) {
    setPrevCachedRequirement(cachedRequirement);
    if (cachedRequirement) {
      setForm((prev) => ({ ...prev, requirement: cachedRequirement }));
    }
  }

  const needsSetup = storeHydrated && !currentModelId;
  const [languageOpen, setLanguageOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [classrooms, setClassrooms] = useState<StageListItem[]>([]);
  const [thumbnails, setThumbnails] = useState<Record<string, Slide>>({});
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    if (!languageOpen && !themeOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setLanguageOpen(false);
        setThemeOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [languageOpen, themeOpen]);

  const loadClassrooms = async () => {
    try {
      const list = await listStages();
      setClassrooms(list);
      // Load first slide thumbnails
      if (list.length > 0) {
        const slides = await getFirstSlideByStages(list.map((c) => c.id));
        setThumbnails(slides);
      }
    } catch (err) {
      log.error('Failed to load classrooms:', err);
    }
  };

  useEffect(() => {
    // Clear stale media store to prevent cross-course thumbnail contamination.
    // The store may hold tasks from a previously visited classroom whose elementIds
    // (gen_img_1, etc.) collide with other courses' placeholders.
    useMediaGenerationStore.getState().revokeObjectUrls();
    useMediaGenerationStore.setState({ tasks: {} });

    // eslint-disable-next-line react-hooks/set-state-in-effect -- Store hydration on mount
    loadClassrooms();
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-classroom-focus', 'true');

    return () => {
      root.removeAttribute('data-classroom-focus');
    };
  }, []);

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPendingDeleteId(id);
  };

  const confirmDelete = async (id: string) => {
    setPendingDeleteId(null);
    try {
      await deleteStageData(id);
      await loadClassrooms();
    } catch (err) {
      log.error('Failed to delete classroom:', err);
      toast.error('Failed to delete classroom');
    }
  };

  const updateForm = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    try {
      if (field === 'webSearch') localStorage.setItem(WEB_SEARCH_STORAGE_KEY, String(value));
      if (field === 'language') localStorage.setItem(LANGUAGE_STORAGE_KEY, String(value));
      if (field === 'generationMode') {
        localStorage.setItem(GENERATION_MODE_STORAGE_KEY, String(value));
      }
      if (field === 'requirement') updateRequirementCache(value as string);
    } catch {
      /* ignore */
    }
  };

  const showSetupToast = (icon: React.ReactNode, title: string, desc: string) => {
    toast.custom(
      (id) => (
        <div
          className="w-[356px] rounded-xl border border-amber-200/60 dark:border-amber-800/40 bg-gradient-to-r from-amber-50 via-white to-amber-50 dark:from-amber-950/60 dark:via-slate-900 dark:to-amber-950/60 shadow-lg shadow-amber-500/8 dark:shadow-amber-900/20 p-4 flex items-start gap-3 cursor-pointer"
          onClick={() => {
            toast.dismiss(id);
            setSettingsOpen(true);
          }}
        >
          <div className="shrink-0 mt-0.5 size-9 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center ring-1 ring-amber-200/50 dark:ring-amber-800/30">
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-200 leading-tight">
              {title}
            </p>
            <p className="text-xs text-amber-700/80 dark:text-amber-400/70 mt-0.5 leading-relaxed">
              {desc}
            </p>
          </div>
          <div className="shrink-0 mt-1 text-[10px] font-medium text-amber-500 dark:text-amber-500/70 tracking-wide">
            <Settings className="size-3.5 animate-[spin_3s_linear_infinite]" />
          </div>
        </div>
      ),
      { duration: 4000 },
    );
  };

  const handleGenerate = async () => {
    // Validate setup before proceeding
    if (!currentModelId) {
      showSetupToast(
        <BotOff className="size-4.5 text-amber-600 dark:text-amber-400" />,
        t('settings.modelNotConfigured'),
        t('settings.setupNeeded'),
      );
      setSettingsOpen(true);
      return;
    }

    if (!form.requirement.trim()) {
      setError(t('upload.requirementRequired'));
      return;
    }

    setError(null);

    try {
      const userProfile = useUserProfileStore.getState();
      const requirements: UserRequirements = {
        requirement: form.requirement,
        language: form.language,
        generationMode: form.generationMode,
        userNickname: userProfile.nickname || undefined,
        userBio: userProfile.bio || undefined,
        webSearch: form.webSearch || undefined,
      };

      let pdfStorageKey: string | undefined;
      let pdfFileName: string | undefined;
      let pdfProviderId: string | undefined;
      if (form.pdfFile) {
        pdfStorageKey = await storePdfBlob(form.pdfFile);
        pdfFileName = form.pdfFile.name;

        const settings = useSettingsStore.getState();
        pdfProviderId = settings.pdfProviderId;
      }

      const sessionState = {
        sessionId: nanoid(),
        requirements,
        pdfText: '',
        pdfImages: [],
        imageStorageIds: [],
        pdfStorageKey,
        pdfFileName,
        pdfProviderId,
        classroomContext,
        sceneOutlines: null,
        currentStep: 'generating' as const,
      };
      sessionStorage.setItem('generationSession', JSON.stringify(sessionState));

      router.push('/generation-preview');
    } catch (err) {
      log.error('Error preparing generation:', err);
      setError(err instanceof Error ? err.message : t('upload.generateFailed'));
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return t('classroom.today');
    if (diffDays === 1) return t('classroom.yesterday');
    if (diffDays < 7) return `${diffDays} ${t('classroom.daysAgo')}`;
    return date.toLocaleDateString();
  };

  const canGenerate = !!form.requirement.trim();
  const isStudentSelfStudy = classroomContext?.source === 'student-self-study';
  const isExperienceModeClassroom = isExperienceModeClassroomContext(classroomContext);
  const currentStudentMode = resolveStudentSelfStudyMode(classroomContext);
  const classroomModeLabel = classroomContext?.learningMode
    ? buildLearningModeLabel(classroomContext.learningMode)
    : null;
  const classroomSubjectLabel = classroomContext?.subject
    ? (SUBJECT_LABELS[classroomContext.subject] ?? classroomContext.subject)
    : null;
  const studentReturnHref =
    isStudentSelfStudy && recentStudentSession
      ? buildStudentSelfStudyHref({
          mode: recentStudentSession.mode,
          subject: recentStudentSession.subject,
          topic: recentStudentSession.topic,
          goal: recentStudentSession.learnerGoal,
        })
      : currentStudentMode
        ? buildStudentSelfStudyHref({
            mode: currentStudentMode,
            subject: classroomContext?.subject,
            goal: classroomContext?.learnerGoal,
          })
        : '/student/interactive-classroom';
  const studentModeSummary = isStudentSelfStudy
    ? isExperienceModeClassroom
      ? '本次仅展示示例课堂节奏；真实画像、任务、课表与个人进度登录后再同步。'
      : classroomContext?.learningMode === 'preview-preparation'
      ? '本次会先帮学生建立主线、提出问题，再进入正式学习。'
      : classroomContext?.learningMode === 'subject-reinforcement'
        ? '本次会优先围绕薄弱点做收口、讲后立练和错因纠偏。'
        : classroomContext?.learningMode === 'classroom-review'
          ? '本次会优先回收课堂重点、帮助复述主线并安排课后追练。'
          : '本次会优先用故事化与启发式方式带学生进入兴趣主题。'
    : null;
  const focusSummary =
    classroomContext?.focusKnowledgePointTitle ||
    classroomContext?.interestTopic ||
    classroomContext?.learnerGoal ||
    null;
  const heroAudienceSummary = isStudentSelfStudy
    ? isExperienceModeClassroom
      ? `给体验模式展示的一节${classroomModeLabel ?? '示例'}课`
      : `给${classroomContext?.learner?.name ?? '自己'}上的一节${classroomModeLabel ?? '自主学习'}课`
    : `给${classroomContext?.className ?? '当前班级'}上的一节${classroomModeLabel ?? '互动课堂'}`;
  const heroLearningSummary = isStudentSelfStudy
    ? isExperienceModeClassroom
      ? focusSummary
        ? `围绕${focusSummary}展示示例讲解、提问和练习节奏`
        : '围绕示例学习目标展示讲解、提问和练习节奏'
      : focusSummary
      ? `围绕${focusSummary}先讲清主线，再接一轮小练习或提问`
      : '围绕当前学习目标先讲清主线，再接一轮小练习或提问'
    : focusSummary
      ? `围绕${focusSummary}组织讲解节奏、互动提问和课堂重点`
      : `围绕${classroomSubjectLabel ?? '当前教材主题'}组织讲解节奏、互动提问和课堂重点`;
  const heroOutcomeSummary = isStudentSelfStudy
    ? isExperienceModeClassroom
      ? '体验结束后登录再接入真实任务、画像、课表和个人进度'
      : '学完回到作业、模块、错题本或成长档案继续收口'
    : '学完回到班级授课、课后追练、复习回看或校内分发继续推进';
  const classroomHeadline = isStudentSelfStudy
    ? isExperienceModeClassroom
      ? `体验一节${classroomModeLabel ?? '示例'}互动课堂，真实画像、任务和课表登录后再接入`
      : `为${classroomContext?.learner?.name ?? '你'}生成一节可独立使用的${classroomModeLabel ?? ''}互动课堂，学完继续回到真实学习任务`
    : '先讲清给谁上、学什么、学完去哪，让教材、班级与数字人老师进入同一课堂主线';
  const studentFollowUpMode = currentStudentMode
    ? resolveStudentSelfStudyFollowUpMode(currentStudentMode)
    : null;
  const studentFollowUpHref =
    studentFollowUpMode && isStudentSelfStudy
      ? buildStudentSelfStudyHref({
          mode: studentFollowUpMode,
          subject: classroomContext?.subject ?? recentStudentSession?.subject,
          topic:
            classroomContext?.focusKnowledgePointTitle ??
            classroomContext?.interestTopic ??
            recentStudentSession?.topic,
          goal: classroomContext?.learnerGoal ?? recentStudentSession?.learnerGoal,
        })
      : null;
  const studentWorkflowHeadline = isStudentSelfStudy
    ? currentStudentMode === 'preview-preparation'
      ? '先带着问题进入课堂，再把新课主线收回来'
      : currentStudentMode === 'subject-reinforcement'
        ? '先讲透薄弱点，再立刻接练习和作业验证'
        : currentStudentMode === 'classroom-review'
          ? '先回收课堂重点，再把理解转成复述和追练'
          : '先把兴趣主题学活，再沉淀成可以继续回看的成果'
    : null;
  const studentWorkflowSummary = isStudentSelfStudy
    ? isExperienceModeClassroom
      ? '当前仅展示示例课堂流程，不会读取或沉淀真实画像、今日任务、课表与个人进度；登录后再把生成结果接回真实学习链路。'
      : currentStudentMode === 'preview-preparation'
      ? '这节课最适合用来建立主线、记下问题，然后回到真实课堂、课程模块和课后回看继续推进。'
      : currentStudentMode === 'subject-reinforcement'
        ? '这节课最适合用来收口一个薄弱点。生成后要顺手接错题本、定向复练和当前作业，才会真正转化成稳定掌握。'
        : currentStudentMode === 'classroom-review'
          ? '这节课最适合在听完真实课堂后回收重点。生成后要去复述、追练，并把结果沉淀到成长档案里。'
          : '这节课最适合把兴趣和学习连接起来。生成后不要停在“挺有意思”，最好继续沉淀到成长档案或切到课堂回看。'
    : null;
  const contextPanelHeading = launchSource?.label
    ? launchSource.label
    : isStudentSelfStudy
      ? isExperienceModeClassroom
        ? '体验模式边界已带入'
        : '已带入当前学生学习链路'
      : '已带入当前教务与课堂链路';
  const contextPanelDescription = launchSource?.summary
    ? launchSource.summary
    : isStudentSelfStudy
      ? isExperienceModeClassroom
        ? '真实画像、任务、课表和个人进度尚未接入；本次只展示示例课堂生成与互动节奏。'
        : '学习目标、学科与课堂模式会在生成时一起带入，方便继续预习、巩固、回看或兴趣探索。'
      : '班级、主讲数字老师与分发方式会在生成时一起带入，方便直接进入真实教学链路。';
  const teacherContextName =
    classroomContext?.teacher?.digitalHuman?.displayName || classroomContext?.teacher?.name || null;
  const classroomRoleSummary = classroomContext
    ? isStudentSelfStudy
      ? classroomContext.learner?.name || '当前学习者待指定'
      : `${teacherContextName || '未指定主讲'} · ${classroomContext.students?.length ?? 0} 名学生`
    : null;
  const launchContextCards: LaunchContextCard[] = classroomContext
    ? [
        {
          label: '课堂模式',
          value: [buildAudienceModeLabel(classroomContext.audienceMode), classroomModeLabel]
            .filter(Boolean)
            .join(' · '),
          tone: 'emerald',
        },
        {
          label: '学段与学科',
          value: [
            classroomContext.grade ? `${classroomContext.grade} 年级` : null,
            classroomSubjectLabel,
          ]
            .filter(Boolean)
            .join(' · '),
          tone: 'slate',
        },
        classroomRoleSummary
          ? {
              label: isStudentSelfStudy ? '学习者' : '课堂角色',
              value: classroomRoleSummary,
              description: isStudentSelfStudy
                ? studentModeSummary || '会按当前学习目标进入课堂。'
                : '主讲、班级与学习角色会一并进入课堂。',
              tone: 'amber',
            }
          : null,
        focusSummary
          ? {
              label: isStudentSelfStudy ? '本次目标' : '课堂目标',
              value: focusSummary,
              description:
                classroomContext.learnerGoal && classroomContext.learnerGoal !== focusSummary
                  ? `学习目标：${classroomContext.learnerGoal}`
                  : undefined,
              tone: 'sky',
            }
          : null,
        classroomContext.teacher?.digitalHuman?.voiceLabel ||
        classroomContext.teacher?.digitalHuman?.portraitUrl ||
        classroomContext.exportFormats?.length
          ? {
              label: '数字老师与输出',
              value: [
                classroomContext.teacher?.digitalHuman?.displayName ||
                classroomContext.teacher?.digitalHuman?.voiceLabel
                  ? `主讲 ${
                      classroomContext.teacher?.digitalHuman?.displayName ||
                      classroomContext.teacher?.digitalHuman?.voiceLabel
                    }`
                  : null,
                classroomContext.exportFormats?.length
                  ? classroomContext.exportFormats
                      .map((format) => buildExportFormatLabel(format))
                      .join(' / ')
                  : null,
              ]
                .filter(Boolean)
                .join(' · '),
              description: classroomContext.teacher?.digitalHuman?.portraitUrl
                ? '人物画像与音色已就绪，可直接用于课堂主讲。'
                : '导出与分享能力会跟课堂一起生成。',
              tone: 'slate',
            }
          : null,
      ].filter((item): item is LaunchContextCard => Boolean(item))
    : [];
  const quickStartGuidance = isStudentSelfStudy
    ? isExperienceModeClassroom
      ? [
          '先确认这是体验模式示例课堂，只展示生成与互动节奏。',
          '进入课堂后可以查看示例讲解、提问和练习如何组织。',
          '体验结束后可登录同步真实画像、任务、课表和个人进度。',
        ]
      : [
          '先确认这节课是给谁学、围绕什么目标学，再直接进入课堂。',
          '进入课堂后先收主线，再顺手留一道练习、提问或复述任务。',
          '学完回到作业、模块、错题本或成长档案继续收口；导出和分享放在需要时再用。',
        ]
    : [
        '先写清这节课给哪个班上、围绕哪条教材主线展开。',
        '课堂会把教师身份、讲解节奏和班级情境一起带入，方便直接开讲。',
        '学完优先回到班级授课、课后追练和复习回看；导出与分享作为辅助交付。',
      ];
  const heroHighlights = isStudentSelfStudy
    ? isExperienceModeClassroom
      ? [
          {
            title: '体验模式',
            description: '只展示示例课堂生成与互动节奏。',
          },
          {
            title: '边界清楚',
            description: '不会读取或沉淀真实画像、任务、课表和个人进度。',
          },
          {
            title: '登录接入',
            description: '登录后再同步真实学习数据并进入个人学习链路。',
          },
        ]
      : [
          {
            title: '学生自学',
            description: '预习、巩固、兴趣探索、课堂回看可以按目标一键切换。',
          },
          {
            title: '主线讲解',
            description: '学生可独立发起，也能沿着真实老师节奏进入同一课堂主线。',
          },
          {
            title: '课后收口',
            description: '支持个人观看、整班展示与导出沉淀，方便持续追踪学习结果。',
          },
        ]
    : [
        {
          title: '班级课堂',
          description: '授课教师、班级学生、课程上下文与课堂入口原生兼容。',
        },
        {
          title: '教材主线',
          description: '教师可配置专属画像、声音和讲解风格，形成稳定的课堂身份。',
        },
        {
          title: '课后去向',
          description: '生成后可以工作区播放、全班观看、回看与导出，适配真实教学链路。',
        },
      ];
  const heroEntryCards: LaunchContextCard[] = isStudentSelfStudy
    ? isExperienceModeClassroom
      ? [
          {
            label: '给谁看',
            value: heroAudienceSummary,
            description: '当前面向未登录体验，课堂内容按示例流程展示。',
            tone: 'sky',
          },
          {
            label: '看什么',
            value: heroLearningSummary,
            description: '先看示例主线，再观察提问、例题和练习如何接上。',
            tone: 'emerald',
          },
          {
            label: '体验后去哪',
            value: heroOutcomeSummary,
            description: '体验页只负责展示流程；真实学习数据登录后再同步。',
            tone: 'amber',
          },
        ]
      : [
          {
            label: '给谁上',
            value: heroAudienceSummary,
            description: '学生可以独立发起，也能沿老师节奏进入同一节课堂主线。',
            tone: 'sky',
          },
          {
            label: '学什么',
            value: heroLearningSummary,
            description: '先讲清主线，再把提问、例题和练习顺手接上。',
            tone: 'emerald',
          },
          {
            label: '学完去哪',
            value: heroOutcomeSummary,
            description: '互动课堂不会停在“看完”，还能衔接作业、模块、错题本和成长档案。',
            tone: 'amber',
          },
        ]
    : [
        {
          label: '给谁上',
          value: heroAudienceSummary,
          description: '不用反复录入教学背景，启动时就已经接入真实教务上下文。',
          tone: 'sky',
        },
        {
          label: '学什么',
          value: heroLearningSummary,
          description: '先把教材主线、互动提问和课堂重点讲清，再决定是否补充数字人表达。',
          tone: 'emerald',
        },
        {
          label: '学完去哪',
          value: heroOutcomeSummary,
          description: '适合公开课、复习课、班会课和学校统一分发的真实教学场景。',
          tone: 'amber',
        },
      ];
  const heroContextPreviewCards = launchContextCards.slice(0, 2);
  const heroOverviewCards: LaunchContextCard[] = heroContextPreviewCards.length
    ? heroContextPreviewCards
    : isStudentSelfStudy
      ? [
          {
            label: '使用方式',
            value: '学生可以直接发起，也能沿老师节奏继续学习',
            description: '先确定目标，再让课堂主线、练习和回看方式自动接上。',
            tone: 'sky',
          },
          {
            label: '适用场景',
            value: '预习、巩固、兴趣探索和课堂回看都能从这里进入',
            description: '同一个入口支持多种学习场景，不需要分散跳到不同工具页。',
            tone: 'amber',
          },
        ]
      : [
          {
            label: '课堂入口',
            value: '从教材主题出发，直接进入一节可播放的互动课堂',
            description: '先确定主题，再把主讲数字人、课堂脚本和播放方式一起整理好。',
            tone: 'sky',
          },
          {
            label: '适用场景',
            value: '适合公开课、常规授课、复习课和校内统一分发',
            description: '这不是一次性的生成工具，而是可以落到真实教学链路中的课堂工作区。',
            tone: 'amber',
          },
        ];
  const launchDeliverables: LaunchContextCard[] = isStudentSelfStudy
    ? isExperienceModeClassroom
      ? [
          {
            label: '体验对象',
            value: '会标注体验模式示例课堂',
            description: '页面会持续提示真实画像、任务、课表和个人进度尚未接入。',
            tone: 'sky',
          },
          {
            label: '示例内容',
            value: '会整理示例主题的讲解顺序',
            description: '把主题、例子和互动节奏串成一条便于理解的示例主线。',
            tone: 'emerald',
          },
          {
            label: '下一步',
            value: '体验后引导登录或继续切换示例模式',
            description: '不会把示例结果写入真实个人数据，也不会冒充已同步的学习记录。',
            tone: 'amber',
          },
        ]
      : [
          {
            label: '给谁上',
            value: '会锁定当前学习者、模式和课堂目标',
            description: '把学习对象、进入方式和课堂语气先对齐，避免生成后再返工。',
            tone: 'sky',
          },
          {
            label: '学什么',
            value: '会先整理适合当前目标的讲解顺序',
            description: '把知识点、例子和互动节奏串成一条容易跟住的学习主线。',
            tone: 'emerald',
          },
          {
            label: '学完去哪',
            value: '完成后会直接接到练习、回看和成长沉淀',
            description: '让这节课自然衔接到后续复习、展示和个人学习档案。',
            tone: 'amber',
          },
        ]
    : [
        {
          label: '给谁上',
          value: '会带入当前班级、教师身份和课堂对象',
          description: '让授课对象与课堂语境先对齐，再决定具体的讲法与呈现。',
          tone: 'sky',
        },
        {
          label: '学什么',
          value: '会先整理教材主题、节奏和课堂目标',
          description: '把真实教学目标压缩成一节结构清晰、可直接开讲的课堂脚本。',
          tone: 'emerald',
        },
        {
          label: '学完去哪',
          value: '会把整班播放、回看和课后收口一起准备好',
          description: '适合整班观看、校内分发以及后续复用，不会停在单次试用。',
          tone: 'amber',
        },
      ];
  const workspaceLinks: Array<{
    href: string;
    label: string;
    tone: ClassroomTone;
    primary?: boolean;
  }> = isStudentSelfStudy
    ? isExperienceModeClassroom
      ? [
          {
            href: studentReturnHref,
            label: '返回体验启动页',
            tone: 'sky',
            primary: true,
          },
          {
            href: '/login',
            label: '登录同步个人进度',
            tone: 'emerald',
          },
          {
            href: '/student/interactive-classroom?mode=preview-preparation',
            label: '继续体验另一种模式',
            tone: 'amber',
          },
        ]
      : [
          {
            href: studentReturnHref,
            label: '返回学生启动页',
            tone: 'sky',
            primary: true,
          },
          {
            href: '/student/portrait',
            label: '查看学习画像',
            tone: 'sky',
          },
          {
            href: '/student',
            label: '返回学习控制台',
            tone: 'amber',
          },
        ]
    : [
        {
          href: '/teacher/ai-tools',
          label: '返回教师 AI 工具',
          tone: 'sky',
          primary: true,
        },
        {
          href: '/library',
          label: '从教材课件继续',
          tone: 'sky',
        },
        {
          href: '/teacher',
          label: '查看教务工作台',
          tone: 'amber',
        },
      ];
  const studentActionCards: StudentSelfStudyActionCard[] = isStudentSelfStudy
    ? isExperienceModeClassroom
      ? [
          {
            id: 'experience-return',
            title: '返回体验启动页继续调整',
            description: '可以更换示例主题、学科或课堂模式；页面仍会标注这是未登录体验流程。',
            href: studentReturnHref,
            cta: '返回体验启动页',
            tone: 'sky',
          },
          {
            id: 'experience-login',
            title: '登录后接入真实学习数据',
            description: '登录后再同步个人画像、今日任务、课表和进度，让课堂进入你的真实学习链路。',
            href: '/login',
            cta: '登录同步个人进度',
            tone: 'emerald',
          },
          {
            id: 'experience-switch',
            title: '换一种模式继续体验',
            description: '试试预习、巩固或课堂回看示例，比较不同学习场景下的课堂组织方式。',
            href: '/student/interactive-classroom?mode=preview-preparation',
            cta: '继续体验',
            tone: 'amber',
          },
        ]
      : currentStudentMode === 'preview-preparation'
      ? [
          {
            id: 'preview-workbench',
            title: '回到学生启动页继续定制',
            description:
              '随时回到学生工作台调整主题、学科和目标，把预习起点继续打磨得更贴近真实课堂。',
            href: studentReturnHref,
            cta: '返回学生启动页',
            tone: 'sky',
          },
          {
            id: 'preview-modules',
            title: '先去课程模块找主线',
            description:
              '如果你想让这节预习更贴近班级进度，先看课程模块会更容易锁定当前单元和老师节奏。',
            href: '/student/modules',
            cta: '查看课程模块',
            tone: 'emerald',
          },
          {
            id: 'preview-follow-up',
            title: '预习后切到课堂回看',
            description:
              '等上完正式课堂后，建议用课堂回看模式把主线重新压缩一遍，形成自己的复盘闭环。',
            href: studentFollowUpHref ?? '/student/interactive-classroom?mode=classroom-review',
            cta: `切到${buildLearningModeLabel(studentFollowUpMode ?? 'classroom-review')}`,
            tone: 'amber',
          },
        ]
      : currentStudentMode === 'subject-reinforcement'
        ? [
            {
              id: 'reinforcement-wrong-book',
              title: '马上回到错题本做收口',
              description:
                '先把这节巩固课对应的错因重新捞出来，再回看讲解，你会更容易发现自己真正卡住的地方。',
              href: '/wrong-book',
              cta: '进入错题本',
              tone: 'amber',
            },
            {
              id: 'reinforcement-practice',
              title: '讲完立刻接一轮复练',
              description:
                '最怕只听不练。把讲解后的理解立刻接到复练里，才能把“听懂了”变成“会做题”。',
              href: '/practice?mode=review',
              cta: '开始定向复练',
              tone: 'sky',
            },
            {
              id: 'reinforcement-follow-up',
              title: '巩固后切到课堂回看',
              description:
                '如果这轮收口已经讲顺，下一步可以切到课堂回看模式，把这次理解重新压缩成可复述的知识主线。',
              href: studentFollowUpHref ?? '/student/interactive-classroom?mode=classroom-review',
              cta: `切到${buildLearningModeLabel(studentFollowUpMode ?? 'classroom-review')}`,
              tone: 'emerald',
            },
          ]
        : currentStudentMode === 'classroom-review'
          ? [
              {
                id: 'review-assignments',
                title: '回到作业中心做验证',
                description: '回看课堂真正完成的标志，不是重新听懂，而是能回到作业里稳定做出来。',
                href: '/student/assignments',
                cta: '进入作业中心',
                tone: 'amber',
              },
              {
                id: 'review-growth',
                title: '把这次回看沉淀到成长档案',
                description:
                  '回看后最值得做的是去成长档案观察轨迹，把“今天会了什么”变成可持续积累的证据。',
                href: '/student/growth',
                cta: '打开成长档案',
                tone: 'emerald',
              },
              {
                id: 'review-follow-up',
                title: '回看后切到学科巩固',
                description:
                  '如果回看已经捋顺了主线，下一步适合重新切回学科巩固，用一轮讲解加练习把薄弱点真正做稳。',
                href:
                  studentFollowUpHref ??
                  '/student/interactive-classroom?mode=subject-reinforcement',
                cta: `切到${buildLearningModeLabel(studentFollowUpMode ?? 'subject-reinforcement')}`,
                tone: 'sky',
              },
            ]
          : [
              {
                id: 'interest-growth',
                title: '把兴趣主题沉淀进成长档案',
                description:
                  '别让一次探索停在“有意思”。把这节课后的收获回收到成长档案，才能形成长期学习资产。',
                href: '/student/growth',
                cta: '打开成长档案',
                tone: 'emerald',
              },
              {
                id: 'interest-favorites',
                title: '把启发点留进收藏夹',
                description:
                  '如果这次探索里遇到想反复回看的问题、题型或线索，可以继续沉淀到个人收藏夹。',
                href: '/student/favorites',
                cta: '查看收藏夹',
                tone: 'amber',
              },
              {
                id: 'interest-follow-up',
                title: '探索后切到课堂回看',
                description:
                  '兴趣主题讲活以后，建议切到课堂回看模式，把内容重新压缩成可复述、可分享的成果。',
                href: studentFollowUpHref ?? '/student/interactive-classroom?mode=classroom-review',
                cta: `切到${buildLearningModeLabel(studentFollowUpMode ?? 'classroom-review')}`,
                tone: 'sky',
              },
            ]
    : [];
  const studentPromptPresets: StudentPromptPreset[] = isStudentSelfStudy
    ? currentStudentMode === 'preview-preparation'
      ? [
          {
            id: 'preview-mainline',
            label: '先梳理主线',
            prompt: `请围绕${classroomSubjectLabel ?? '当前学科'}${classroomContext?.focusKnowledgePointTitle ? `的${classroomContext.focusKnowledgePointTitle}` : ''}生成一节课前预习课堂，先激活旧知，再梳理这节新课主线，并帮我提出 3 个带进正式课堂的问题。`,
          },
          {
            id: 'preview-check',
            label: '加一轮预习检测',
            prompt: `请把这节${classroomModeLabel ?? '预习'}课堂做成“主线梳理 + 问题清单 + 4 道小检测”的结构，让我能在正式上课前快速判断自己哪里还没看懂。`,
          },
          {
            id: 'preview-classroom',
            label: '贴近老师节奏',
            prompt: `请按真实老师上课节奏设计这节${classroomModeLabel ?? '预习'}课堂，用简洁讲解带我先进入主题，再告诉我听课时最该注意的知识点和易错处。`,
          },
        ]
      : currentStudentMode === 'subject-reinforcement'
        ? [
            {
              id: 'reinforcement-weak-point',
              label: '围绕薄弱点收口',
              prompt: `请围绕${classroomContext?.focusKnowledgePointTitle || classroomSubjectLabel || '当前薄弱点'}生成一节学科巩固课堂，先讲清楚我为什么会错，再用例题拆解和即时练习帮助我把这类题做稳。`,
            },
            {
              id: 'reinforcement-practice',
              label: '讲完马上跟练',
              prompt: `请给我一节“讲解后立刻跟练”的${classroomModeLabel ?? '学科巩固'}课堂，每讲完一个关键步骤就出 1 到 2 道小题，让我边学边验证。`,
            },
            {
              id: 'reinforcement-assignment',
              label: '贴合作业验证',
              prompt: `请把这节${classroomModeLabel ?? '巩固'}课堂做得更贴近我的实际作业场景，重点帮助我把听懂的知识点迁移到作业题和同类题上。`,
            },
          ]
        : currentStudentMode === 'classroom-review'
          ? [
              {
                id: 'review-retell',
                label: '先练复述主线',
                prompt: `请围绕${classroomContext?.focusKnowledgePointTitle || classroomSubjectLabel || '今天课堂重点'}生成一节课堂回看课，重点帮我把老师讲过的主线重新压缩成我能自己复述的版本。`,
              },
              {
                id: 'review-mistakes',
                label: '重点盯易错点',
                prompt: `请把这节${classroomModeLabel ?? '课堂回看'}课堂聚焦在“我听过但还不会做”的地方，帮我梳理易错点、边界条件和常见误区。`,
              },
              {
                id: 'review-drill',
                label: '回看后接追练',
                prompt: `请把这节${classroomModeLabel ?? '课堂回看'}课堂设计成“主线回收 + 重点复述 + 一轮追练”的结构，让我听完就能马上验证自己是否真的掌握。`,
              },
            ]
          : [
              {
                id: 'interest-story',
                label: '故事化导入',
                prompt: `请围绕${classroomContext?.interestTopic || classroomSubjectLabel || '这个主题'}生成一节兴趣探索课堂，用故事化导入和启发式提问让我先产生好奇心，再逐步讲透。`,
              },
              {
                id: 'interest-cross',
                label: '做跨学科联想',
                prompt: `请把${classroomContext?.interestTopic || '这个兴趣主题'}讲成一节有跨学科联想的探索课堂，帮助我把它和${classroomSubjectLabel || '已有学科知识'}连接起来。`,
              },
              {
                id: 'interest-project',
                label: '留一个输出任务',
                prompt: `请给这节${classroomModeLabel ?? '兴趣探索'}课堂加入一个轻量输出任务，让我学完后能带着问题、作品或观察结果继续下一次探索。`,
              },
            ]
    : [];
  const composerPlaceholder = isStudentSelfStudy
    ? `例如：围绕${classroomContext?.focusKnowledgePointTitle || classroomSubjectLabel || '当前主题'}生成一节${classroomModeLabel || '自主学习'}课堂，先讲清主线，再带我做一轮小练习。`
    : `例如：围绕${classroomSubjectLabel || '当前教材主题'}设计一节 30 分钟互动课堂，适合${classroomContext?.className || '当前班级'}全班观看，并保留导出与回看能力。`;
  const composerLabel = isStudentSelfStudy ? '学习目标' : '课堂目标';
  const composerAssistText = isStudentSelfStudy
    ? '一句话写清给谁学、学什么、学完准备去哪'
    : '一句话写清给哪个班上、讲什么、课后接什么';
  const composerMetaPills = [
    classroomModeLabel || null,
    classroomSubjectLabel || null,
    form.pdfFile ? '已附教材 PDF' : null,
    form.webSearch ? '联网补充背景' : null,
  ].filter(Boolean) as string[];

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      if (canGenerate) handleGenerate();
    }
  };

  const applyStudentPromptPreset = (prompt: string) => {
    updateForm('requirement', prompt);
    setError(null);
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      const nextLength = prompt.length;
      textareaRef.current?.setSelectionRange(nextLength, nextLength);
    });
  };

  return (
    <div className="classroom-page-shell relative flex w-full flex-col overflow-x-hidden px-4 pb-6 pt-6 md:px-6 md:pb-6 md:pt-7 lg:px-8">
      <SettingsDialog
        open={settingsOpen}
        onOpenChange={(open) => {
          setSettingsOpen(open);
          if (!open) setSettingsSection(undefined);
        }}
        initialSection={settingsSection}
      />

      {/* ═══ Background Decor ═══ */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute left-[10%] top-14 h-48 w-48 rounded-full bg-sky-200/14 blur-3xl" />
        <div className="absolute bottom-10 right-[12%] h-56 w-56 rounded-full bg-amber-200/14 blur-3xl" />
        <div className="absolute inset-x-[12%] top-0 h-px bg-white/70" />
      </div>

      {/* ═══ Hero section: compact start zone ═══ */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className={cn(
          'relative z-20 mx-auto flex w-full max-w-6xl flex-col gap-4',
          classrooms.length === 0
            ? 'justify-start pt-[clamp(6px,1.6vh,18px)] pb-2'
            : 'pt-[clamp(4px,1vh,12px)]',
        )}
      >
        <div className="flex flex-col gap-3">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.08, duration: 0.45 }}
            className={cn(
              classroomHeroPanel,
              'flex w-full flex-col px-5 py-4 text-left md:px-6 md:py-5',
            )}
          >
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,360px)] lg:items-start">
              <div className="min-w-0 lg:pr-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={classroomTonePill('sky', 'font-medium')}>
                    航科互动课堂工作区
                  </span>
                  {classroomModeLabel ? (
                    <span className={classroomTonePill('emerald', 'font-medium')}>
                      {classroomModeLabel}
                    </span>
                  ) : null}
                  {classroomSubjectLabel ? (
                    <span className={classroomTonePill('amber', 'font-medium')}>
                      {classroomSubjectLabel}
                    </span>
                  ) : null}
                </div>
                <ClassroomBrand size="md" showTagline={false} className="mt-4 max-w-fit" />
                <h1
                  className="mt-4 max-w-[15ch] text-balance text-[clamp(1.62rem,2.65vw,2.18rem)] font-semibold leading-[1.08] tracking-tight text-slate-900 dark:text-slate-100"
                  data-testid="ai-classroom-headline"
                >
                  {classroomHeadline}
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300/85 md:text-[14px]">
                  {isStudentSelfStudy
                    ? isExperienceModeClassroom
                      ? '先说明这是示例体验、围绕什么主题展示、登录后再接入哪些真实学习数据，再开始生成。'
                      : '先说明这节课给谁学、围绕什么目标学、学完回到哪条真实学习链路，再开始生成。'
                    : '先说明这节课给哪个班上、围绕哪条教材主线展开、课后要回到哪里继续推进，再开始生成。'}
                </p>

                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {heroEntryCards.map((item) => (
                    <div
                      key={`${item.label}-${item.value}`}
                      className={cn(
                        classroomToneCard(item.tone),
                        'min-h-[118px] px-4 py-3.5 shadow-[0_12px_28px_rgba(73,122,189,0.045)]',
                      )}
                    >
                      <div className="text-[11px] font-semibold tracking-[0.12em] text-slate-500 dark:text-slate-400">
                        {item.label}
                      </div>
                      <div className="mt-2 text-[14px] font-semibold leading-6 text-slate-900 dark:text-slate-100">
                        {item.value}
                      </div>
                      {item.description ? (
                        <div className="mt-1.5 text-[12px] leading-5 text-slate-600 dark:text-slate-300/88">
                          {item.description}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {heroHighlights.map((item) => (
                    <span key={item.title} className={classroomTonePill('slate', 'font-medium')}>
                      {item.title}
                    </span>
                  ))}
                </div>
              </div>

              <div className={cn(classroomInsetPanel, 'px-3.5 py-3.5 lg:mt-1')}>
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-semibold tracking-[0.12em] text-slate-500 dark:text-slate-400">
                        课堂环境
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span
                          className={classroomTonePill(needsSetup ? 'amber' : 'sky', 'font-medium')}
                        >
                          {needsSetup ? '还需补齐配置' : '课堂环境已就绪'}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {needsSetup
                            ? '优先从后台统一补齐模型与媒体服务。'
                            : '直接整理教材、课堂目标和数字人设定即可开课。'}
                        </span>
                      </div>
                      <div className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                        开课前只保留环境确认和教学主线，让首屏先回答“给谁上、学什么、学完去哪”。
                      </div>
                    </div>

                    <div
                      ref={toolbarRef}
                      className={cn(classroomToolbarStrip, 'max-w-full justify-end self-start')}
                    >
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => {
                            setLanguageOpen(!languageOpen);
                            setThemeOpen(false);
                          }}
                          aria-label="切换课堂生成语言"
                          aria-expanded={languageOpen}
                          className={classroomControlToggle}
                        >
                          {locale === 'zh-CN' ? 'CN' : 'EN'}
                        </button>
                        {languageOpen && (
                          <div className={cn(classroomDropdownMenu, 'min-w-[120px]')}>
                            <button
                              type="button"
                              onClick={() => {
                                setLocale('zh-CN');
                                setLanguageOpen(false);
                              }}
                              className={classroomDropdownItem(locale === 'zh-CN')}
                            >
                              简体中文
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setLocale('en-US');
                                setLanguageOpen(false);
                              }}
                              className={classroomDropdownItem(locale === 'en-US')}
                            >
                              English
                            </button>
                          </div>
                        )}
                      </div>

                      <div className={classroomControlDivider} />

                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => {
                            setThemeOpen(!themeOpen);
                            setLanguageOpen(false);
                          }}
                          aria-label="切换课堂外观模式"
                          aria-expanded={themeOpen}
                          className={classroomControlButton}
                        >
                          {theme === 'light' && <Sun className="w-4 h-4" />}
                          {theme === 'dark' && <Moon className="w-4 h-4" />}
                          {theme === 'system' && <Monitor className="w-4 h-4" />}
                        </button>
                        {themeOpen && (
                          <div className={cn(classroomDropdownMenu, 'min-w-[140px]')}>
                            <button
                              type="button"
                              onClick={() => {
                                setTheme('light');
                                setThemeOpen(false);
                              }}
                              className={classroomDropdownItem(theme === 'light')}
                            >
                              <Sun className="w-4 h-4" />
                              {t('settings.themeOptions.light')}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setTheme('dark');
                                setThemeOpen(false);
                              }}
                              className={classroomDropdownItem(theme === 'dark')}
                            >
                              <Moon className="w-4 h-4" />
                              {t('settings.themeOptions.dark')}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setTheme('system');
                                setThemeOpen(false);
                              }}
                              className={classroomDropdownItem(theme === 'system')}
                            >
                              <Monitor className="w-4 h-4" />
                              {t('settings.themeOptions.system')}
                            </button>
                          </div>
                        )}
                      </div>

                      <div className={classroomControlDivider} />

                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setSettingsOpen(true)}
                          aria-label="打开课堂设置"
                          className={cn(
                            classroomControlButton,
                            needsSetup &&
                              'border border-sky-200/80 bg-sky-50/90 text-sky-700 shadow-sm dark:border-sky-800/70 dark:bg-sky-950/36 dark:text-sky-200',
                          )}
                        >
                          <Settings className="w-4 h-4 transition-transform duration-500 group-hover:rotate-90" />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                    {heroOverviewCards.map((item) => (
                      <div
                        key={`hero-${item.label}-${item.value}`}
                        className={cn(classroomToneCard(item.tone), 'min-h-[96px] px-3 py-3')}
                      >
                        <div className="text-[11px] font-semibold tracking-[0.12em] text-slate-500 dark:text-slate-400">
                          {item.label}
                        </div>
                        <div className="mt-1 text-[13px] font-semibold leading-5 text-slate-900 dark:text-slate-100">
                          {item.value}
                        </div>
                        {item.description ? (
                          <div className="mt-1 text-[12px] leading-5 text-slate-500 dark:text-slate-400">
                            {item.description}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>

                  <details className="classroom-launch-context-details mt-0 border-t-0 pt-0">
                    <summary>
                      <div>
                        <div className="text-[11px] font-semibold tracking-[0.12em] text-slate-500 dark:text-slate-400">
                          {isStudentSelfStudy ? '开始这节课' : '开始这节课堂'}
                        </div>
                        <div className="mt-1 text-[15px] font-semibold text-slate-900 dark:text-slate-100">
                          默认只展开教学主线必需信息
                        </div>
                      </div>
                      <span className={classroomTonePill('sky', 'font-medium')}>
                        {`共 ${quickStartGuidance.length} 步`}
                      </span>
                    </summary>
                    <div className="classroom-launch-guidance-list">
                      {quickStartGuidance.map((item, index) => (
                        <div
                          key={item}
                          className={cn(classroomInsetPanel, 'flex items-start gap-3 px-3 py-2.5')}
                        >
                          <span className={classroomToneIconBadge('sky')}>{index + 1}</span>
                          <span className="text-[13px] leading-5 text-slate-600 dark:text-slate-300">
                            {item}
                          </span>
                        </div>
                      ))}
                    </div>
                  </details>
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
              <div className={cn(classroomInsetPanel, 'px-3.5 py-3')}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-semibold tracking-[0.12em] text-slate-500 dark:text-slate-400">
                      课堂启动后会自动整理
                    </div>
                    <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                      你得到的是一条能接回真实教学的课堂主线
                    </div>
                  </div>
                  <span className={classroomTonePill('slate', 'font-medium')}>
                    {`${launchDeliverables.length} 项结果`}
                  </span>
                </div>
                <div className="classroom-launch-hero-highlights classroom-launch-hero-highlights--compact mt-3">
                  {launchDeliverables.map((item) => (
                    <div
                      key={item.label}
                      className={cn(
                        classroomInsetPanel,
                        'classroom-launch-hero-highlight classroom-launch-hero-highlight--compact px-3.5 py-3',
                      )}
                    >
                      <div className="text-[11px] font-semibold tracking-[0.12em] text-sky-700/80 dark:text-sky-300/85">
                        {item.label}
                      </div>
                      <div className="mt-1.5 text-[13px] leading-5 text-slate-600 dark:text-slate-300/90">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">
                          {item.value}
                        </div>
                        <div className="mt-1">{item.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div
                className={cn(classroomInsetPanel, 'px-3.5 py-3')}
                data-testid="ai-classroom-workspace-links"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div
                      className="text-[11px] font-semibold tracking-[0.12em] text-slate-500 dark:text-slate-400"
                      data-testid="ai-classroom-workspace-links-heading"
                    >
                      切换到其他工作区
                    </div>
                    <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                      从当前课堂入口快速返回你的主工作流
                    </div>
                  </div>
                  <span className={classroomTonePill('slate', 'font-medium')}>
                    {`${workspaceLinks.length} 条路径`}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2.5">
                  {workspaceLinks.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={
                        item.primary ? classroomPrimaryButton : classroomOutlineButton(item.tone)
                      }
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* ── Unified input area ── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.35 }}
          className="w-full self-center max-w-[1120px]"
        >
          <div
            className={cn(
              classroomSectionPanel,
              'w-full rounded-[30px] border-border/60 px-0 py-0 shadow-xl shadow-black/[0.03] transition-shadow focus-within:shadow-2xl focus-within:shadow-sky-500/[0.06] dark:shadow-black/20',
            )}
          >
            {/* ── Greeting + Profile + Agents ── */}
            <div className="classroom-launch-input-topbar relative z-20 flex flex-col gap-1.5 lg:flex-row lg:items-center lg:justify-between">
              <GreetingBar />
              <div className="px-4 pb-0.5 lg:shrink-0 lg:px-0 lg:pr-3 lg:pt-1.5">
                <AgentBar compact />
              </div>
            </div>

            {/* Textarea */}
            {studentPromptPresets.length ? (
              <details
                className={cn(
                  classroomInsetPanel,
                  'classroom-launch-panel-disclosure classroom-launch-presets-disclosure mx-4 mt-2.5 px-3 py-2.5',
                )}
              >
                <summary>
                  <div>
                    <div className="text-[11px] font-semibold tracking-[0.12em] text-slate-500 dark:text-slate-400">
                      一键套用课堂需求
                    </div>
                    <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                      想换一种讲法，再展开选模板
                    </div>
                  </div>
                  <span className={classroomTonePill('slate', 'font-medium')}>
                    {`${studentPromptPresets.length} 个模板`}
                  </span>
                </summary>
                <div className="classroom-launch-presets-list">
                  {studentPromptPresets.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => applyStudentPromptPreset(preset.prompt)}
                      className={classroomSoftButton('sky')}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </details>
            ) : null}

            <div
              className={cn(
                classroomInsetPanel,
                'mx-4 mt-2.5 overflow-hidden border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.992),rgba(249,252,255,0.97))] px-0 py-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)]',
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3">
                <div className="min-w-0">
                    <div className="text-[11px] font-semibold tracking-[0.12em] text-slate-500 dark:text-slate-400">
                      {composerLabel}
                    </div>
                    <div className="mt-0.5 text-[12px] leading-5 text-slate-500 dark:text-slate-400">
                      {composerAssistText}
                    </div>
                  </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {composerMetaPills.map((item) => (
                    <span
                      key={item}
                      className={classroomTonePill('slate', 'px-2 py-0.5 text-[10px]')}
                    >
                      {item}
                    </span>
                  ))}
                  <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">
                    Cmd/Ctrl + Enter
                  </span>
                </div>
              </div>
              <textarea
                ref={textareaRef}
                aria-label="课堂需求输入"
                placeholder={composerPlaceholder}
                className="min-h-[82px] max-h-[220px] w-full resize-none border-0 bg-transparent px-4 pb-3 pt-1.5 text-[13px] leading-relaxed placeholder:text-slate-400/80 focus:outline-none md:min-h-[96px]"
                value={form.requirement}
                onChange={(e) => updateForm('requirement', e.target.value)}
                onKeyDown={handleKeyDown}
                rows={3}
                data-testid="ai-classroom-requirement"
              />
            </div>

            {/* Toolbar row */}
            <div className="flex items-center gap-2 px-4 pb-3 pt-2">
              <div className="flex-1 min-w-0">
                <GenerationToolbar
                  language={form.language}
                  onLanguageChange={(lang) => updateForm('language', lang)}
                  generationMode={form.generationMode}
                  onGenerationModeChange={(mode) => updateForm('generationMode', mode)}
                  webSearch={form.webSearch}
                  onWebSearchChange={(v) => updateForm('webSearch', v)}
                  onSettingsOpen={(section) => {
                    setSettingsSection(section);
                    setSettingsOpen(true);
                  }}
                  pdfFile={form.pdfFile}
                  onPdfFileChange={(f) => updateForm('pdfFile', f)}
                  onPdfError={setError}
                />
              </div>

              {/* Voice input */}
              <SpeechButton
                size="md"
                onTranscription={(text) => {
                  setForm((prev) => {
                    const next = prev.requirement + (prev.requirement ? ' ' : '') + text;
                    updateRequirementCache(next);
                    return { ...prev, requirement: next };
                  });
                }}
              />

              {/* Send button */}
              <button
                type="button"
                onClick={handleGenerate}
                disabled={!canGenerate}
                className={cn(
                  'inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-xl px-3 transition-all',
                  canGenerate
                    ? classroomPrimaryButton
                    : 'bg-muted text-muted-foreground/40 cursor-not-allowed',
                )}
                data-testid="ai-classroom-enter"
              >
                <span className="text-xs font-medium">{t('toolbar.enterClassroom')}</span>
                <ArrowUp className="size-3.5" />
              </button>
            </div>
          </div>
        </motion.div>

        {/* ── Error ── */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-2.5 w-full rounded-lg border border-destructive/20 bg-destructive/10 p-3"
            >
              <p className="text-sm text-destructive">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {launchSource || classroomContext || (isStudentSelfStudy && studentWorkflowHeadline) ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.38, duration: 0.35 }}
            className={cn(
              classroomSectionPanel,
              'grid w-full max-w-[1080px] gap-2.5 self-center px-4 py-3.5 text-left',
            )}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                    <div
                      className="text-[11px] font-semibold tracking-[0.12em] text-slate-500 dark:text-slate-400"
                      data-testid="ai-classroom-context-summary"
                    >
                      {isStudentSelfStudy
                        ? isExperienceModeClassroom
                          ? '体验模式边界已带入'
                          : '学习上下文已带入'
                        : '课堂上下文已带入'}
                    </div>
                <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100 md:text-[15px]">
                  {contextPanelHeading}
                </div>
                <div className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300/90">
                  {isStudentSelfStudy
                    ? isExperienceModeClassroom
                      ? `${contextPanelDescription} 生成时会优先沿着“体验对象、示例主题、登录后接入”组织课堂。`
                      : `${contextPanelDescription} 生成时会优先沿着“给谁学、学什么、学完去哪”组织课堂。`
                    : `${contextPanelDescription} 生成时会优先沿着“给谁上、学什么、学完去哪”组织课堂。`}
                </div>
              </div>
              {classroomContext ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className={classroomTonePill('sky')}>
                    {classroomContext.className ??
                      (isStudentSelfStudy
                        ? isExperienceModeClassroom
                          ? '体验模式示例课堂'
                          : '当前学习链路'
                        : '当前课堂链路')}
                  </span>
                  <span className={classroomTonePill('amber')}>
                    {buildAudienceModeLabel(classroomContext.audienceMode)}
                  </span>
                  {classroomContext.learningMode ? (
                    <span className={classroomTonePill('emerald')}>
                      {buildLearningModeLabel(classroomContext.learningMode)}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>

            {launchContextCards.length || (isStudentSelfStudy && studentWorkflowHeadline) ? (
              <details className="classroom-launch-context-details">
                <summary>
                  <span>展开完整课堂上下文</span>
                      <span className={classroomTonePill('slate')}>
                    {launchContextCards.length
                      ? `${launchContextCards.length} 项已带入`
                      : isExperienceModeClassroom
                        ? '查看体验边界'
                        : '查看自学闭环'}
                  </span>
                </summary>

                {launchContextCards.length ? (
                  <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
                    {launchContextCards.map((item) => (
                      <div
                        key={`${item.label}-${item.value}`}
                        className={classroomToneCard(item.tone)}
                      >
                        <div className="text-[11px] font-semibold tracking-[0.08em] text-slate-500 dark:text-slate-400">
                          {item.label}
                        </div>
                        <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {item.value}
                        </div>
                        {item.description ? (
                          <div className="mt-1 text-[12px] leading-5 text-slate-600 dark:text-slate-300/85">
                            {item.description}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}

                {isStudentSelfStudy && studentWorkflowHeadline ? (
                  <div className={cn(classroomSoftSurface, 'mt-4 px-4 py-3')}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={classroomTonePill('sky')}>
                        {isExperienceModeClassroom ? '体验模式边界' : '学生自学闭环'}
                      </span>
                      {currentStudentMode ? (
                        <span className={classroomTonePill('amber')}>
                          当前模式：{buildLearningModeLabel(currentStudentMode)}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {studentWorkflowHeadline}
                    </div>
                    {studentWorkflowSummary ? (
                      <div className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                        {studentWorkflowSummary}
                      </div>
                    ) : null}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link href={studentReturnHref} className={classroomOutlineButton('sky')}>
                        {isExperienceModeClassroom ? '返回体验启动页' : '返回学生启动页'}
                      </Link>
                      {isExperienceModeClassroom ? (
                        <Link href="/login" className={classroomOutlineButton('emerald')}>
                          登录同步个人进度
                        </Link>
                      ) : studentFollowUpHref ? (
                        <Link
                          href={studentFollowUpHref}
                          className={classroomOutlineButton('emerald')}
                        >
                          {`准备${buildLearningModeLabel(studentFollowUpMode || currentStudentMode || 'classroom-review')}`}
                        </Link>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </details>
            ) : null}
          </motion.div>
        ) : null}

        {isStudentSelfStudy ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.42, duration: 0.35 }}
            className={cn(
              classroomSectionPanel,
              'grid w-full max-w-[1080px] gap-3 self-center px-4 py-3.5 text-left',
            )}
          >
            <details
              className="classroom-launch-panel-disclosure classroom-launch-followup-disclosure"
              data-testid="ai-classroom-followup"
            >
              <summary>
                <div>
                  <div className="text-[11px] font-semibold tracking-[0.12em] text-slate-500 dark:text-slate-400">
                    {isExperienceModeClassroom ? '体验后下一步' : '课后继续推进'}
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {isExperienceModeClassroom
                      ? '体验结束后再展开，选择登录或继续试用'
                      : '课堂结束后再展开，选择下一步收口路径'}
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <span className={classroomTonePill('sky')}>
                    {`${studentActionCards.length} 条路径`}
                  </span>
                  {classrooms.length > 0 ? (
                    <span className={classroomTonePill('emerald')}>
                      {`最近可回看 ${classrooms.length} 节`}
                    </span>
                  ) : null}
                </div>
              </summary>
              <div className="classroom-launch-followup-grid">
                {studentActionCards.map((item) => {
                  return (
                    <div
                      key={item.id}
                      className={classroomToneCard(item.tone, 'px-4 py-4 transition-colors')}
                    >
                      <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {item.title}
                      </div>
                      <div className="mt-2 text-xs leading-5 text-slate-600 dark:text-slate-300/85">
                        {item.description}
                      </div>
                      <Link
                        href={item.href}
                        className={cn(classroomSoftButton('sky'), 'mt-4 inline-flex')}
                      >
                        {item.cta}
                      </Link>
                    </div>
                  );
                })}
              </div>
            </details>
          </motion.div>
        ) : null}
      </motion.div>

      {/* ═══ Recent classrooms — collapsible ═══ */}
      {classrooms.length > 0 && (
        <motion.div
          id="recent-classrooms"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="relative z-10 mt-8 flex w-full max-w-6xl flex-col items-center"
        >
          {/* Trigger — divider-line with centered text */}
          <button
            type="button"
            onClick={() => {
              const next = !recentOpen;
              setRecentOpen(next);
              try {
                localStorage.setItem(RECENT_OPEN_STORAGE_KEY, String(next));
              } catch {
                /* ignore */
              }
            }}
            aria-expanded={recentOpen}
            aria-controls="recent-classrooms-list"
            className="group w-full flex items-center gap-4 py-2 cursor-pointer"
          >
            <div className="flex-1 h-px bg-border/40 group-hover:bg-border/70 transition-colors" />
            <span className="shrink-0 flex items-center gap-2 text-[13px] text-muted-foreground/60 group-hover:text-foreground/70 transition-colors select-none">
              <Clock className="size-3.5" />
              {t('classroom.recentClassrooms')}
              <span className="text-[11px] tabular-nums opacity-60">{classrooms.length}</span>
              <motion.div
                animate={{ rotate: recentOpen ? 180 : 0 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
              >
                <ChevronDown className="size-3.5" />
              </motion.div>
            </span>
            <div className="flex-1 h-px bg-border/40 group-hover:bg-border/70 transition-colors" />
          </button>

          {/* Expandable content */}
          <AnimatePresence>
            {recentOpen && (
              <motion.div
                id="recent-classrooms-list"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
                className="w-full overflow-hidden"
              >
                <div className="grid grid-cols-2 gap-x-4 gap-y-6 pt-6 md:grid-cols-3 lg:grid-cols-4">
                  {classrooms.map((classroom, i) => (
                    <motion.div
                      key={classroom.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        delay: i * 0.04,
                        duration: 0.35,
                        ease: 'easeOut',
                      }}
                    >
                      <ClassroomCard
                        classroom={classroom}
                        slide={thumbnails[classroom.id]}
                        formatDate={formatDate}
                        onDelete={handleDelete}
                        confirmingDelete={pendingDeleteId === classroom.id}
                        onConfirmDelete={() => confirmDelete(classroom.id)}
                        onCancelDelete={() => setPendingDeleteId(null)}
                        onClick={() => router.push(`/classroom/${classroom.id}`)}
                      />
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Footer — flows with content, at the very end */}
      <div className="pt-10 pb-3 text-center text-xs text-muted-foreground/50">
        {PRODUCT_BRAND_NAME} · 航科 AI 教育平台课堂学习空间
      </div>
    </div>
  );
}

// ─── Greeting Bar — avatar + "Hi, Name", click to edit in-place ────
const MAX_AVATAR_SIZE = 5 * 1024 * 1024;

function isCustomAvatar(src: string) {
  return src.startsWith('data:');
}

function GreetingBar() {
  const { t } = useI18n();
  const avatar = useUserProfileStore((s) => s.avatar);
  const nickname = useUserProfileStore((s) => s.nickname);
  const bio = useUserProfileStore((s) => s.bio);
  const setAvatar = useUserProfileStore((s) => s.setAvatar);
  const setNickname = useUserProfileStore((s) => s.setNickname);
  const setBio = useUserProfileStore((s) => s.setBio);

  const [open, setOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const avatarInputId = 'classroom-avatar-upload';

  const displayName = nickname || t('profile.defaultNickname');

  // Click-outside to collapse
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setEditingName(false);
        setAvatarPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const startEditName = () => {
    setNameDraft(nickname);
    setEditingName(true);
    setTimeout(() => nameInputRef.current?.focus(), 50);
  };

  const commitName = () => {
    setNickname(nameDraft.trim());
    setEditingName(false);
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_AVATAR_SIZE) {
      toast.error(t('profile.fileTooLarge'));
      return;
    }
    if (!file.type.startsWith('image/')) {
      toast.error(t('profile.invalidFileType'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d')!;
        const scale = Math.max(128 / img.width, 128 / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.drawImage(img, (128 - w) / 2, (128 - h) / 2, w, h);
        setAvatar(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full px-4 pt-2 lg:w-full lg:max-w-[272px] lg:px-0 lg:pb-0.5"
    >
      <input
        id={avatarInputId}
        ref={avatarInputRef}
        type="file"
        accept="image/*"
        aria-label="上传课堂头像"
        className="hidden"
        onChange={handleAvatarUpload}
      />

      {/* ── Collapsed pill (always in flow) ── */}
      {!open && (
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 rounded-[18px] border border-border/50 px-2.5 py-1 text-muted-foreground/70 transition-all duration-200 group cursor-pointer hover:bg-muted/60 hover:text-foreground active:scale-[0.97] lg:w-auto lg:justify-start"
          onClick={() => setOpen(true)}
          aria-label={`打开课堂身份设置，当前身份 ${displayName}`}
          aria-expanded={open}
        >
          <div className="shrink-0 relative">
            <div className="size-7 rounded-full overflow-hidden ring-[1.5px] ring-border/30 group-hover:ring-sky-400/60 dark:group-hover:ring-sky-400/40 transition-all duration-300">
              <img src={avatar} alt="" className="size-full object-cover" />
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full bg-white dark:bg-slate-800 border border-border/40 flex items-center justify-center opacity-60 group-hover:opacity-100 transition-opacity">
              <Pencil className="size-[7px] text-muted-foreground/70" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="leading-none select-none flex items-center gap-1">
                  <span>
                    <span className="text-[11px] text-muted-foreground/60 group-hover:text-muted-foreground transition-colors">
                      课堂身份
                    </span>
                    <span className="text-[12px] font-semibold text-foreground/85 group-hover:text-foreground transition-colors">
                      {displayName}
                    </span>
                  </span>
                  <ChevronDown className="size-2.5 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors shrink-0" />
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={4}>
                {t('profile.editTooltip')}
              </TooltipContent>
            </Tooltip>
          </div>
        </button>
      )}

      {/* ── Expanded panel (kept inline to avoid overlapping the main stage) ── */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            className="mt-1.5 w-full lg:mt-1.5 lg:w-full"
          >
            <div className="rounded-2xl bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06] shadow-[0_1px_8px_-2px_rgba(0,0,0,0.06)] dark:shadow-[0_1px_8px_-2px_rgba(0,0,0,0.3)] px-2.5 py-2">
              {/* ── Row: avatar + name ── */}
              <div
                className="flex items-center gap-2.5 cursor-pointer transition-all duration-200"
                onClick={() => {
                  setOpen(false);
                  setEditingName(false);
                  setAvatarPickerOpen(false);
                }}
              >
                {/* Avatar */}
                <div
                  className="shrink-0 relative cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    setAvatarPickerOpen(!avatarPickerOpen);
                  }}
                >
                  <div className="size-8 rounded-full overflow-hidden ring-[1.5px] ring-sky-300/70 dark:ring-sky-500/40 transition-all duration-300">
                    <img src={avatar} alt="" className="size-full object-cover" />
                  </div>
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full bg-white dark:bg-slate-800 border border-border/60 flex items-center justify-center"
                  >
                    <ChevronDown
                      className={cn(
                        'size-2 text-muted-foreground/70 transition-transform duration-200',
                        avatarPickerOpen && 'rotate-180',
                      )}
                    />
                  </motion.div>
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  {editingName ? (
                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <input
                        ref={nameInputRef}
                        value={nameDraft}
                        aria-label="课堂昵称"
                        onChange={(e) => setNameDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitName();
                          if (e.key === 'Escape') {
                            setEditingName(false);
                          }
                        }}
                        onBlur={commitName}
                        maxLength={20}
                        placeholder={t('profile.defaultNickname')}
                        className="flex-1 min-w-0 h-6 bg-transparent border-b border-border/80 text-[13px] font-semibold text-foreground outline-none placeholder:text-muted-foreground/40"
                      />
                      <button
                        type="button"
                        onClick={commitName}
                        aria-label="确认课堂昵称"
                        className="shrink-0 size-5 rounded flex items-center justify-center text-sky-500 hover:bg-sky-100 dark:hover:bg-sky-900/30"
                      >
                        <Check className="size-3" />
                      </button>
                    </div>
                  ) : (
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        startEditName();
                      }}
                      role="button"
                      tabIndex={0}
                      aria-label="编辑课堂昵称"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          e.stopPropagation();
                          startEditName();
                        }
                      }}
                      className="group/name inline-flex items-center gap-1 cursor-pointer"
                    >
                      <span className="text-[13px] font-semibold text-foreground/85 group-hover/name:text-foreground transition-colors">
                        {displayName}
                      </span>
                      <Pencil className="size-2.5 text-muted-foreground/30 opacity-0 group-hover/name:opacity-100 transition-opacity" />
                    </span>
                  )}
                </div>

                {/* Collapse arrow */}
                <motion.div
                  initial={{ opacity: 0, y: -2 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="shrink-0 size-6 rounded-full flex items-center justify-center hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
                >
                  <ChevronUp className="size-3.5 text-muted-foreground/50" />
                </motion.div>
              </div>

              {/* ── Expandable content ── */}
              <div className="pt-2" onClick={(e) => e.stopPropagation()}>
                {/* Avatar picker */}
                <AnimatePresence>
                  {avatarPickerOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.15, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
                      <div className="p-1 pb-2.5 flex items-center gap-1.5 flex-wrap">
                        {AVATAR_OPTIONS.map((url) => (
                          <button
                            key={url}
                            type="button"
                            onClick={() => setAvatar(url)}
                            aria-label={avatar === url ? '当前课堂头像' : '选择课堂头像'}
                            className={cn(
                              'size-7 rounded-full overflow-hidden bg-gray-50 dark:bg-gray-800 cursor-pointer transition-all duration-150',
                              'hover:scale-110 active:scale-95',
                              avatar === url
                                ? 'ring-2 ring-sky-400 dark:ring-sky-500 ring-offset-0'
                                : 'hover:ring-1 hover:ring-muted-foreground/30',
                            )}
                          >
                            <img src={url} alt="" className="size-full" />
                          </button>
                        ))}
                        <button
                          type="button"
                          aria-label="上传自定义课堂头像"
                          className={cn(
                            'size-7 rounded-full flex items-center justify-center cursor-pointer transition-all duration-150 border border-dashed',
                            'hover:scale-110 active:scale-95',
                            isCustomAvatar(avatar)
                              ? 'ring-2 ring-sky-400 dark:ring-sky-500 ring-offset-0 border-sky-300 dark:border-sky-600 bg-sky-50 dark:bg-sky-900/30'
                              : 'border-muted-foreground/30 text-muted-foreground/50 hover:border-muted-foreground/50',
                          )}
                          onClick={() => avatarInputRef.current?.click()}
                          title={t('profile.uploadAvatar')}
                        >
                          <ImagePlus className="size-3" />
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Bio */}
                <UITextarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  aria-label="课堂身份简介"
                  placeholder={t('profile.bioPlaceholder')}
                  maxLength={200}
                  rows={2}
                  className="resize-none border-border/40 bg-transparent min-h-[72px] !text-[13px] !leading-relaxed placeholder:!text-[11px] placeholder:!leading-relaxed focus-visible:ring-1 focus-visible:ring-border/60"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Classroom Card — clean, minimal style ──────────────────────
function ClassroomCard({
  classroom,
  slide,
  formatDate,
  onDelete,
  confirmingDelete,
  onConfirmDelete,
  onCancelDelete,
  onClick,
}: {
  classroom: StageListItem;
  slide?: Slide;
  formatDate: (ts: number) => string;
  onDelete: (id: string, e: React.MouseEvent) => void;
  confirmingDelete: boolean;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  onClick: () => void;
}) {
  const { t } = useI18n();
  const thumbRef = useRef<HTMLDivElement>(null);
  const [thumbWidth, setThumbWidth] = useState(0);

  useEffect(() => {
    const el = thumbRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setThumbWidth(Math.round(entry.contentRect.width));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="group cursor-pointer" onClick={confirmingDelete ? undefined : onClick}>
      {/* Thumbnail — large radius, no border, subtle bg */}
      <div
        ref={thumbRef}
        className="relative w-full aspect-[16/9] rounded-2xl bg-slate-100 dark:bg-slate-800/80 overflow-hidden transition-transform duration-200 group-hover:scale-[1.02]"
      >
        {slide && thumbWidth > 0 ? (
          <ThumbnailSlide
            slide={slide}
            size={thumbWidth}
            viewportSize={slide.viewportSize ?? 1000}
            viewportRatio={slide.viewportRatio ?? 0.5625}
          />
        ) : !slide ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="size-12 rounded-2xl bg-gradient-to-br from-sky-100 to-amber-100 dark:from-sky-900/30 dark:to-amber-900/20 flex items-center justify-center">
              <span className="text-xl opacity-50">📄</span>
            </div>
          </div>
        ) : null}

        {/* Delete — top-right, only on hover */}
        <AnimatePresence>
          {!confirmingDelete && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label={`删除课堂 ${classroom.name}`}
                className="absolute top-2 right-2 size-7 opacity-0 group-hover:opacity-100 transition-opacity bg-black/30 hover:bg-destructive/80 text-white hover:text-white backdrop-blur-sm rounded-full"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(classroom.id, e);
                }}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Inline delete confirmation overlay */}
        <AnimatePresence>
          {confirmingDelete && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/50 backdrop-blur-[6px]"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="text-[13px] font-medium text-white/90">
                {t('classroom.deleteConfirmTitle')}?
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="px-3.5 py-1 rounded-lg text-[12px] font-medium bg-white/15 text-white/80 hover:bg-white/25 backdrop-blur-sm transition-colors"
                  onClick={onCancelDelete}
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  className="px-3.5 py-1 rounded-lg text-[12px] font-medium bg-red-500/90 text-white hover:bg-red-500 transition-colors"
                  onClick={onConfirmDelete}
                >
                  {t('classroom.delete')}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Info — outside the thumbnail */}
      <div className="mt-2.5 px-1 flex items-center gap-2">
        <span
          className={cn(
            classroomTonePill('sky'),
            'shrink-0 inline-flex items-center px-2 py-0.5 text-[11px] font-medium',
          )}
        >
          {classroom.sceneCount} {t('classroom.slides')} · {formatDate(classroom.updatedAt)}
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <p className="font-medium text-[15px] truncate text-foreground/90 min-w-0">
              {classroom.name}
            </p>
          </TooltipTrigger>
          <TooltipContent
            side="bottom"
            sideOffset={4}
            className="!max-w-[min(90vw,32rem)] break-words whitespace-normal"
          >
            <div className="flex items-center gap-1.5">
              <span className="break-all">{classroom.name}</span>
              <button
                type="button"
                aria-label={`复制课堂名称 ${classroom.name}`}
                className="shrink-0 p-0.5 rounded hover:bg-foreground/10 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  navigator.clipboard.writeText(classroom.name);
                  toast.success(t('classroom.nameCopied'));
                }}
              >
                <Copy className="size-3 opacity-60" />
              </button>
            </div>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

export default function Page() {
  return <HomePage />;
}

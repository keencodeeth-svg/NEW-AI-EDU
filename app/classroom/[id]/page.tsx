'use client';

import Link from 'next/link';
import { ClassroomBrand } from '@/components/brand/classroom-brand';
import { Stage } from '@/components/stage';
import { ThemeProvider } from '@/lib/hooks/use-theme';
import { useStageStore } from '@/lib/store';
import { loadImageMapping } from '@/lib/utils/image-storage';
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useSceneGenerator } from '@/lib/hooks/use-scene-generator';
import { useMediaGenerationStore } from '@/lib/store/media-generation';
import { useWhiteboardHistoryStore } from '@/lib/store/whiteboard-history';
import { createLogger } from '@/lib/logger';
import { MediaStageProvider } from '@/lib/contexts/media-stage-context';
import { generateMediaForOutlines } from '@/lib/media/media-orchestrator';
import {
  buildAudienceModeLabel,
  buildDeliveryFormatLabel,
  buildExportFormatLabel,
  buildLearningModeLabel,
  buildSubjectLabel,
} from '@/lib/classroom-integration';
import { persistClassroomSnapshot } from '@/lib/classroom-persistence-client';
import { useStudentSelfStudyArtifacts } from '@/lib/hooks/use-student-self-study-artifacts';
import {
  buildStudentSelfStudyArtifactDetail,
  formatStudentSelfStudyArtifactTime,
} from '@/lib/student-self-study-artifacts';
import { useSearchParams } from 'next/navigation';
import {
  classroomHeroPanel,
  classroomInsetPanel,
  classroomOutlineButton,
  classroomPrimaryButton,
  classroomSectionPanel,
  classroomToneCard,
  classroomTonePill,
} from '@/lib/ui/classroom-theme';

const log = createLogger('Classroom');
const APP_TIME_ZONE = 'Asia/Shanghai';

function isStudentSelfStudyMode(mode?: string | null): boolean {
  return (
    mode === 'preview-preparation' ||
    mode === 'subject-reinforcement' ||
    mode === 'interest-cultivation' ||
    mode === 'classroom-review'
  );
}

export default function ClassroomDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const classroomId = params?.id as string;
  const isAudienceView = searchParams.get('audience') === '1';

  const { loadFromStorage } = useStageStore();
  const clearStageStore = useStageStore((state) => state.clearStore);
  const stage = useStageStore((state) => state.stage);
  const scenes = useStageStore((state) => state.scenes);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [classroomMissing, setClassroomMissing] = useState(false);
  const pageViewportRef = useRef<HTMLDivElement | null>(null);
  const [pageViewportHeight, setPageViewportHeight] = useState<number | null>(null);
  const [deliveryDockExpanded, setDeliveryDockExpanded] = useState(false);
  const persistTimeoutRef = useRef<number | null>(null);
  const persistAbortControllerRef = useRef<AbortController | null>(null);
  const lastPersistedSnapshotRef = useRef<string | null>(null);

  const generationStartedRef = useRef(false);
  const { upsertArtifact, markSaved, findArtifact } = useStudentSelfStudyArtifacts();

  const syncPageViewportHeight = useCallback(() => {
    if (typeof window === 'undefined' || !pageViewportRef.current) {
      return;
    }

    const topOffset = pageViewportRef.current.getBoundingClientRect().top;
    const nextHeight = Math.max(window.innerHeight - topOffset, 560);
    setPageViewportHeight((current) => (current === nextHeight ? current : nextHeight));
  }, []);

  const { generateRemaining, retrySingleOutline, stop } = useSceneGenerator({
    onComplete: () => {
      log.info('[Classroom] All scenes generated');
    },
  });

  const hydrateClassroomFromServer = useCallback(async () => {
    try {
      const query = new URLSearchParams({ id: classroomId });
      if (isAudienceView) {
        query.set('audience', '1');
      }

      const res = await fetch(`/api/classroom?${query.toString()}`);
      if (!res.ok) {
        return false;
      }

      const json = await res.json();
      if (!json.success || !json.classroom) {
        return false;
      }

      const { stage, scenes } = json.classroom;
      useStageStore.getState().setStage(stage);
      useStageStore.setState({
        scenes,
        currentSceneId: scenes[0]?.id ?? null,
      });
      log.info('Loaded from server-side storage:', classroomId);
      return true;
    } catch (fetchErr) {
      log.warn('Server-side storage fetch failed:', fetchErr);
      return false;
    }
  }, [classroomId, isAudienceView]);

  const loadClassroom = useCallback(async () => {
    try {
      if (isAudienceView) {
        const loadedFromServer = await hydrateClassroomFromServer();
        if (!loadedFromServer) {
          await loadFromStorage(classroomId);
        }
      } else {
        await loadFromStorage(classroomId);

        // If IndexedDB had no data, try server-side storage (API-generated classrooms)
        if (!useStageStore.getState().stage) {
          log.info('No IndexedDB data, trying server-side storage for:', classroomId);
          await hydrateClassroomFromServer();
        }
      }

      const loadedStage = useStageStore.getState().stage;
      if (!loadedStage || loadedStage.id !== classroomId) {
        setClassroomMissing(true);
        return;
      }

      setClassroomMissing(false);

      if (isAudienceView) {
        return;
      }

      // Restore completed media generation tasks from IndexedDB
      await useMediaGenerationStore.getState().restoreFromDB(classroomId);
      // Restore generated agents for this stage
      const { loadGeneratedAgentsForStage } = await import('@/lib/orchestration/registry/store');
      const agentIds = await loadGeneratedAgentsForStage(classroomId);
      if (agentIds.length > 0) {
        const { useSettingsStore } = await import('@/lib/store/settings');
        useSettingsStore.getState().setSelectedAgentIds(agentIds);
      }
    } catch (error) {
      log.error('Failed to load classroom:', error);
      setError(error instanceof Error ? error.message : '课堂加载失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [classroomId, hydrateClassroomFromServer, isAudienceView, loadFromStorage]);

  useEffect(() => {
    // Reset loading state on course switch to unmount Stage during transition,
    // preventing stale data from syncing back to the new course
    setLoading(true);
    setError(null);
    setClassroomMissing(false);
    generationStartedRef.current = false;

    // Clear previous classroom's media tasks to prevent cross-classroom contamination.
    // Placeholder IDs (gen_img_1, gen_vid_1) are NOT globally unique across stages,
    // so stale tasks from a previous classroom would shadow the new one's.
    const mediaStore = useMediaGenerationStore.getState();
    mediaStore.revokeObjectUrls();
    useMediaGenerationStore.setState({ tasks: {} });
    clearStageStore();

    // Clear whiteboard history to prevent snapshots from a previous course leaking in.
    useWhiteboardHistoryStore.getState().clearHistory();

    loadClassroom();

    // Cancel ongoing generation when classroomId changes or component unmounts
    return () => {
      stop();
    };
  }, [classroomId, clearStageStore, loadClassroom, stop]);

  useEffect(() => {
    return () => {
      if (persistTimeoutRef.current !== null) {
        window.clearTimeout(persistTimeoutRef.current);
      }
      persistAbortControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    syncPageViewportHeight();

    const rafId = window.requestAnimationFrame(syncPageViewportHeight);
    window.addEventListener('resize', syncPageViewportHeight);

    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            syncPageViewportHeight();
          })
        : null;

    const observedElements = [
      pageViewportRef.current?.parentElement,
      document.querySelector('.site-header'),
      document.querySelector('.site-footer'),
    ].filter((element): element is Element => Boolean(element));

    observedElements.forEach((element) => resizeObserver?.observe(element));

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', syncPageViewportHeight);
      observedElements.forEach((element) => resizeObserver?.unobserve(element));
      resizeObserver?.disconnect();
    };
  }, [syncPageViewportHeight]);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-classroom-focus', 'true');

    return () => {
      root.removeAttribute('data-classroom-focus');
    };
  }, []);

  useEffect(() => {
    if (
      isAudienceView ||
      loading ||
      error ||
      classroomMissing ||
      !stage ||
      stage.id !== classroomId ||
      scenes.length === 0
    ) {
      return;
    }

    const canPersistSnapshot =
      typeof document !== 'undefined' && document.body.dataset.authenticated === '1';
    if (!canPersistSnapshot) {
      return;
    }

    const snapshot = JSON.stringify({ stage, scenes });
    if (snapshot === lastPersistedSnapshotRef.current) {
      return;
    }

    if (persistTimeoutRef.current !== null) {
      window.clearTimeout(persistTimeoutRef.current);
    }

    persistTimeoutRef.current = window.setTimeout(() => {
      persistAbortControllerRef.current?.abort();
      const controller = new AbortController();
      persistAbortControllerRef.current = controller;

      void persistClassroomSnapshot({
        stage,
        scenes,
        signal: controller.signal,
      })
        .then(() => {
          lastPersistedSnapshotRef.current = snapshot;
        })
        .catch((persistError) => {
          if (persistError instanceof DOMException && persistError.name === 'AbortError') {
            return;
          }
          log.warn('[Classroom] Failed to sync classroom snapshot to server:', persistError);
        });
    }, 400);

    return () => {
      if (persistTimeoutRef.current !== null) {
        window.clearTimeout(persistTimeoutRef.current);
        persistTimeoutRef.current = null;
      }
    };
  }, [classroomId, classroomMissing, error, isAudienceView, loading, scenes, stage]);

  // Auto-resume generation for pending outlines
  useEffect(() => {
    if (isAudienceView || loading || error || generationStartedRef.current) return;

    const state = useStageStore.getState();
    const { outlines, scenes, stage } = state;

    // Check if there are pending outlines
    const completedOrders = new Set(scenes.map((s) => s.order));
    const hasPending = outlines.some((o) => !completedOrders.has(o.order));

    if (hasPending && stage) {
      generationStartedRef.current = true;

      // Load generation params from sessionStorage (stored by generation-preview before navigating)
      const genParamsStr = sessionStorage.getItem('generationParams');
      const params = genParamsStr ? JSON.parse(genParamsStr) : {};

      // Reconstruct imageMapping from IndexedDB using pdfImages storageIds
      const storageIds = (params.pdfImages || [])
        .map((img: { storageId?: string }) => img.storageId)
        .filter(Boolean);

      loadImageMapping(storageIds).then((imageMapping) => {
        generateRemaining({
          pdfImages: params.pdfImages,
          imageMapping,
          stageInfo: {
            name: stage.name || '',
            description: stage.description,
            language: stage.language,
            style: stage.style,
          },
          agents: params.agents,
          userProfile: params.userProfile,
        });
      });
    } else if (outlines.length > 0 && stage) {
      // All scenes are generated, but some media may not have finished.
      // Resume media generation for any tasks not yet in IndexedDB.
      // generateMediaForOutlines skips already-completed tasks automatically.
      generationStartedRef.current = true;
      generateMediaForOutlines(outlines, stage.id).catch((err) => {
        log.warn('[Classroom] Media generation resume error:', err);
      });
    }
  }, [error, generateRemaining, isAudienceView, loading]);

  const classroomMeta = stage?.classroomMeta ?? null;
  const isStudentSelfStudyStage =
    classroomMeta?.source === 'student-self-study' &&
    isStudentSelfStudyMode(classroomMeta.learningMode);

  useEffect(() => {
    if (isAudienceView || !stage || !classroomMeta || !isStudentSelfStudyStage) {
      return;
    }

    upsertArtifact({
      stageId: stage.id,
      stageName: stage.name,
      sceneCount: scenes.length,
      classroomMeta,
      stageHref: `/classroom/${stage.id}`,
    });
  }, [
    classroomMeta,
    isAudienceView,
    isStudentSelfStudyStage,
    scenes.length,
    stage,
    upsertArtifact,
  ]);

  const currentArtifact = useMemo(() => {
    if (!classroomId) {
      return null;
    }

    return findArtifact(classroomId) ?? null;
  }, [classroomId, findArtifact]);

  const summaryTitle =
    currentArtifact?.topic ||
    classroomMeta?.focusKnowledgePointTitle ||
    classroomMeta?.interestTopic;
  const summaryDetail = currentArtifact
    ? buildStudentSelfStudyArtifactDetail(currentArtifact)
    : null;
  const followUpLabel = currentArtifact?.followUpMode
    ? buildLearningModeLabel(currentArtifact.followUpMode)
    : null;
  const savedToGrowth = Boolean(currentArtifact?.savedToGrowthAt);
  const savedToFavorites = Boolean(currentArtifact?.savedToFavoritesAt);
  const latestDelivery = classroomMeta?.deliveryRecords?.[0] ?? null;
  const latestDeliveryTimeLabel = latestDelivery
    ? new Date(latestDelivery.createdAt).toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: APP_TIME_ZONE,
      })
    : null;
  const latestDeliveryFormatLabel = latestDelivery
    ? buildDeliveryFormatLabel(latestDelivery.format)
    : null;
  const deliveryAudienceLabel = buildAudienceModeLabel(classroomMeta?.audienceMode);
  const deliveryLearningModeLabel = classroomMeta?.learningMode
    ? buildLearningModeLabel(classroomMeta.learningMode)
    : null;
  const exportFormatsLabel = classroomMeta?.exportFormats?.length
    ? classroomMeta.exportFormats.map((format) => buildExportFormatLabel(format)).join(' / ')
    : 'PPTX 课件 / 资源包';
  const teacherDisplayName =
    classroomMeta?.teacher?.digitalHuman?.displayName || classroomMeta?.teacher?.name || null;
  const classroomContextLabel = [
    classroomMeta?.className,
    classroomMeta?.subject ? buildSubjectLabel(classroomMeta.subject) : null,
    classroomMeta?.grade ? `${classroomMeta.grade}年级` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const deliveryDockTitle = summaryTitle || stage?.name || '课堂已生成完成';
  const deliveryDockDescription = isStudentSelfStudyStage
    ? summaryDetail ||
      '学完不要停在回看，顺手把这节课沉淀到成长档案、课堂灵感和下一轮学习模式。'
    : classroomMeta?.publishedUrl
      ? '这节课堂已经具备班级观看与课件流转能力，适合直接投屏、分享和归档。'
      : '顶部已经固定了发布全班观看和导出课件入口，课堂完成后可以直接完成交付。';
  const deliveryDockQuickFacts = isStudentSelfStudyStage
    ? [
        {
          label: '课堂进度',
          value: `已生成 ${currentArtifact?.sceneCount ?? scenes.length} 个场景`,
          helper: '保持当前沉浸课堂不被信息墙打断。',
        },
        {
          label: '最近更新',
          value: currentArtifact?.updatedAt
            ? formatStudentSelfStudyArtifactTime(currentArtifact.updatedAt)
            : '刚刚完成',
          helper: '现在适合顺手回收到成长档案与课堂灵感。',
        },
        {
          label: '推荐续学',
          value: followUpLabel || '返回学生启动页继续学习',
          helper: '把一节课接成下一轮复习、预习或兴趣延展。',
        },
      ]
    : [
        {
          label: '交付能力',
          value: exportFormatsLabel,
          helper: '顶部已固定导出与班级分享入口。',
        },
        {
          label: '最近交付',
          value: latestDeliveryTimeLabel || '待首次交付',
          helper: latestDeliveryFormatLabel ? `最近一次动作：${latestDeliveryFormatLabel}` : '完成后可直接投屏、分享和归档。',
        },
        {
          label: '课堂上下文',
          value: classroomContextLabel || '班级、学科与年级信息已同步',
          helper: teacherDisplayName ? `主讲：${teacherDisplayName}` : '可兼容真实教务角色与数字主讲。',
        },
      ];
  const deliveryDockActionHeading = isStudentSelfStudyStage ? '下一步建议' : '课堂交付主线';
  const deliveryDockActionHint = isStudentSelfStudyStage
    ? '先把这节课回收到成长档案或课堂灵感，再顺手切换到下一轮学习模式，学生的使用闭环会更完整。'
    : classroomMeta?.publishedUrl
      ? '顶部发布与导出能力已经就绪，这里专注教学回流、台账查看和班级观看复用。'
      : '发布全班观看和导出课件已经固定在顶部工具栏，这里优先保留后续教学流转入口。';
  const detailToggleLabel = deliveryDockExpanded ? '收起课堂详情' : '展开课堂详情';
  const detailSummaryHeading = isStudentSelfStudyStage ? '沉淀状态与回流' : '课堂上下文与交付状态';

  useEffect(() => {
    setDeliveryDockExpanded(false);
  }, [classroomId]);

  return (
    <ThemeProvider>
      <MediaStageProvider value={classroomId}>
        <div
          ref={pageViewportRef}
          className="relative flex min-h-0 flex-col overflow-hidden"
          style={{
            height:
              pageViewportHeight !== null
                ? `${pageViewportHeight}px`
                : 'calc(100dvh - clamp(72px, 8vh, 96px))',
          }}
        >
          {loading ? (
            <div className="classroom-page-shell flex-1 overflow-auto px-4 py-6">
              <div className="mx-auto flex min-h-full w-full max-w-5xl items-center">
                <div className={`${classroomHeroPanel} w-full p-6 md:p-8`}>
                  <ClassroomBrand size="sm" showSubtitle={false} className="max-w-fit" />

                  <div className="mt-5 flex flex-wrap gap-2">
                    <span className={classroomTonePill('sky', 'px-2.5 py-1 text-[11px]')}>
                      课堂准备中
                    </span>
                    <span className={classroomTonePill('emerald', 'px-2.5 py-1 text-[11px]')}>
                      正在同步场景与素材
                    </span>
                    <span className={classroomTonePill('slate', 'px-2.5 py-1 text-[11px] font-medium tracking-normal normal-case')}>
                      {isAudienceView ? '全班观看入口' : '课堂工作区'}
                    </span>
                  </div>

                  <div className="mt-4 max-w-3xl">
                    <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                      课堂正在准备中
                    </h1>
                    <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
                      正在同步课堂脚本、场景素材和交付入口。准备完成后，你会直接进入这节课的正式播放界面，不需要重复回到前一个页面。
                    </p>
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-3">
                    <div className={`${classroomInsetPanel} px-4 py-4`}>
                      <div className="text-xs font-semibold tracking-[0.12em] text-slate-500 dark:text-slate-400">
                        正在处理
                      </div>
                      <div className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                        课堂主线与场景顺序
                      </div>
                      <div className="mt-1 text-xs leading-6 text-slate-500 dark:text-slate-400">
                        确保进入课堂后，讲解、互动和回看顺序已经就绪。
                      </div>
                    </div>
                    <div className={`${classroomInsetPanel} px-4 py-4`}>
                      <div className="text-xs font-semibold tracking-[0.12em] text-slate-500 dark:text-slate-400">
                        同步资源
                      </div>
                      <div className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                        数字讲解、课件与媒体素材
                      </div>
                      <div className="mt-1 text-xs leading-6 text-slate-500 dark:text-slate-400">
                        避免进入课堂后还要等待关键内容逐个加载。
                      </div>
                    </div>
                    <div className={`${classroomInsetPanel} px-4 py-4`}>
                      <div className="text-xs font-semibold tracking-[0.12em] text-slate-500 dark:text-slate-400">
                        完成后可用
                      </div>
                      <div className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                        播放、回看、分享与导出
                      </div>
                      <div className="mt-1 text-xs leading-6 text-slate-500 dark:text-slate-400">
                        整班观看和课后沉淀入口会沿同一节课自动接上。
                      </div>
                    </div>
                  </div>

                  <div className={`${classroomToneCard('sky')} mt-5 px-4 py-3 text-xs leading-6 text-sky-800 dark:text-sky-200`}>
                    如果你刚从生成预览页进入这里，通常只需要再等待片刻。页面会在课堂资源就绪后自动显示正式课堂内容。
                  </div>
                </div>
              </div>
            </div>
          ) : error ? (
            <div className="classroom-page-shell flex-1 overflow-auto px-4 py-6">
              <div className="mx-auto flex min-h-full w-full max-w-4xl items-center">
                <div className={`${classroomHeroPanel} w-full p-6 md:p-8`}>
                  <ClassroomBrand size="sm" showSubtitle={false} className="max-w-fit" />

                  <div className="mt-5 max-w-3xl">
                    <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                      这节课堂暂时没有顺利打开
                    </h1>
                    <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
                      当前课堂资源或快照同步被打断了，所以暂时还没有进入正式播放状态。你可以先重新加载这节课；如果问题持续存在，再回到启动页重新进入。
                    </p>
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-2">
                    <div className={`${classroomInsetPanel} px-4 py-4`}>
                      <div className="text-xs font-semibold tracking-[0.12em] text-slate-500 dark:text-slate-400">
                        当前错误
                      </div>
                      <div className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                        课堂加载失败
                      </div>
                      <div className="mt-1 text-xs leading-6 text-slate-500 dark:text-slate-400 break-words">
                        {error}
                      </div>
                    </div>
                    <div className={`${classroomInsetPanel} px-4 py-4`}>
                      <div className="text-xs font-semibold tracking-[0.12em] text-slate-500 dark:text-slate-400">
                        推荐恢复动作
                      </div>
                      <div className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                        先重新加载，再回到正确入口
                      </div>
                      <div className="mt-1 text-xs leading-6 text-slate-500 dark:text-slate-400">
                        如果这是学生自主学习课堂，建议回到学生启动页；如果是教师课堂，建议回到互动课堂工作区重新进入。
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-3 md:grid-cols-3">
                    <button
                      onClick={() => {
                        setError(null);
                        setLoading(true);
                        loadClassroom();
                      }}
                      className={`${classroomPrimaryButton} py-3 text-sm`}
                    >
                      重新加载这节课
                    </button>
                    <Link
                      href="/ai-classroom"
                      className={`${classroomOutlineButton('sky')} py-3 text-center text-sm`}
                    >
                      回到互动课堂工作区
                    </Link>
                    <Link
                      href="/student/interactive-classroom"
                      className={`${classroomOutlineButton('amber')} py-3 text-center text-sm`}
                    >
                      回到学生启动页
                    </Link>
                  </div>

                  <div className={`${classroomToneCard('amber')} mt-5 px-4 py-3 text-xs leading-6 text-amber-800 dark:text-amber-200`}>
                    课堂页会优先保护当前数据，不会为了强行打开而继续显示旧课堂残留内容。
                  </div>
                </div>
              </div>
            </div>
          ) : classroomMissing ? (
            <div className="classroom-page-shell flex-1 overflow-auto px-4 py-6">
              <div className="mx-auto flex min-h-full w-full max-w-4xl items-center">
                <div className={`${classroomHeroPanel} w-full p-6 md:p-8`}>
                  <ClassroomBrand size="sm" showSubtitle={false} className="max-w-fit" />

                  <div className="mt-5 max-w-3xl">
                    <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                      这节课堂当前无法直接打开
                    </h1>
                    <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
                      可能是这个课堂链接来自临时生成记录、浏览器本地缓存已清空，或当前链接对应的课堂尚未被重新发布。我们已经阻止旧课堂残留继续显示，现在你可以从下面的入口快速回到正确链路。
                    </p>
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-3">
                    <div className={`${classroomInsetPanel} px-4 py-4`}>
                      <div className="text-xs font-semibold tracking-[0.12em] text-slate-500 dark:text-slate-400">
                        当前课堂编号
                      </div>
                      <div className="mt-2 break-all text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {classroomId}
                      </div>
                    </div>
                    <div className={`${classroomInsetPanel} px-4 py-4`}>
                      <div className="text-xs font-semibold tracking-[0.12em] text-slate-500 dark:text-slate-400">
                        当前访问方式
                      </div>
                      <div className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {isAudienceView ? '全班观看地址' : '课堂工作区'}
                      </div>
                    </div>
                    <div className={`${classroomInsetPanel} px-4 py-4`}>
                      <div className="text-xs font-semibold tracking-[0.12em] text-slate-500 dark:text-slate-400">
                        推荐恢复动作
                      </div>
                      <div className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {isAudienceView ? '重新发布整班观看链接' : '从启动页重新进入课堂'}
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <button
                      onClick={() => {
                        setError(null);
                        setClassroomMissing(false);
                        setLoading(true);
                        clearStageStore();
                        loadClassroom();
                      }}
                      className={`${classroomPrimaryButton} py-3 text-sm`}
                    >
                      重新尝试加载
                    </button>
                    <Link
                      href="/ai-classroom"
                      className={`${classroomOutlineButton('sky')} py-3 text-center text-sm`}
                    >
                      新建互动课堂
                    </Link>
                    <Link
                      href="/student/interactive-classroom"
                      className={`${classroomOutlineButton('emerald')} py-3 text-center text-sm`}
                    >
                      去学生自主学习
                    </Link>
                    <Link
                      href="/"
                      className={`${classroomOutlineButton('amber')} py-3 text-center text-sm`}
                    >
                      返回平台首页
                    </Link>
                  </div>

                  <div className={`${classroomToneCard('amber')} mt-5 px-4 py-3 text-xs leading-6 text-amber-800 dark:text-amber-200`}>
                    {isAudienceView
                      ? '如果这是给全班观看的链接，建议回到教师工作区重新发布，新的分享地址会自动带上 audience 参数。'
                      : '如果这是学生自主学习课堂，建议回到学生启动页重新发起，这样会自动带上学习模式、目标和课堂沉淀链路。'}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <Stage onRetryOutline={retrySingleOutline} audienceMode={isAudienceView} />
          )}
        </div>

        {stage && classroomMeta && !isAudienceView ? (
          <section className="classroom-learning-dock border-t border-slate-200/80 bg-white/88 px-4 py-2.5 backdrop-blur dark:border-slate-800/80 dark:bg-slate-950/82">
            <div className="mx-auto w-full max-w-[1240px]">
              <div className={`${classroomSectionPanel} px-4 py-3`}>
                <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={classroomTonePill('sky', 'px-2.5 py-1 text-[11px]')}>
                        {isStudentSelfStudyStage ? '学习成果沉淀' : '课堂交付与复用'}
                      </span>
                      {deliveryLearningModeLabel ? (
                        <span className={classroomTonePill('emerald', 'px-2.5 py-1 text-[11px]')}>
                          {deliveryLearningModeLabel}
                        </span>
                      ) : null}
                      <span className={classroomTonePill('slate', 'px-2.5 py-1 text-[11px] font-medium tracking-normal normal-case')}>
                        {deliveryAudienceLabel}
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        {currentArtifact?.sceneCount ?? scenes.length} 个场景
                      </span>
                      {isStudentSelfStudyStage && savedToGrowth ? (
                        <span className={classroomTonePill('amber', 'px-2.5 py-1 text-[11px] font-medium')}>
                          已进成长档案
                        </span>
                      ) : null}
                      {isStudentSelfStudyStage && savedToFavorites ? (
                        <span className={classroomTonePill('sky', 'px-2.5 py-1 text-[11px] font-medium')}>
                          已收进课堂灵感
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-2.5 flex flex-col gap-2.5 lg:flex-row lg:items-end lg:justify-between">
                      <div className="min-w-0 max-w-3xl">
                        <div className="text-[15px] font-semibold text-slate-900 dark:text-slate-100">
                          {deliveryDockTitle}
                        </div>
                        <div className="mt-1 text-[12px] leading-5 text-slate-600 dark:text-slate-300/85">
                          {deliveryDockDescription}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setDeliveryDockExpanded((current) => !current)}
                        className={`${classroomOutlineButton('slate')} inline-flex items-center justify-center whitespace-nowrap px-3 py-2 text-[12px]`}
                        aria-expanded={deliveryDockExpanded}
                      >
                        {detailToggleLabel}
                      </button>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {deliveryDockQuickFacts.map((item) => (
                        <div
                          key={item.label}
                          className={`${classroomInsetPanel} min-w-[150px] flex-1 rounded-[20px] px-3 py-2.5`}
                        >
                          <div className="text-[10px] font-semibold tracking-[0.08em] text-slate-500 dark:text-slate-400">
                            {item.label}
                          </div>
                          <div className="mt-1 text-[13px] font-semibold text-slate-900 dark:text-slate-100">
                            {item.value}
                          </div>
                          <div className="mt-0.5 text-[11px] leading-5 text-slate-500 dark:text-slate-400">
                            {item.helper}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="w-full xl:max-w-[392px]">
                    <div className={`${classroomInsetPanel} px-3.5 py-3`}>
                      <div className="text-[10px] font-semibold tracking-[0.12em] text-slate-500 dark:text-slate-400">
                        {deliveryDockActionHeading}
                      </div>
                      <div className="mt-1 text-[13px] font-semibold text-slate-900 dark:text-slate-100">
                        {isStudentSelfStudyStage ? '把这节课接回学生成长记录' : '把这节课接回教学反馈'}
                      </div>
                      <div className="mt-1 text-[11px] leading-5 text-slate-600 dark:text-slate-300/85">
                        {deliveryDockActionHint}
                      </div>
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {isStudentSelfStudyStage ? (
                          <>
                            <Link
                              href="/student/growth"
                              onClick={() => {
                                markSaved(stage.id, 'growth');
                              }}
                              className={`${classroomPrimaryButton} inline-flex items-center justify-center px-3 py-2 text-[12px]`}
                            >
                              {savedToGrowth ? '查看成长档案' : '沉淀到成长档案'}
                            </Link>
                            <Link
                              href="/student/favorites"
                              onClick={() => {
                                markSaved(stage.id, 'favorites');
                              }}
                              className={`${classroomOutlineButton('sky')} inline-flex items-center justify-center px-3 py-2 text-[12px]`}
                            >
                              {savedToFavorites ? '查看课堂灵感' : '收进课堂灵感'}
                            </Link>
                            <Link
                              href={
                                currentArtifact?.followUpHref ||
                                currentArtifact?.studentLaunchHref ||
                                '/student/interactive-classroom'
                              }
                              className={`${classroomOutlineButton('amber')} inline-flex items-center justify-center px-3 py-2 text-[12px]`}
                            >
                              {followUpLabel ? `切到${followUpLabel}` : '继续下一模式'}
                            </Link>
                          </>
                        ) : (
                          <>
                            {classroomMeta.publishedUrl ? (
                              <a
                                href={classroomMeta.publishedUrl}
                                target="_blank"
                                rel="noreferrer"
                                className={`${classroomPrimaryButton} inline-flex items-center justify-center px-3 py-2 text-[12px]`}
                              >
                                打开全班观看
                              </a>
                            ) : null}
                            <Link
                              href="/teacher/ai-tools"
                              className={`${classroomOutlineButton('sky')} inline-flex items-center justify-center px-3 py-2 text-[12px]`}
                            >
                              去教师课堂工具
                            </Link>
                            <Link
                              href="/school/interactive-classrooms"
                              className={`${classroomOutlineButton('amber')} inline-flex items-center justify-center px-3 py-2 text-[12px]`}
                            >
                              查看课堂质量
                            </Link>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {deliveryDockExpanded ? (
                  <div className="mt-3 border-t border-slate-200/70 pt-3 dark:border-slate-800/70">
                    <div className="text-[10px] font-semibold tracking-[0.12em] text-slate-500 dark:text-slate-400">
                      {detailSummaryHeading}
                    </div>
                    <div className="mt-2.5 grid gap-2 lg:grid-cols-2">
                      <div className={`${classroomInsetPanel} px-3 py-2.5`}>
                        <div className="text-[10px] font-semibold tracking-[0.08em] text-slate-500 dark:text-slate-400">
                          {isStudentSelfStudyStage ? '课堂内容' : '交付能力'}
                        </div>
                        <div className="mt-1 text-[13px] font-semibold text-slate-900 dark:text-slate-100">
                          {isStudentSelfStudyStage
                            ? `已生成 ${currentArtifact?.sceneCount ?? scenes.length} 个场景`
                            : exportFormatsLabel}
                        </div>
                        <div className="mt-0.5 text-[11px] leading-5 text-slate-500 dark:text-slate-400">
                          {isStudentSelfStudyStage
                            ? '支持继续观看、全班发布与导出课件。'
                            : '适合整班投屏、课件流转、归档和课后复用。'}
                        </div>
                      </div>
                      <div className={`${classroomInsetPanel} px-3 py-2.5`}>
                        <div className="text-[10px] font-semibold tracking-[0.08em] text-slate-500 dark:text-slate-400">
                          {isStudentSelfStudyStage ? '最近更新' : '最近交付'}
                        </div>
                        <div className="mt-1 text-[13px] font-semibold text-slate-900 dark:text-slate-100">
                          {isStudentSelfStudyStage
                            ? currentArtifact?.updatedAt
                              ? formatStudentSelfStudyArtifactTime(currentArtifact.updatedAt)
                              : '刚刚完成'
                            : latestDeliveryTimeLabel || '还没有交付记录'}
                        </div>
                        <div className="mt-0.5 text-[11px] leading-5 text-slate-500 dark:text-slate-400">
                          {isStudentSelfStudyStage
                            ? '现在适合顺手回收到成长档案或学生启动页。'
                            : latestDeliveryFormatLabel
                              ? `最近一次动作：${latestDeliveryFormatLabel}`
                              : '顶部交付入口已固定，可直接完成发布与导出。'}
                        </div>
                      </div>
                    </div>
                    <div className={`${classroomToneCard(isStudentSelfStudyStage ? 'sky' : 'emerald')} mt-2.5 px-3 py-2.5 text-[11px] leading-5.5 ${isStudentSelfStudyStage ? 'text-sky-800 dark:text-sky-200' : 'text-emerald-800 dark:text-emerald-200'}`}>
                      {isStudentSelfStudyStage
                        ? '课堂完成后不要只停在“看过了”。把结果回收到成长档案、课堂灵感和下一轮学习模式，学生的使用闭环才会真的成立。'
                        : [
                            classroomContextLabel || null,
                            teacherDisplayName ? `主讲：${teacherDisplayName}` : null,
                            classroomMeta.publishedUrl ? '已经生成班级观看入口，可直接用于投屏和分享。' : '班级观看入口尚未发布，可在顶部一键完成。',
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}
      </MediaStageProvider>
    </ThemeProvider>
  );
}

'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  PanelLeftClose,
  PieChart,
  Cpu,
  MousePointer2,
  BookOpen,
  Globe,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ClassroomBrand } from '@/components/brand/classroom-brand';
import { ThumbnailSlide } from '@/components/slide-renderer/components/ThumbnailSlide';
import { useStageStore, useCanvasStore } from '@/lib/store';
import { useI18n } from '@/lib/hooks/use-i18n';
import type { SceneType, SlideContent } from '@/lib/types/stage';
import { PENDING_SCENE_ID } from '@/lib/store/stage';
import {
  classroomIconButton,
  classroomToneCard,
  classroomToneIconBadge,
  classroomTonePill,
} from '@/lib/ui/classroom-theme';

interface SceneSidebarProps {
  readonly collapsed: boolean;
  readonly onCollapseChange: (collapsed: boolean) => void;
  readonly onSceneSelect?: (sceneId: string) => void;
  readonly onRetryOutline?: (outlineId: string) => Promise<void>;
}

const DEFAULT_WIDTH = 172;
const MIN_WIDTH = 144;
const MAX_WIDTH = 272;

const SCENE_TYPE_LABELS: Record<SceneType, string> = {
  slide: '讲解',
  quiz: '测验',
  interactive: '互动',
  pbl: '项目',
};

export function SceneSidebar({
  collapsed,
  onCollapseChange,
  onSceneSelect,
  onRetryOutline,
}: SceneSidebarProps) {
  const { t } = useI18n();
  const router = useRouter();
  const { scenes, currentSceneId, setCurrentSceneId, generatingOutlines, generationStatus } =
    useStageStore();
  const failedOutlines = useStageStore.use.failedOutlines();
  const viewportSize = useCanvasStore.use.viewportSize();
  const viewportRatio = useCanvasStore.use.viewportRatio();

  const [retryingOutlineId, setRetryingOutlineId] = useState<string | null>(null);

  const handleRetryOutline = async (outlineId: string) => {
    if (!onRetryOutline) return;
    setRetryingOutlineId(outlineId);
    try {
      await onRetryOutline(outlineId);
    } finally {
      setRetryingOutlineId(null);
    }
  };

  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_WIDTH);
  const isDraggingRef = useRef(false);

  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDraggingRef.current = true;
      const startX = e.clientX;
      const startWidth = sidebarWidth;

      const handleMouseMove = (me: MouseEvent) => {
        const delta = me.clientX - startX;
        const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + delta));
        setSidebarWidth(newWidth);
      };

      const handleMouseUp = () => {
        isDraggingRef.current = false;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [sidebarWidth],
  );

  const getSceneTypeIcon = (type: SceneType) => {
    const icons = {
      slide: BookOpen,
      quiz: PieChart,
      interactive: MousePointer2,
      pbl: Cpu,
    };
    return icons[type] || BookOpen;
  };

  const displayWidth = collapsed ? 0 : sidebarWidth;
  const totalSceneCount = scenes.length;
  const sidebarStatusLabel =
    failedOutlines.length > 0
      ? `待重试 ${failedOutlines.length} 页`
      : generatingOutlines.length > 0
        ? `生成中 ${generatingOutlines.length} 页`
        : totalSceneCount > 0
          ? '目录已就绪'
          : '等待课堂内容';

  return (
    <div
      style={{
        width: displayWidth,
        transition: isDraggingRef.current ? 'none' : 'width 0.3s ease',
      }}
      className="border-r border-sky-100/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(244,249,255,0.88))] shadow-[2px_0_24px_rgba(56,189,248,0.05)] backdrop-blur-xl flex flex-col shrink-0 z-20 relative overflow-visible dark:border-slate-800 dark:bg-slate-900/80"
    >
      {/* Drag handle */}
      {!collapsed && (
        <div
          onMouseDown={handleDragStart}
          className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize z-50 group hover:bg-sky-400/30 dark:hover:bg-sky-600/30 active:bg-sky-500/40 dark:active:bg-sky-500/40 transition-colors"
        >
          <div className="absolute right-0.5 top-1/2 -translate-y-1/2 w-0.5 h-8 rounded-full bg-gray-300 dark:bg-gray-600 group-hover:bg-sky-400 dark:group-hover:bg-sky-500 transition-colors" />
        </div>
      )}

      <div className={cn('flex flex-col w-full h-full overflow-hidden', collapsed && 'hidden')}>
        {/* Logo Header */}
        <div className="relative mt-2 mb-1 flex min-h-[46px] shrink-0 items-center justify-between px-2.5">
          <button
            onClick={() => router.push('/')}
            className="flex min-w-0 items-center gap-2 cursor-pointer rounded-xl px-1.5 -mx-1.5 py-1 -my-1 hover:bg-gray-100/80 dark:hover:bg-gray-800/60 active:scale-[0.97] transition-all duration-150"
            title={t('generation.backToHome')}
          >
            <ClassroomBrand size="sm" showSubtitle={false} className="min-w-0" />
          </button>
          <button
            onClick={() => onCollapseChange(true)}
            className={cn(classroomIconButton, 'h-7 w-7 shrink-0 rounded-lg active:scale-90')}
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>

        <div className="px-2.5 pb-2">
          <div className={cn(classroomToneCard('slate', 'grid gap-2 px-3 py-2.5'))}>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[11px] font-semibold tracking-[0.12em] text-slate-500 dark:text-slate-400">
                  课堂目录
                </div>
                <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {totalSceneCount > 0 ? `共 ${totalSceneCount} 页内容` : '课堂内容准备中'}
                </div>
              </div>
              <span
                className={classroomTonePill(
                  failedOutlines.length > 0 ? 'amber' : generatingOutlines.length > 0 ? 'sky' : 'emerald',
                  'px-2 py-0.5 text-[10px] font-medium tracking-normal normal-case',
                )}
                >
                  {sidebarStatusLabel}
                </span>
              </div>
            <div className="text-[11px] leading-5 text-slate-500 dark:text-slate-400">
              点击缩略图可快速切换课堂页面，拖拽边缘可调整目录宽度。
            </div>
          </div>
        </div>

        {/* Scenes List */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 space-y-2 scrollbar-hide pt-1">
          {scenes.map((scene, index) => {
            const isActive = currentSceneId === scene.id;
            const Icon = getSceneTypeIcon(scene.type);
            const isSlide = scene.type === 'slide';
            const slideContent = isSlide ? (scene.content as SlideContent) : null;
            const sceneTypeLabel = SCENE_TYPE_LABELS[scene.type] ?? scene.type;
            const sceneMetaLabel =
              scene.actions?.length && scene.actions.length > 0
                ? `${scene.actions.length} 个课堂动作`
                : '课堂内容已就绪';

            return (
              <div
                key={scene.id}
                onClick={() => {
                  if (onSceneSelect) {
                    onSceneSelect(scene.id);
                  } else {
                    setCurrentSceneId(scene.id);
                  }
                }}
                className={cn(
                  'group relative flex cursor-pointer flex-col gap-1.5 rounded-[18px] border p-2 transition-all duration-200',
                  isActive
                    ? 'border-sky-200/90 bg-sky-50/88 shadow-[0_12px_24px_rgba(14,165,233,0.08)] dark:border-sky-800/70 dark:bg-sky-950/24'
                    : 'border-white/60 bg-white/72 hover:-translate-y-[1px] hover:border-sky-100 hover:bg-white/88 dark:border-slate-800/70 dark:bg-slate-900/54 dark:hover:border-slate-700 dark:hover:bg-slate-900/72',
                )}
              >
                {/* Scene Header */}
                <div className="flex items-start justify-between gap-2 px-1 pt-0.5">
                  <div className="flex max-w-full min-w-0 items-start gap-2">
                    <span
                      className={cn(
                        'text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center shrink-0',
                        isActive
                          ? classroomToneIconBadge(
                              'sky',
                              'h-4 w-4 border border-sky-200/80 bg-white text-[10px] font-black text-sky-700 shadow-sm shadow-sky-200/50 dark:border-sky-500/30 dark:bg-sky-500/18 dark:text-sky-100 dark:shadow-sky-900/20',
                            )
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400',
                      )}
                    >
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <div
                        className={cn(
                          'truncate text-xs font-bold transition-colors',
                          isActive
                            ? 'text-sky-700 dark:text-sky-300'
                            : 'text-gray-600 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-gray-100',
                        )}
                      >
                        {scene.title}
                      </div>
                      <div className="mt-0.5 truncate text-[10px] leading-4 text-slate-500 dark:text-slate-400">
                        {sceneMetaLabel}
                      </div>
                    </div>
                  </div>
                  <span
                    className={classroomTonePill(
                      isActive ? 'sky' : 'slate',
                      'px-2 py-0.5 text-[9px] font-medium tracking-normal normal-case',
                    )}
                  >
                    {sceneTypeLabel}
                  </span>
                </div>

                {/* Thumbnail */}
                <div className="relative aspect-video w-full overflow-hidden rounded-[14px] bg-gray-100 ring-1 ring-black/5 dark:bg-gray-800 dark:ring-white/5">
                  <div className="absolute inset-0 flex items-center justify-center">
                    {isSlide && slideContent ? (
                      <ThumbnailSlide
                        slide={slideContent.canvas}
                        viewportSize={viewportSize}
                        viewportRatio={viewportRatio}
                        size={Math.max(100, sidebarWidth - 28)}
                      />
                    ) : scene.type === 'quiz' ? (
                      /* Quiz: question bar + 2x2 option grid */
                      <div className="w-full h-full bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/20 p-2 flex flex-col">
                        <div className="h-1.5 w-4/5 bg-orange-200/70 dark:bg-orange-700/30 rounded-full mb-1.5" />
                        <div className="flex-1 grid grid-cols-2 gap-1">
                          {[0, 1, 2, 3].map((i) => (
                            <div
                              key={i}
                              className={cn(
                                'rounded flex items-center gap-1 px-1',
                                i === 1
                                  ? 'bg-orange-400/20 dark:bg-orange-500/20 border border-orange-300/50 dark:border-orange-600/30'
                                  : 'bg-white/60 dark:bg-white/5 border border-orange-100/60 dark:border-orange-800/20',
                              )}
                            >
                              <div
                                className={cn(
                                  'w-1.5 h-1.5 rounded-full shrink-0',
                                  i === 1
                                    ? 'bg-orange-400 dark:bg-orange-500'
                                    : 'bg-orange-200 dark:bg-orange-700/50',
                                )}
                              />
                              <div
                                className={cn(
                                  'h-1 rounded-full flex-1',
                                  i === 1
                                    ? 'bg-orange-300/60 dark:bg-orange-600/40'
                                    : 'bg-orange-100/80 dark:bg-orange-800/30',
                                )}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : scene.type === 'interactive' ? (
                      /* Interactive: browser window with chrome + content */
                      <div className="w-full h-full bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/20 p-1.5 flex flex-col">
                        <div className="flex items-center gap-1 mb-1 pb-1 border-b border-emerald-200/40 dark:border-emerald-700/20">
                          <div className="flex gap-0.5">
                            <div className="w-1 h-1 rounded-full bg-red-300 dark:bg-red-500/60" />
                            <div className="w-1 h-1 rounded-full bg-amber-300 dark:bg-amber-500/60" />
                            <div className="w-1 h-1 rounded-full bg-green-300 dark:bg-green-500/60" />
                          </div>
                          <div className="h-1.5 flex-1 bg-emerald-200/40 dark:bg-emerald-700/30 rounded-full ml-0.5" />
                        </div>
                        <div className="flex-1 flex gap-1">
                          <div className="w-1/4 space-y-1 pt-0.5">
                            {[1, 2, 3].map((i) => (
                              <div
                                key={i}
                                className="h-0.5 w-full bg-emerald-200/60 dark:bg-emerald-700/30 rounded-full"
                              />
                            ))}
                          </div>
                          <div className="flex-1 bg-emerald-100/40 dark:bg-emerald-800/20 rounded flex items-center justify-center border border-emerald-200/40 dark:border-emerald-700/20">
                            <Globe className="w-4 h-4 text-emerald-300/80 dark:text-emerald-600/50" />
                          </div>
                        </div>
                      </div>
                    ) : scene.type === 'pbl' ? (
                      /* PBL: kanban board with 3 columns */
                      <div className="w-full h-full bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/20 p-1.5 flex flex-col">
                        <div className="flex items-center gap-1 mb-1.5">
                          <div className="w-1.5 h-1.5 rounded bg-blue-300 dark:bg-blue-600" />
                          <div className="h-1 w-8 bg-blue-200/60 dark:bg-blue-700/30 rounded-full" />
                        </div>
                        <div className="flex-1 flex gap-1 overflow-hidden">
                          {[0, 1, 2].map((col) => (
                            <div
                              key={col}
                              className="flex-1 bg-white/50 dark:bg-white/5 rounded p-0.5 flex flex-col gap-0.5"
                            >
                              <div
                                className={cn(
                                  'h-0.5 w-3 rounded-full mb-0.5',
                                  col === 0
                                    ? 'bg-blue-300/70'
                                    : col === 1
                                      ? 'bg-amber-300/70'
                                      : 'bg-green-300/70',
                                )}
                              />
                              {Array.from({
                                length: col === 0 ? 3 : col === 1 ? 2 : 1,
                              }).map((_, i) => (
                                <div
                                  key={i}
                                  className="h-2 w-full bg-blue-100/60 dark:bg-blue-800/20 rounded border border-blue-200/30 dark:border-blue-700/20"
                                />
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      /* Fallback */
                      <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-gray-50 text-gray-300 dark:bg-gray-800 dark:text-gray-500">
                        <Icon className="w-4 h-4" />
                        <span className="text-[9px] font-bold uppercase tracking-wider opacity-80">
                          {scene.type}
                        </span>
                      </div>
                    )}

                    {isSlide && (
                      <div
                        className={cn(
                          'absolute inset-0 bg-sky-500/0 transition-colors',
                          isActive
                            ? 'bg-sky-500/0'
                            : 'group-hover:bg-black/5 dark:group-hover:bg-white/5',
                        )}
                      />
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Single placeholder for the next generating page (clickable) */}
          {generatingOutlines.length > 0 &&
            (() => {
              const outline = generatingOutlines[0];
              const isFailed = failedOutlines.some((f) => f.id === outline.id);
              const isRetrying = retryingOutlineId === outline.id;
              const isPaused = generationStatus === 'paused';
              const isActive = currentSceneId === PENDING_SCENE_ID;

              return (
                <div
                  key={`generating-${outline.id}`}
                  onClick={() => {
                    if (isFailed) return;
                    if (onSceneSelect) {
                      onSceneSelect(PENDING_SCENE_ID);
                    } else {
                      setCurrentSceneId(PENDING_SCENE_ID);
                    }
                  }}
                  className={cn(
                    'group relative flex flex-col gap-1.5 rounded-[18px] border p-2 transition-all duration-200',
                    isFailed
                      ? 'border-amber-100/80 bg-amber-50/34 cursor-default opacity-100 dark:border-amber-900/20 dark:bg-amber-950/10'
                      : 'border-white/60 bg-white/72 cursor-pointer hover:-translate-y-[1px] hover:border-sky-100 hover:bg-white/88 dark:border-slate-800/70 dark:bg-slate-900/54 dark:hover:border-slate-700 dark:hover:bg-slate-900/72',
                    !isFailed && !isActive && 'opacity-60',
                    isActive &&
                      !isFailed &&
                      'border-sky-200/90 bg-sky-50/88 shadow-[0_12px_24px_rgba(14,165,233,0.08)] dark:border-sky-800/70 dark:bg-sky-950/24 opacity-100',
                  )}
                >
                  {/* Scene Header */}
                  <div className="flex items-start justify-between gap-2 px-1 pt-0.5">
                    <div className="flex max-w-full min-w-0 items-start gap-2">
                      <span
                        className={cn(
                        'text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center shrink-0',
                        isActive && !isFailed
                            ? 'border border-sky-200/80 bg-white text-sky-700 shadow-sm shadow-sky-200/60 dark:border-sky-500/30 dark:bg-sky-500/18 dark:text-sky-100 dark:shadow-sky-900/20'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500',
                        )}
                      >
                        {scenes.length + 1}
                      </span>
                      <div className="min-w-0">
                        <div
                          className={cn(
                            'truncate text-xs font-bold transition-colors',
                            isActive && !isFailed
                              ? 'text-sky-700 dark:text-sky-300'
                              : isFailed
                                ? 'text-gray-700 dark:text-gray-200'
                                : 'text-gray-400 dark:text-gray-500',
                          )}
                        >
                          {outline.title}
                        </div>
                        <div className="mt-0.5 truncate text-[10px] leading-4 text-slate-500 dark:text-slate-400">
                          {isFailed ? t('stage.generationFailed') : isPaused ? t('stage.paused') : t('stage.generating')}
                        </div>
                      </div>
                    </div>
                    <span
                      className={classroomTonePill(
                        isFailed ? 'amber' : 'sky',
                        'px-2 py-0.5 text-[9px] font-medium tracking-normal normal-case',
                      )}
                    >
                      {isFailed ? '待修复' : '编排中'}
                    </span>
                  </div>

                  {/* Skeleton Thumbnail */}
                  <div
                    className={cn(
                      'relative aspect-video w-full overflow-hidden rounded-[14px] ring-1',
                      isFailed
                        ? 'bg-red-50/30 dark:bg-red-950/10 ring-red-100 dark:ring-red-900/20'
                        : 'bg-gray-100 dark:bg-gray-800 ring-black/5 dark:ring-white/5',
                    )}
                  >
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
                      {isFailed ? (
                        <div className="flex items-center gap-1 text-xs font-medium text-red-500/90 dark:text-red-400">
                          {onRetryOutline ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRetryOutline(outline.id);
                              }}
                              disabled={isRetrying}
                              className="p-1 -ml-1 rounded-md hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors active:scale-95 disabled:opacity-50 disabled:active:scale-100"
                              title={t('generation.retryScene')}
                            >
                              <RefreshCw
                                className={cn('w-3.5 h-3.5', isRetrying && 'animate-spin')}
                              />
                            </button>
                          ) : (
                            <AlertCircle className="w-3.5 h-3.5" />
                          )}
                          <span>
                            {isRetrying
                              ? t('generation.retryingScene')
                              : t('stage.generationFailed')}
                          </span>
                        </div>
                      ) : (
                        <>
                          <div
                            className={cn(
                              'h-2 w-3/5 bg-gray-200 dark:bg-gray-700 rounded',
                              !isPaused && 'animate-pulse',
                            )}
                          />
                          <div
                            className={cn(
                              'h-1.5 w-2/5 bg-gray-200 dark:bg-gray-700 rounded',
                              !isPaused && 'animate-pulse',
                            )}
                          />
                          <span className="text-[9px] font-medium text-gray-400 dark:text-gray-500 mt-0.5">
                            {isPaused ? t('stage.paused') : t('stage.generating')}
                          </span>
                        </>
                      )}
                    </div>
                    {!isFailed && !isPaused && (
                      <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/40 dark:via-white/10 to-transparent" />
                    )}
                  </div>
                </div>
              );
            })()}
        </div>

        {/* Spacer to push toggle button area */}
        <div className="mt-auto" />
      </div>
    </div>
  );
}

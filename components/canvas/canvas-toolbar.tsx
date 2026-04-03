'use client';

import {
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  LayoutList,
  MessageSquare,
  Volume1,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  SlidersHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStageStore } from '@/lib/store';
import { useI18n } from '@/lib/hooks/use-i18n';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export interface CanvasToolbarProps {
  readonly currentSceneIndex: number;
  readonly scenesCount: number;
  readonly engineState: 'idle' | 'playing' | 'paused';
  readonly audienceMode?: boolean;
  readonly isLiveSession?: boolean;
  readonly whiteboardOpen: boolean;
  readonly sidebarCollapsed?: boolean;
  readonly chatCollapsed?: boolean;
  readonly onToggleSidebar?: () => void;
  readonly onToggleChat?: () => void;
  readonly immersiveMode?: boolean;
  readonly immersiveDisabled?: boolean;
  readonly onToggleImmersive?: () => void;
  readonly onPrevSlide: () => void;
  readonly onNextSlide: () => void;
  readonly onPlayPause: () => void;
  readonly onWhiteboardClose: () => void;
  readonly showStopDiscussion?: boolean;
  readonly onStopDiscussion?: () => void;
  readonly className?: string;
  // Audio/playback controls
  readonly ttsEnabled?: boolean;
  readonly ttsMuted?: boolean;
  readonly ttsVolume?: number;
  readonly narrationModeLabel?: string;
  readonly narrationHint?: string;
  readonly narrationTone?: 'accent' | 'warning' | 'neutral';
  readonly onToggleMute?: () => void;
  readonly onVolumeChange?: (volume: number) => void;
  readonly autoPlayLecture?: boolean;
  readonly onToggleAutoPlay?: () => void;
  readonly playbackSpeed?: number;
  readonly onCycleSpeed?: () => void;
}

/* Compact control button */
const ctrlBtn = cn(
  'relative h-8 w-8 rounded-[12px] flex items-center justify-center',
  'transition-all duration-150 outline-none cursor-pointer',
  'hover:bg-sky-50 dark:hover:bg-slate-800 active:scale-95',
);

/* Subtle separator */
function CtrlDivider() {
  return <div className="mx-0.5 h-4 w-px shrink-0 bg-slate-200/80 dark:bg-slate-700/70" />;
}

/* Volume icon based on level */
function VolumeIcon({
  muted,
  volume,
  disabled,
}: {
  muted: boolean;
  volume: number;
  disabled: boolean;
}) {
  const cls = 'w-3.5 h-3.5';
  if (disabled || muted || volume === 0) return <VolumeX className={cls} />;
  if (volume < 0.5) return <Volume1 className={cls} />;
  return <Volume2 className={cls} />;
}

export function CanvasToolbar({
  currentSceneIndex,
  scenesCount,
  engineState,
  audienceMode,
  isLiveSession,
  whiteboardOpen,
  sidebarCollapsed,
  chatCollapsed,
  onToggleSidebar,
  onToggleChat,
  immersiveMode,
  immersiveDisabled,
  onToggleImmersive,
  onPrevSlide,
  onNextSlide,
  onPlayPause,
  onWhiteboardClose,
  showStopDiscussion,
  onStopDiscussion,
  className,
  ttsEnabled,
  ttsMuted,
  ttsVolume = 1,
  narrationModeLabel,
  narrationHint,
  narrationTone = 'neutral',
  onToggleMute,
  onVolumeChange,
  autoPlayLecture,
  onToggleAutoPlay,
  playbackSpeed = 1,
  onCycleSpeed,
}: CanvasToolbarProps) {
  const { t } = useI18n();
  const canGoPrev = currentSceneIndex > 0;
  const canGoNext = currentSceneIndex < scenesCount - 1;
  const showPlayPause = !isLiveSession;

  const whiteboardElementCount = useStageStore(
    (s) => s.stage?.whiteboard?.[0]?.elements?.length || 0,
  );

  // Effective volume for display
  const effectiveVolume = ttsMuted ? 0 : ttsVolume;
  const sidebarLabel = sidebarCollapsed ? t('roundtable.openSidebar') : t('roundtable.closeSidebar');
  const chatLabel = chatCollapsed ? t('roundtable.openChat') : t('roundtable.closeChat');
  const playPauseLabel = engineState === 'playing' ? t('roundtable.pause') : t('roundtable.play');
  const immersiveLabel = immersiveMode ? t('roundtable.exitImmersive') : t('roundtable.enterImmersive');
  const toolsActive =
    !!whiteboardOpen || !!ttsMuted || playbackSpeed !== 1 || !!autoPlayLecture || effectiveVolume < 0.999;
  const showToolsMenu = !!(onToggleMute || onCycleSpeed || onToggleAutoPlay || !audienceMode);
  const narrationToneClass =
    narrationTone === 'accent'
      ? 'bg-sky-50 text-sky-600 dark:bg-sky-950/30 dark:text-sky-300'
      : narrationTone === 'warning'
        ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300'
        : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300';

  return (
    <div className={cn('flex min-w-0 items-center gap-2', className)}>
      {/* ── Left: sidebar toggle + page indicator ── */}
      <div className="flex shrink-0 items-center gap-2 pl-1">
        {onToggleSidebar && !audienceMode && (
          <button
            onClick={onToggleSidebar}
            className={cn(
              ctrlBtn,
              'h-7 w-7',
              sidebarCollapsed
                ? 'text-slate-400 dark:text-slate-500'
                : 'text-slate-600 dark:text-slate-200',
            )}
            aria-label={sidebarLabel}
            title={sidebarLabel}
          >
            <LayoutList className="w-3.5 h-3.5" />
          </button>
        )}
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/86 px-2.5 py-1 text-[11px] font-semibold text-slate-600 shadow-[0_8px_18px_rgba(15,23,42,0.05)] dark:border-slate-700/80 dark:bg-slate-900/78 dark:text-slate-200">
          <span className="tracking-[0.16em] text-slate-400 dark:text-slate-500">课页</span>
          <span className="tabular-nums text-slate-800 dark:text-slate-100">
            {currentSceneIndex + 1}
            <span className="mx-1 text-slate-300 dark:text-slate-600">/</span>
            {scenesCount}
          </span>
        </div>
      </div>

      {/* ── Center: unified playback controls ── */}
      <div className="flex-1 flex items-center justify-center min-w-0">
        <div className="inline-flex min-w-0 items-center gap-1 rounded-[18px] border border-white/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(246,249,252,0.9))] px-1.5 py-1 shadow-[0_12px_24px_rgba(15,23,42,0.05)] backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-900/74">
          {/* Secondary controls menu */}
          {showToolsMenu && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    ctrlBtn,
                    'h-8 w-auto gap-1.5 rounded-[12px] px-2.5 text-[11px] font-semibold',
                    toolsActive
                      ? 'bg-sky-500/10 text-sky-700 dark:bg-sky-400/10 dark:text-sky-300'
                      : 'text-slate-500 dark:text-slate-300',
                  )}
                  aria-label={t('roundtable.tools')}
                  title={t('roundtable.toolsHint')}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">{t('roundtable.tools')}</span>
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="center" className="w-64 min-w-[16rem] rounded-xl p-2">
                <DropdownMenuLabel>{t('roundtable.tools')}</DropdownMenuLabel>

                {(onToggleMute || onVolumeChange) && (
                  <>
                    <div className="rounded-lg px-2 py-2">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <div
                            className={cn(
                              'flex h-7 w-7 items-center justify-center rounded-full',
                              !ttsEnabled
                                ? 'bg-gray-100 text-gray-300 dark:bg-gray-800 dark:text-gray-600'
                                : ttsMuted
                                  ? 'bg-red-50 text-red-500 dark:bg-red-950/30 dark:text-red-400'
                                  : 'bg-sky-50 text-sky-600 dark:bg-sky-950/30 dark:text-sky-400',
                            )}
                          >
                            <VolumeIcon
                              muted={!!ttsMuted}
                              volume={ttsVolume}
                              disabled={!ttsEnabled}
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {t('roundtable.narration')}
                            </p>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400">
                              {!ttsEnabled ? '讲解已关闭' : narrationModeLabel || t('roundtable.volume')}
                            </p>
                          </div>
                        </div>
                        {onToggleMute && (
                          <button
                            onClick={onToggleMute}
                            disabled={!ttsEnabled}
                            className={cn(
                              'rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors',
                              !ttsEnabled
                                ? 'cursor-not-allowed bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-600'
                                : ttsMuted
                                  ? 'bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-950/30 dark:text-red-300 dark:hover:bg-red-950/50'
                                  : 'bg-sky-50 text-sky-600 hover:bg-sky-100 dark:bg-sky-950/30 dark:text-sky-300 dark:hover:bg-sky-950/50',
                            )}
                          >
                            {ttsMuted ? t('roundtable.narrationOn') : t('roundtable.narrationOff')}
                          </button>
                        )}
                      </div>

                      {onVolumeChange && (
                        <div className="grid gap-2">
                          {narrationHint ? (
                            <div
                              className={cn(
                                'rounded-lg border border-transparent px-2.5 py-2 text-[11px] leading-5',
                                narrationToneClass,
                              )}
                            >
                              {narrationHint}
                            </div>
                          ) : null}
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min={0}
                              max={1}
                              step={0.05}
                              value={effectiveVolume}
                              disabled={!ttsEnabled}
                              onChange={(e) => {
                                const v = parseFloat(e.target.value);
                                onVolumeChange(v);
                                if (v > 0 && ttsMuted) onToggleMute?.();
                              }}
                              className={cn(
                                'h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-gray-200 dark:bg-gray-700',
                                '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5',
                                '[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-sky-500 [&::-webkit-slider-thumb]:shadow-sm',
                                '[&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-sky-500',
                                !ttsEnabled && 'cursor-not-allowed opacity-40',
                              )}
                            />
                            <span className="w-9 text-right text-[11px] font-medium tabular-nums text-gray-500 dark:text-gray-400">
                              {Math.round(effectiveVolume * 100)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                    <DropdownMenuSeparator />
                  </>
                )}

                {onCycleSpeed && (
                  <DropdownMenuItem onSelect={onCycleSpeed}>
                    <span>{t('roundtable.learningRhythm')}</span>
                    <span className="ml-auto text-xs font-medium text-gray-500 dark:text-gray-400">
                      {playbackSpeed === 1.5 ? '1.5x' : `${playbackSpeed}x`}
                    </span>
                  </DropdownMenuItem>
                )}

                {onToggleAutoPlay && !audienceMode && (
                  <DropdownMenuItem onSelect={onToggleAutoPlay}>
                    <span>{autoPlayLecture ? t('roundtable.autoPlayOff') : t('roundtable.autoPlay')}</span>
                    <span className="ml-auto text-xs font-medium text-gray-500 dark:text-gray-400">
                      {autoPlayLecture ? t('roundtable.statusOn') : t('roundtable.statusOff')}
                    </span>
                  </DropdownMenuItem>
                )}

                {!audienceMode && (
                  <DropdownMenuItem
                    onSelect={(event) => {
                      event.preventDefault();
                      onWhiteboardClose();
                    }}
                  >
                    <span>{whiteboardOpen ? t('whiteboard.minimize') : t('whiteboard.open')}</span>
                    {!whiteboardOpen && whiteboardElementCount > 0 ? (
                      <span className="ml-auto inline-flex h-2 w-2 rounded-full bg-sky-500 dark:bg-sky-400" />
                    ) : null}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <CtrlDivider />

          {/* Prev scene */}
          {scenesCount > 1 && (
            <button
              onClick={onPrevSlide}
              disabled={!canGoPrev}
              className={cn(
                ctrlBtn,
                'text-slate-500 dark:text-slate-300 disabled:pointer-events-none disabled:opacity-25',
              )}
              aria-label={t('roundtable.previousScene')}
              title={t('roundtable.previousScene')}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Play / Pause / Stop Discussion */}
          {showStopDiscussion && onStopDiscussion ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onStopDiscussion();
              }}
              className={cn(
                'flex h-8 items-center gap-1.5 rounded-[12px] px-3',
                'bg-red-500/10 text-red-600 dark:bg-red-400/10 dark:text-red-300',
                'text-[11px] font-semibold whitespace-nowrap',
                'hover:bg-red-500/20 dark:hover:bg-red-400/20 active:scale-95 transition-all cursor-pointer',
              )}
              title={t('roundtable.stopDiscussion')}
            >
              <span className="relative flex h-1.5 w-1.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
              </span>
              {t('roundtable.stopDiscussion')}
            </button>
          ) : showPlayPause ? (
            <button
              onClick={onPlayPause}
              className={cn(
                ctrlBtn,
                'h-8 w-8',
                engineState === 'playing'
                  ? 'bg-sky-500/10 text-sky-700 dark:bg-sky-400/10 dark:text-sky-300'
                  : 'text-slate-500 dark:text-slate-300',
              )}
              aria-label={playPauseLabel}
              title={playPauseLabel}
            >
              {engineState === 'playing' ? (
                <Pause className="w-3.5 h-3.5" />
              ) : (
                <Play className="w-3.5 h-3.5 ml-px" />
              )}
            </button>
          ) : null}

          {/* Next scene */}
          {scenesCount > 1 && (
            <button
              onClick={onNextSlide}
              disabled={!canGoNext}
              className={cn(
                ctrlBtn,
                'text-slate-500 dark:text-slate-300 disabled:pointer-events-none disabled:opacity-25',
              )}
              aria-label={t('roundtable.nextScene')}
              title={t('roundtable.nextScene')}
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ── Right: chat toggle ── */}
      <div className="flex shrink-0 items-center justify-end gap-1 pr-1">
        {onToggleImmersive && (
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onToggleImmersive}
                  disabled={immersiveDisabled}
                  className={cn(
                    ctrlBtn,
                    immersiveDisabled
                      ? 'cursor-not-allowed text-slate-300 dark:text-slate-600'
                      : immersiveMode
                        ? 'bg-sky-500/10 text-sky-700 dark:bg-sky-400/10 dark:text-sky-300'
                        : 'text-slate-500 dark:text-slate-300',
                  )}
                  aria-label={immersiveLabel}
                  title={immersiveLabel}
                >
                  {immersiveMode ? (
                    <Minimize2 className="w-3.5 h-3.5" />
                  ) : (
                    <Maximize2 className="w-3.5 h-3.5" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                {immersiveDisabled
                  ? t('roundtable.immersiveBlocked')
                  : immersiveMode
                    ? t('roundtable.exitImmersive')
                    : t('roundtable.enterImmersive')}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {onToggleChat && !audienceMode && (
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onToggleChat}
                  className={cn(
                    ctrlBtn,
                    chatCollapsed
                      ? 'text-slate-400 dark:text-slate-500'
                      : 'text-slate-600 dark:text-slate-200',
                  )}
                  aria-label={chatLabel}
                  title={chatLabel}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                {chatLabel}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </div>
  );
}

'use client';

import { useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SceneRenderer } from '@/components/stage/scene-renderer';
import { SceneProvider } from '@/lib/contexts/scene-context';
import { Whiteboard } from '@/components/whiteboard';
import { CanvasToolbar } from '@/components/canvas/canvas-toolbar';
import type { CanvasToolbarProps } from '@/components/canvas/canvas-toolbar';
import type { Scene, StageMode } from '@/lib/types/stage';
import { useI18n } from '@/lib/hooks/use-i18n';

interface CanvasAreaProps extends CanvasToolbarProps {
  readonly currentScene: Scene | null;
  readonly mode: StageMode;
  readonly hideToolbar?: boolean;
  readonly immersiveHudVisible?: boolean;
  readonly onImmersiveHudHoverChange?: (hovered: boolean) => void;
  readonly onImmersiveHudRevealRequest?: () => void;
  readonly isPendingScene?: boolean;
  readonly isGenerationFailed?: boolean;
  readonly onRetryGeneration?: () => void;
}

export function CanvasArea({
  currentScene,
  currentSceneIndex,
  scenesCount,
  mode,
  engineState,
  audienceMode,
  isLiveSession,
  whiteboardOpen,
  sidebarCollapsed,
  chatCollapsed,
  onToggleSidebar,
  onToggleChat,
  immersiveDisabled,
  onToggleImmersive,
  onPrevSlide,
  onNextSlide,
  onPlayPause,
  onWhiteboardClose,
  showStopDiscussion,
  onStopDiscussion,
  hideToolbar,
  immersiveMode,
  immersiveHudVisible = true,
  onImmersiveHudHoverChange,
  onImmersiveHudRevealRequest,
  ttsEnabled,
  ttsMuted,
  ttsVolume,
  onToggleMute,
  onVolumeChange,
  autoPlayLecture,
  onToggleAutoPlay,
  playbackSpeed,
  onCycleSpeed,
  isPendingScene,
  isGenerationFailed,
  onRetryGeneration,
}: CanvasAreaProps) {
  const { t } = useI18n();
  const showControls = mode === 'playback' && !whiteboardOpen;
  const showPlayHint =
    showControls &&
    engineState !== 'playing' &&
    currentScene?.type === 'slide' &&
    !isLiveSession &&
    !isPendingScene;

  const handleSlideClick = useCallback(
    (e: React.MouseEvent) => {
      if (!showControls || isLiveSession || currentScene?.type !== 'slide') return;
      // Don't trigger page play/pause when clicking inside a video element's visual area.
      // Video elements may be visually covered by other slide elements (e.g. text),
      // so we check click coordinates against all video element bounding rects.
      const container = e.currentTarget as HTMLElement;
      const videoEls = container.querySelectorAll('[data-video-element]');
      for (const el of videoEls) {
        const rect = el.getBoundingClientRect();
        if (
          e.clientX >= rect.left &&
          e.clientX <= rect.right &&
          e.clientY >= rect.top &&
          e.clientY <= rect.bottom
        ) {
          return;
        }
      }
      onPlayPause();
    },
    [showControls, isLiveSession, onPlayPause, currentScene?.type],
  );

  const handleSlideDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!onToggleImmersive || mode !== 'playback' || whiteboardOpen || isPendingScene) return;
      e.stopPropagation();
      onToggleImmersive();
    },
    [isPendingScene, mode, onToggleImmersive, whiteboardOpen],
  );

  const handleImmersiveEdgeReveal = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (
        !immersiveMode ||
        whiteboardOpen ||
        immersiveHudVisible ||
        !onImmersiveHudRevealRequest
      ) {
        return;
      }

      const rect = e.currentTarget.getBoundingClientRect();
      const distanceToBottom = rect.bottom - e.clientY;
      if (distanceToBottom <= 28) {
        onImmersiveHudRevealRequest();
      }
    },
    [immersiveHudVisible, immersiveMode, onImmersiveHudRevealRequest, whiteboardOpen],
  );

  return (
    <div
      onPointerMove={handleImmersiveEdgeReveal}
      className={cn(
        'relative w-full h-full flex flex-col group/canvas',
        immersiveMode
          ? 'bg-black'
          : 'bg-[linear-gradient(180deg,#f8fbff_0%,#f3faf7_100%)] dark:bg-gray-900',
      )}
    >
      {/* Slide area — takes remaining space */}
      <div
        className={cn(
          'flex-1 min-h-0 relative overflow-hidden flex items-center justify-center transition-colors duration-500',
          immersiveMode ? 'p-0' : 'p-1.5 sm:p-2',
          currentScene?.type === 'interactive'
            ? immersiveMode
              ? 'bg-black'
              : 'bg-blue-50/28 dark:bg-blue-900/10'
            : immersiveMode
              ? 'bg-black'
              : 'bg-transparent',
        )}
      >
        <div
          className={cn(
            'aspect-[16/9] h-full max-h-full max-w-full bg-white dark:bg-gray-800 overflow-hidden relative transition-all duration-700',
            immersiveMode
              ? 'rounded-none shadow-none ring-0'
              : 'rounded-[22px] shadow-[0_18px_56px_rgba(15,23,42,0.09)] ring-1 ring-sky-100/80 dark:shadow-[0_16px_48px_rgba(0,0,0,0.28)] dark:ring-white/5',
            showControls && !isLiveSession && currentScene?.type === 'slide' && 'cursor-pointer',
            currentScene?.type === 'interactive'
              ? immersiveMode
                ? 'bg-black'
                : 'shadow-blue-200/50 dark:shadow-blue-900/50 ring-1 ring-blue-900/5 dark:ring-blue-500/10'
              : null,
          )}
          onClick={handleSlideClick}
          onDoubleClick={handleSlideDoubleClick}
        >
          {/* Whiteboard Layer */}
          <div className="absolute inset-0 z-[110] pointer-events-none">
            <SceneProvider>
              <Whiteboard isOpen={whiteboardOpen} onClose={onWhiteboardClose} />
            </SceneProvider>
          </div>

          {/* Scene Content */}
          {currentScene && !whiteboardOpen && (
            <div className="absolute inset-0">
              <SceneProvider>
                <SceneRenderer scene={currentScene} mode={mode} />
              </SceneProvider>
            </div>
          )}

          {/* Pending Scene Loading Overlay */}
          <AnimatePresence>
            {isPendingScene && !currentScene && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                className="absolute inset-0 z-[105] flex flex-col items-center justify-center bg-white dark:bg-gray-800"
              >
                {isGenerationFailed ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
                      <svg
                        className="w-6 h-6 text-red-400 dark:text-red-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                        />
                      </svg>
                    </div>
                    <span className="text-sm text-red-500 dark:text-red-400 font-medium">
                      {t('stage.generationFailed')}
                    </span>
                    {onRetryGeneration && (
                      <button
                        onClick={onRetryGeneration}
                        className="mt-1 px-4 py-1.5 text-xs font-medium rounded-full bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors active:scale-95"
                      >
                        {t('generation.retryScene')}
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-4">
                    {/* Spinner */}
                    <div className="relative w-12 h-12">
                      <div className="absolute inset-0 rounded-full border-2 border-gray-100 dark:border-gray-700" />
                      <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-sky-500 dark:border-t-sky-400 animate-spin" />
                    </div>
                    {/* Text */}
                    <motion.span
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2, duration: 0.3 }}
                      className="text-sm text-gray-400 dark:text-gray-500 font-medium"
                    >
                      {t('stage.generatingNextPage')}
                    </motion.span>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Scene Number Badge */}
          {currentScene && !immersiveMode && (
            <div className="absolute right-3 top-3 pointer-events-none select-none text-[30px] font-black text-slate-200/72 mix-blend-multiply dark:text-gray-700 dark:mix-blend-screen">
              {(currentSceneIndex + 1).toString().padStart(2, '0')}
            </div>
          )}

          {/* Play hint — breathing button when idle or paused (slides only) */}
          <AnimatePresence>
            {showPlayHint && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="absolute inset-0 z-[102] flex items-center justify-center pointer-events-none"
              >
                <motion.div
                  className="opacity-50 group-hover/canvas:opacity-100 transition-opacity duration-300 pointer-events-auto cursor-pointer"
                  exit={{ pointerEvents: 'none' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onPlayPause();
                  }}
                >
                  <motion.div
                    initial={{ scale: 0.85 }}
                    animate={{ scale: [1, 1.06] }}
                    exit={{ scale: 1.15, opacity: 0 }}
                    transition={{
                      default: { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
                      scale: {
                        repeat: Infinity,
                        repeatType: 'mirror',
                        duration: 1,
                        ease: 'easeInOut',
                      },
                    }}
                    className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-white/95 shadow-[0_6px_28px_rgba(14,165,233,0.16),inset_0_0_0_1px_rgba(186,230,253,0.72)] dark:bg-gray-800/95 dark:shadow-[0_6px_28px_rgba(14,165,233,0.24),inset_0_0_0_1px_rgba(14,165,233,0.32)]"
                    style={{ willChange: 'transform' }}
                  >
                    <Play className="ml-0.5 h-6 w-6 fill-sky-500/90 text-sky-600 dark:fill-sky-300/90 dark:text-sky-300" />
                  </motion.div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Canvas Toolbar — in document flow, only when not merged into roundtable ── */}
      {!hideToolbar && (
        <div
          onMouseEnter={() => onImmersiveHudHoverChange?.(true)}
          onMouseLeave={() => onImmersiveHudHoverChange?.(false)}
          className={cn(
            'shrink-0 transition-all duration-300 ease-out',
            immersiveMode && !immersiveHudVisible && 'opacity-0 translate-y-2 pointer-events-none',
            immersiveMode && immersiveHudVisible && 'opacity-100 translate-y-0',
          )}
        >
          <CanvasToolbar
            className={cn(
              'h-9 px-2 backdrop-blur-xl',
              immersiveMode
                ? 'bg-black/90 border-t border-white/10'
                : 'bg-white/80 dark:bg-gray-800/80 border-t border-gray-200/40 dark:border-gray-700/40',
            )}
            currentSceneIndex={currentSceneIndex}
            scenesCount={scenesCount}
            engineState={engineState}
            audienceMode={audienceMode}
            isLiveSession={isLiveSession}
            whiteboardOpen={whiteboardOpen}
            sidebarCollapsed={sidebarCollapsed}
            chatCollapsed={chatCollapsed}
            onToggleSidebar={onToggleSidebar}
            onToggleChat={onToggleChat}
            immersiveMode={immersiveMode}
            immersiveDisabled={immersiveDisabled}
            onToggleImmersive={onToggleImmersive}
            onPrevSlide={onPrevSlide}
            onNextSlide={onNextSlide}
            onPlayPause={onPlayPause}
            onWhiteboardClose={onWhiteboardClose}
            showStopDiscussion={showStopDiscussion}
            onStopDiscussion={onStopDiscussion}
            ttsEnabled={ttsEnabled}
            ttsMuted={ttsMuted}
            ttsVolume={ttsVolume}
            onToggleMute={onToggleMute}
            onVolumeChange={onVolumeChange}
            autoPlayLecture={autoPlayLecture}
            onToggleAutoPlay={onToggleAutoPlay}
            playbackSpeed={playbackSpeed}
            onCycleSpeed={onCycleSpeed}
          />
        </div>
      )}

      {immersiveMode && !immersiveHudVisible && !whiteboardOpen ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 z-[140] h-8 bg-gradient-to-t from-black/18 via-black/4 to-transparent"
        />
      ) : null}
    </div>
  );
}

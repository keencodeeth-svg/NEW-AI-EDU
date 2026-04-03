'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useStageStore } from '@/lib/store';
import { PENDING_SCENE_ID } from '@/lib/store/stage';
import { useCanvasStore } from '@/lib/store/canvas';
import { PLAYBACK_SPEEDS, useSettingsStore } from '@/lib/store/settings';
import { useI18n } from '@/lib/hooks/use-i18n';
import { SceneSidebar } from './stage/scene-sidebar';
import { Header } from './header';
import { CanvasArea } from '@/components/canvas/canvas-area';
import { Roundtable } from '@/components/roundtable';
import { PlaybackEngine, computePlaybackView } from '@/lib/playback';
import type { EngineMode, TriggerEvent, Effect } from '@/lib/playback';
import { ActionEngine } from '@/lib/action/engine';
import { createAudioPlayer } from '@/lib/utils/audio-player';
import type { Action, DiscussionAction, SpeechAction } from '@/lib/types/action';
// Playback state persistence removed — refresh always starts from the beginning
import { ChatArea, type ChatAreaRef } from '@/components/chat/chat-area';
import { agentsToParticipants, useAgentRegistry } from '@/lib/orchestration/registry/store';
import type { AgentConfig } from '@/lib/orchestration/registry/types';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { AlertTriangle } from 'lucide-react';
import { VisuallyHidden } from 'radix-ui';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  buildAudienceModeLabel,
  buildLearningModeLabel,
  buildSubjectLabel,
  PRODUCT_BRAND_NAME,
} from '@/lib/classroom-integration';

/**
 * Stage Component
 *
 * The main container for the classroom/course.
 * Combines sidebar (scene navigation) and content area (scene viewer).
 * Supports two modes: autonomous and playback.
 */
export function Stage({
  onRetryOutline,
  audienceMode = false,
}: {
  onRetryOutline?: (outlineId: string) => Promise<void>;
  audienceMode?: boolean;
}) {
  const { t } = useI18n();
  const {
    mode,
    stage,
    getCurrentScene,
    scenes,
    currentSceneId,
    setCurrentSceneId,
    generatingOutlines,
  } = useStageStore();
  const failedOutlines = useStageStore.use.failedOutlines();

  const currentScene = getCurrentScene();
  const classroomMeta = stage?.classroomMeta;
  const audienceModeLabel = buildAudienceModeLabel(classroomMeta?.audienceMode);
  const audienceTopicLabel =
    classroomMeta?.focusKnowledgePointTitle || classroomMeta?.interestTopic || null;
  const audienceLearningModeLabel = buildLearningModeLabel(classroomMeta?.learningMode);
  const audienceTeacherLabel =
    classroomMeta?.teacher?.digitalHuman?.displayName ||
    classroomMeta?.teacher?.name ||
    (classroomMeta?.source === 'student-self-study' ? '航科 AI 导学老师' : null);
  const audienceStageTitle =
    currentScene?.title ||
    (audienceTopicLabel && classroomMeta?.learningMode === 'subject-reinforcement'
      ? `${audienceTopicLabel}巩固课`
      : audienceTopicLabel && classroomMeta?.learningMode === 'preview-preparation'
        ? `${audienceTopicLabel}预习课`
        : audienceTopicLabel && classroomMeta?.learningMode === 'classroom-review'
          ? `${audienceTopicLabel}回看课`
          : audienceTopicLabel && classroomMeta?.learningMode === 'interest-cultivation'
            ? `${audienceTopicLabel}探索课`
            : classroomMeta?.className && audienceLearningModeLabel
              ? `${classroomMeta.className} · ${audienceLearningModeLabel}`
              : stage?.name ||
                `${PRODUCT_BRAND_NAME}${audienceLearningModeLabel ? ` · ${audienceLearningModeLabel}` : ''}`);
  const audienceContextLabel = [
    classroomMeta?.className,
    buildSubjectLabel(classroomMeta?.subject),
    classroomMeta?.grade ? `${classroomMeta.grade}年级` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const immersiveStageTitle =
    currentScene?.title ||
    stage?.name ||
    audienceStageTitle ||
    `${PRODUCT_BRAND_NAME}${audienceLearningModeLabel ? ` · ${audienceLearningModeLabel}` : ''}`;
  const immersiveSessionLabel = audienceMode
    ? '全班观看'
    : classroomMeta?.source === 'student-self-study'
      ? '自主学习'
      : '沉浸播放';
  const immersiveModeLabel = audienceMode
    ? audienceModeLabel
    : audienceLearningModeLabel || buildSubjectLabel(classroomMeta?.subject) || '互动课堂';

  // Layout state from settings store (persisted via localStorage)
  const sidebarCollapsed = useSettingsStore((s) => s.sidebarCollapsed);
  const setSidebarCollapsed = useSettingsStore((s) => s.setSidebarCollapsed);
  const chatAreaWidth = useSettingsStore((s) => s.chatAreaWidth);
  const setChatAreaWidth = useSettingsStore((s) => s.setChatAreaWidth);
  const chatAreaCollapsed = useSettingsStore((s) => s.chatAreaCollapsed);
  const setChatAreaCollapsed = useSettingsStore((s) => s.setChatAreaCollapsed);
  const ttsEnabled = useSettingsStore((s) => s.ttsEnabled);
  const ttsProviderId = useSettingsStore((s) => s.ttsProviderId);
  const ttsProvidersConfig = useSettingsStore((s) => s.ttsProvidersConfig);
  const ttsMuted = useSettingsStore((s) => s.ttsMuted);
  const setTTSMuted = useSettingsStore((s) => s.setTTSMuted);
  const ttsVolume = useSettingsStore((s) => s.ttsVolume);
  const setTTSVolume = useSettingsStore((s) => s.setTTSVolume);
  const autoPlayLecture = useSettingsStore((s) => s.autoPlayLecture);
  const setAutoPlayLecture = useSettingsStore((s) => s.setAutoPlayLecture);
  const playbackSpeed = useSettingsStore((s) => s.playbackSpeed);
  const setPlaybackSpeed = useSettingsStore((s) => s.setPlaybackSpeed);
  const browserNarrationSupported =
    typeof window !== 'undefined' && typeof window.speechSynthesis !== 'undefined';
  const hasManagedTtsProvider = useMemo(
    () =>
      Object.entries(ttsProvidersConfig).some(
        ([providerId, config]) => providerId !== 'browser-native-tts' && config?.isServerConfigured,
      ),
    [ttsProvidersConfig],
  );
  const selectedManagedTtsReady =
    ttsProviderId !== 'browser-native-tts' && !!ttsProvidersConfig[ttsProviderId]?.isServerConfigured;
  const narrationMode = !ttsEnabled
    ? 'disabled'
    : selectedManagedTtsReady
      ? 'managed'
      : browserNarrationSupported
        ? 'browser'
        : 'silent';
  const narrationModeLabel =
    narrationMode === 'disabled'
      ? '讲解已关闭'
      : narrationMode === 'managed'
        ? '优先使用后台托管语音'
        : narrationMode === 'browser'
          ? ttsProviderId === 'browser-native-tts'
            ? '当前使用浏览器本地朗读'
            : '托管语音未就绪，自动回退朗读'
          : '当前将以静音讲解继续';
  const narrationHint =
    narrationMode === 'disabled'
      ? '当前课堂不会自动朗读，可在工具菜单重新开启讲解。'
      : narrationMode === 'managed'
        ? '后台已配置托管语音，课堂会优先播放预生成音频，适合全班观看与导出。'
        : narrationMode === 'browser'
          ? hasManagedTtsProvider
            ? '当前设备会用浏览器朗读兜底；如果后台语音稍后补齐，课堂会优先切回托管音频。'
            : '后台暂未配置语音服务，课堂将使用当前浏览器朗读兜底；首次播放请确认设备未静音。'
          : '当前设备不支持浏览器朗读，课堂会继续播放画面与文稿，但不会自动出声。';
  const narrationTone =
    narrationMode === 'managed'
      ? 'accent'
      : narrationMode === 'browser'
        ? 'warning'
        : 'neutral';
  const immersiveMetaPills = [
    audienceContextLabel || null,
    audienceTeacherLabel ? `主讲：${audienceTeacherLabel}` : null,
    narrationModeLabel,
  ].filter(Boolean) as string[];
  const immersiveShortcutHint = ['Esc 退出', '空格 播放/暂停', '← → 切换页'];

  // PlaybackEngine state
  const [engineMode, setEngineMode] = useState<EngineMode>('idle');
  const [playbackCompleted, setPlaybackCompleted] = useState(false); // Distinguishes "never played" idle from "finished" idle
  const [lectureSpeech, setLectureSpeech] = useState<string | null>(null); // From PlaybackEngine (lecture)
  const [liveSpeech, setLiveSpeech] = useState<string | null>(null); // From buffer (discussion/QA)
  const [speechProgress, setSpeechProgress] = useState<number | null>(null); // StreamBuffer reveal progress (0–1)
  const [discussionTrigger, setDiscussionTrigger] = useState<TriggerEvent | null>(null);

  // Speaking agent tracking (Issue 2)
  const [speakingAgentId, setSpeakingAgentId] = useState<string | null>(null);

  // Thinking state (Issue 5)
  const [thinkingState, setThinkingState] = useState<{
    stage: string;
    agentId?: string;
  } | null>(null);

  // Cue user state (Issue 7)
  const [isCueUser, setIsCueUser] = useState(false);

  // End flash state (Issue 3)
  const [showEndFlash, setShowEndFlash] = useState(false);
  const [endFlashSessionType, setEndFlashSessionType] = useState<'qa' | 'discussion'>('discussion');

  // Streaming state for stop button (Issue 1)
  const [chatIsStreaming, setChatIsStreaming] = useState(false);
  const [chatSessionType, setChatSessionType] = useState<string | null>(null);

  // Topic pending state: session is soft-paused, bubble stays visible, waiting for user input
  const [isTopicPending, setIsTopicPending] = useState(false);

  // Active bubble ID for playback highlight in chat area (Issue 8)
  const [activeBubbleId, setActiveBubbleId] = useState<string | null>(null);

  // Scene switch confirmation dialog state
  const [pendingSceneId, setPendingSceneId] = useState<string | null>(null);
  const [immersiveModeType, setImmersiveModeType] = useState<'standard' | 'inline' | 'fullscreen'>(
    'standard',
  );

  // Whiteboard state (from canvas store so AI tools can open it)
  const whiteboardOpen = useCanvasStore.use.whiteboardOpen();
  const setWhiteboardOpen = useCanvasStore.use.setWhiteboardOpen();

  // Selected agents from settings store (Zustand)
  const selectedAgentIds = useSettingsStore((s) => s.selectedAgentIds);

  // Generate participants from selected agents
  const participants = useMemo(
    () => agentsToParticipants(selectedAgentIds, t),
    [selectedAgentIds, t],
  );

  // Pick a student agent for discussion trigger (prioritize student > non-teacher > fallback)
  const pickStudentAgent = useCallback((): string => {
    const registry = useAgentRegistry.getState();
    const agents = selectedAgentIds
      .map((id) => registry.getAgent(id))
      .filter((a): a is AgentConfig => a != null);
    const students = agents.filter((a) => a.role === 'student');
    if (students.length > 0) {
      return students[Math.floor(Math.random() * students.length)].id;
    }
    const nonTeachers = agents.filter((a) => a.role !== 'teacher');
    if (nonTeachers.length > 0) {
      return nonTeachers[Math.floor(Math.random() * nonTeachers.length)].id;
    }
    return agents[0]?.id || 'default-1';
  }, [selectedAgentIds]);

  const engineRef = useRef<PlaybackEngine | null>(null);
  const stageRootRef = useRef<HTMLDivElement>(null);
  const audioPlayerRef = useRef(createAudioPlayer());
  const chatAreaRef = useRef<ChatAreaRef>(null);
  const lectureSessionIdRef = useRef<string | null>(null);
  const lectureActionCounterRef = useRef(0);
  const discussionAbortRef = useRef<AbortController | null>(null);
  const audienceImmersiveArmedRef = useRef(false);
  const audienceImmersiveTimerRef = useRef<number | null>(null);
  // Guard to prevent double flash when manual stop triggers onDiscussionEnd
  const manualStopRef = useRef(false);
  // Monotonic counter incremented on each scene switch — used to discard stale SSE callbacks
  const sceneEpochRef = useRef(0);
  // When true, the next engine init will auto-start playback (for auto-play scene advance)
  const autoStartRef = useRef(false);
  const immersiveHudTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const immersivePlayback = immersiveModeType !== 'standard';
  const [immersiveHudVisible, setImmersiveHudVisible] = useState(true);
  const [immersiveHudHovering, setImmersiveHudHovering] = useState(false);

  /**
   * Soft-pause: interrupt current agent stream but keep the session active.
   * Used when clicking the bubble pause button or opening input during QA/discussion.
   * Does NOT end the topic — user can continue speaking in the same session.
   * Preserves liveSpeech (with "..." appended) and speakingAgentId so the
   * roundtable bubble stays on the interrupted agent's text.
   */
  const doSoftPause = useCallback(async () => {
    await chatAreaRef.current?.softPauseActiveSession();
    // Append "..." to live speech to show interruption in roundtable bubble.
    // Only annotate when there's actual text being interrupted — during pure
    // director-thinking (prev is null, no agent assigned), leave liveSpeech
    // as-is so no spurious teacher bubble appears.
    setLiveSpeech((prev) => (prev !== null ? prev + '...' : null));
    // Keep speakingAgentId — bubble identity is preserved
    setThinkingState(null);
    setChatIsStreaming(false);
    setIsTopicPending(true);
    // Don't clear chatSessionType, speakingAgentId, or liveSpeech
    // Don't show end flash
    // Don't call handleEndDiscussion — engine stays in current state
  }, []);

  /**
   * Resume a soft-paused topic: re-call /chat with existing session messages.
   * The director picks the next agent to continue.
   */
  const doResumeTopic = useCallback(async () => {
    // Clear old bubble immediately — no lingering on interrupted text
    setIsTopicPending(false);
    setLiveSpeech(null);
    setSpeakingAgentId(null);
    setThinkingState({ stage: 'director' });
    setChatIsStreaming(true);
    // Fire new chat round — SSE events will drive thinking → agent_start → speech
    await chatAreaRef.current?.resumeActiveSession();
  }, []);

  /** Reset all live/discussion state (shared by doSessionCleanup & onDiscussionEnd) */
  const resetLiveState = useCallback(() => {
    setLiveSpeech(null);
    setSpeakingAgentId(null);
    setSpeechProgress(null);
    setThinkingState(null);
    setIsCueUser(false);
    setIsTopicPending(false);
    setChatIsStreaming(false);
    setChatSessionType(null);
  }, []);

  /** Full scene reset (scene switch) — resetLiveState + lecture/visual state */
  const resetSceneState = useCallback(() => {
    resetLiveState();
    setPlaybackCompleted(false);
    setLectureSpeech(null);
    setSpeechProgress(null);
    setShowEndFlash(false);
    setActiveBubbleId(null);
    setDiscussionTrigger(null);
  }, [resetLiveState]);

  /**
   * Unified session cleanup — called by both roundtable stop button and chat area end button.
   * Handles: engine transition, flash, roundtable state clearing.
   */
  const doSessionCleanup = useCallback(() => {
    const activeType = chatSessionType;

    // Engine cleanup — guard to avoid double flash from onDiscussionEnd
    manualStopRef.current = true;
    engineRef.current?.handleEndDiscussion();
    manualStopRef.current = false;

    // Show end flash with correct session type
    if (activeType === 'qa' || activeType === 'discussion') {
      setEndFlashSessionType(activeType);
      setShowEndFlash(true);
      setTimeout(() => setShowEndFlash(false), 1800);
    }

    resetLiveState();
  }, [chatSessionType, resetLiveState]);

  // Shared stop-discussion handler (used by both Roundtable and Canvas toolbar)
  const handleStopDiscussion = useCallback(async () => {
    await chatAreaRef.current?.endActiveSession();
    doSessionCleanup();
  }, [doSessionCleanup]);

  // Initialize playback engine when scene changes
  useEffect(() => {
    // Bump epoch so any stale SSE callbacks from the previous scene are discarded
    sceneEpochRef.current++;

    // End any active QA/discussion session — this synchronously aborts the SSE
    // stream inside use-chat-sessions (abortControllerRef.abort()), preventing
    // stale onLiveSpeech callbacks from leaking into the new scene.
    chatAreaRef.current?.endActiveSession();

    // Also abort the engine-level discussion controller
    if (discussionAbortRef.current) {
      discussionAbortRef.current.abort();
      discussionAbortRef.current = null;
    }

    // Reset all roundtable/live state so scenes are fully isolated
    resetSceneState();

    if (!currentScene || !currentScene.actions || currentScene.actions.length === 0) {
      engineRef.current = null;
      setEngineMode('idle');

      return;
    }

    // Stop previous engine
    if (engineRef.current) {
      engineRef.current.stop();
    }

    // Create ActionEngine for playback (with audioPlayer for TTS)
    const actionEngine = new ActionEngine(useStageStore, audioPlayerRef.current);

    // Create new PlaybackEngine
    const engine = new PlaybackEngine([currentScene], actionEngine, audioPlayerRef.current, {
      onModeChange: (mode) => {
        setEngineMode(mode);
      },
      onSceneChange: (_sceneId) => {
        // Scene change handled by engine
      },
      onSpeechStart: (text) => {
        setLectureSpeech(text);
        // Add to lecture session with incrementing index for dedup
        // Chat area pacing is handled by the StreamBuffer (onTextReveal)
        if (lectureSessionIdRef.current) {
          const idx = lectureActionCounterRef.current++;
          const speechId = `speech-${Date.now()}`;
          chatAreaRef.current?.addLectureMessage(
            lectureSessionIdRef.current,
            { id: speechId, type: 'speech', text } as Action,
            idx,
          );
          // Track active bubble for highlight (Issue 8)
          const msgId = chatAreaRef.current?.getLectureMessageId(lectureSessionIdRef.current!);
          if (msgId) setActiveBubbleId(msgId);
        }
      },
      onSpeechEnd: () => {
        // Don't clear lectureSpeech — let it persist until the next
        // onSpeechStart replaces it or the scene transitions.
        // Clearing here causes fallback to idleText (first sentence).
        setActiveBubbleId(null);
      },
      onEffectFire: (effect: Effect) => {
        // Add to lecture session with incrementing index
        if (
          lectureSessionIdRef.current &&
          (effect.kind === 'spotlight' || effect.kind === 'laser')
        ) {
          const idx = lectureActionCounterRef.current++;
          chatAreaRef.current?.addLectureMessage(
            lectureSessionIdRef.current,
            {
              id: `${effect.kind}-${Date.now()}`,
              type: effect.kind,
              elementId: effect.targetId,
            } as Action,
            idx,
          );
        }
      },
      onProactiveShow: (trigger) => {
        if (!trigger.agentId) {
          // Mutate in-place so engine.currentTrigger also gets the agentId
          // (confirmDiscussion reads agentId from the same object reference)
          trigger.agentId = pickStudentAgent();
        }
        setDiscussionTrigger(trigger);
      },
      onProactiveHide: () => {
        setDiscussionTrigger(null);
      },
      onDiscussionConfirmed: (topic, prompt, agentId) => {
        // Start SSE discussion via ChatArea
        handleDiscussionSSE(topic, prompt, agentId);
      },
      onDiscussionEnd: () => {
        // Abort any active SSE
        if (discussionAbortRef.current) {
          discussionAbortRef.current.abort();
          discussionAbortRef.current = null;
        }
        setDiscussionTrigger(null);
        // Clear roundtable state (idempotent — may already be cleared by doSessionCleanup)
        resetLiveState();
        // Only show flash for engine-initiated ends (not manual stop — that's handled by doSessionCleanup)
        if (!manualStopRef.current) {
          setEndFlashSessionType('discussion');
          setShowEndFlash(true);
          setTimeout(() => setShowEndFlash(false), 1800);
        }
        // If all actions are exhausted (discussion was the last action), mark
        // playback as completed so the bubble shows reset instead of play.
        if (engineRef.current?.isExhausted()) {
          setPlaybackCompleted(true);
        }
      },
      onUserInterrupt: (text) => {
        // User interrupted → start a discussion via chat
        chatAreaRef.current?.sendMessage(text);
      },
      isAgentSelected: (agentId) => {
        const ids = useSettingsStore.getState().selectedAgentIds;
        return ids.includes(agentId);
      },
      getPlaybackSpeed: () => useSettingsStore.getState().playbackSpeed || 1,
      onComplete: () => {
        // lectureSpeech intentionally NOT cleared — last sentence stays visible
        // until scene transition (auto-play) or user restarts. Scene change
        // effect handles the reset.
        setPlaybackCompleted(true);

        // End lecture session on playback complete
        if (lectureSessionIdRef.current) {
          chatAreaRef.current?.endSession(lectureSessionIdRef.current);
          lectureSessionIdRef.current = null;
        }
        // Auto-play: advance to next scene after a short pause
        const { autoPlayLecture } = useSettingsStore.getState();
        if (autoPlayLecture) {
          setTimeout(() => {
            const stageState = useStageStore.getState();
            if (!useSettingsStore.getState().autoPlayLecture) return;
            const allScenes = stageState.scenes;
            const curId = stageState.currentSceneId;
            const idx = allScenes.findIndex((s) => s.id === curId);
            if (idx >= 0 && idx < allScenes.length - 1) {
              const currentScene = allScenes[idx];
              if (
                currentScene.type === 'quiz' ||
                currentScene.type === 'interactive' ||
                currentScene.type === 'pbl'
              ) {
                return;
              }
              autoStartRef.current = true;
              stageState.setCurrentSceneId(allScenes[idx + 1].id);
            } else if (idx === allScenes.length - 1 && stageState.generatingOutlines.length > 0) {
              // Last scene exhausted but next is still generating — go to pending page
              const currentScene = allScenes[idx];
              if (
                currentScene.type === 'quiz' ||
                currentScene.type === 'interactive' ||
                currentScene.type === 'pbl'
              ) {
                return;
              }
              autoStartRef.current = true;
              stageState.setCurrentSceneId(PENDING_SCENE_ID);
            }
          }, 1500);
        }
      },
    });

    engineRef.current = engine;

    // Auto-start if triggered by auto-play scene advance
    if (autoStartRef.current) {
      autoStartRef.current = false;
      (async () => {
        if (currentScene && chatAreaRef.current) {
          const sessionId = await chatAreaRef.current.startLecture(currentScene.id);
          lectureSessionIdRef.current = sessionId;
          lectureActionCounterRef.current = 0;
        }
        engine.start();
      })();
    } else {
      // Load saved playback state and restore position (but never auto-play).
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Only re-run when scene changes, functions are stable refs
  }, [currentScene]);

  // Cleanup on unmount
  useEffect(() => {
    const audioPlayer = audioPlayerRef.current;
    const stageRoot = stageRootRef.current;
    return () => {
      clearTimeout(immersiveHudTimerRef.current);
      if (document.fullscreenElement === stageRoot) {
        void document.exitFullscreen().catch(() => undefined);
      }
      if (engineRef.current) {
        engineRef.current.stop();
      }
      audioPlayer.destroy();
      if (discussionAbortRef.current) {
        discussionAbortRef.current.abort();
      }
    };
  }, []);

  // Sync mute state from settings store to audioPlayer
  useEffect(() => {
    audioPlayerRef.current.setMuted(ttsMuted);
  }, [ttsMuted]);

  // Sync volume from settings store to audioPlayer
  useEffect(() => {
    if (!ttsMuted) {
      audioPlayerRef.current.setVolume(ttsVolume);
    }
  }, [ttsVolume, ttsMuted]);

  // Sync playback speed to audio player (for live-updating current audio)
  useEffect(() => {
    audioPlayerRef.current.setPlaybackRate(playbackSpeed);
  }, [playbackSpeed]);

  useEffect(() => {
    const syncFullscreenState = () => {
      if (document.fullscreenElement === stageRootRef.current) {
        setImmersiveModeType('fullscreen');
        return;
      }

      setImmersiveModeType((prev) => (prev === 'fullscreen' ? 'standard' : prev));
    };

    document.addEventListener('fullscreenchange', syncFullscreenState);
    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreenState);
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (immersivePlayback) {
      root.setAttribute('data-classroom-immersive', 'true');
    } else {
      root.removeAttribute('data-classroom-immersive');
    }

    return () => {
      root.removeAttribute('data-classroom-immersive');
    };
  }, [immersivePlayback]);

  const clearImmersiveHudTimer = useCallback(() => {
    clearTimeout(immersiveHudTimerRef.current);
  }, []);

  const scheduleImmersiveHudHide = useCallback(
    (delay = 2200) => {
      clearImmersiveHudTimer();
      if (!immersivePlayback || immersiveHudHovering || whiteboardOpen) return;
      immersiveHudTimerRef.current = setTimeout(() => {
        setImmersiveHudVisible(false);
      }, delay);
    },
    [clearImmersiveHudTimer, immersiveHudHovering, immersivePlayback, whiteboardOpen],
  );

  const revealImmersiveHud = useCallback(
    (delay = 2200) => {
      setImmersiveHudVisible(true);
      scheduleImmersiveHudHide(delay);
    },
    [scheduleImmersiveHudHide],
  );

  useEffect(() => {
    if (!immersivePlayback) {
      clearImmersiveHudTimer();
      setImmersiveHudVisible(true);
      setImmersiveHudHovering(false);
      return;
    }

    revealImmersiveHud(2800);

    return () => {
      clearImmersiveHudTimer();
    };
  }, [clearImmersiveHudTimer, immersivePlayback, revealImmersiveHud]);

  useEffect(() => {
    if (!immersivePlayback) return;
    if (immersiveHudHovering || whiteboardOpen) {
      clearImmersiveHudTimer();
      setImmersiveHudVisible(true);
      return;
    }

    scheduleImmersiveHudHide(1800);
  }, [
    clearImmersiveHudTimer,
    immersiveHudHovering,
    immersivePlayback,
    scheduleImmersiveHudHide,
    whiteboardOpen,
  ]);

  /**
   * Handle discussion SSE — POST /api/chat and push events to engine
   */
  const handleDiscussionSSE = useCallback(
    async (topic: string, prompt?: string, agentId?: string) => {
      // Start discussion display in ChatArea (lecture speech is preserved independently)
      chatAreaRef.current?.startDiscussion({
        topic,
        prompt,
        agentId: agentId || 'default-1',
      });
      // Auto-switch to chat tab when discussion starts
      chatAreaRef.current?.switchToTab('chat');
      // Immediately mark streaming for synchronized stop button
      setChatIsStreaming(true);
      setChatSessionType('discussion');
      // Optimistic thinking: show thinking dots immediately (same as onMessageSend)
      setThinkingState({ stage: 'director' });
    },
    [],
  );

  // First speech text for idle display (extracted here for playbackView)
  const firstSpeechText = useMemo(
    () => currentScene?.actions?.find((a): a is SpeechAction => a.type === 'speech')?.text ?? null,
    [currentScene],
  );

  // Whether the speaking agent is a student (for bubble role derivation)
  const speakingStudentFlag = useMemo(() => {
    if (!speakingAgentId) return false;
    const agent = useAgentRegistry.getState().getAgent(speakingAgentId);
    return agent?.role !== 'teacher';
  }, [speakingAgentId]);

  // Centralised derived playback view
  const playbackView = useMemo(
    () =>
      computePlaybackView({
        engineMode,
        lectureSpeech,
        liveSpeech,
        speakingAgentId,
        thinkingState,
        isCueUser,
        isTopicPending,
        chatIsStreaming,
        discussionTrigger,
        playbackCompleted,
        idleText: firstSpeechText,
        speakingStudent: speakingStudentFlag,
        sessionType: chatSessionType,
      }),
    [
      engineMode,
      lectureSpeech,
      liveSpeech,
      speakingAgentId,
      thinkingState,
      isCueUser,
      isTopicPending,
      chatIsStreaming,
      discussionTrigger,
      playbackCompleted,
      firstSpeechText,
      speakingStudentFlag,
      chatSessionType,
    ],
  );

  const isTopicActive = playbackView.isTopicActive;
  const immersiveInteractionActive =
    !!discussionTrigger ||
    chatIsStreaming ||
    isTopicPending ||
    !!chatSessionType ||
    engineMode === 'live' ||
    !!thinkingState ||
    isCueUser;
  const immersiveDisabled = mode !== 'playback' || immersiveInteractionActive;
  const showWorkspaceChrome = !immersivePlayback && !audienceMode;
  const showRoundtable = mode === 'playback' && !immersivePlayback && !audienceMode;
  const effectiveSidebarCollapsed = immersivePlayback || audienceMode ? true : sidebarCollapsed;
  const effectiveChatAreaCollapsed = immersivePlayback || audienceMode ? true : chatAreaCollapsed;

  const handleExitImmersive = useCallback(
    async (options?: { silent?: boolean; reason?: string }) => {
      try {
        if (document.fullscreenElement === stageRootRef.current) {
          await document.exitFullscreen();
        } else {
          setImmersiveModeType('standard');
        }
        if (!options?.silent) {
          toast.message(options?.reason || '已退出沉浸播放');
        }
      } catch {
        setImmersiveModeType('standard');
        if (!options?.silent) {
          toast.error('退出沉浸播放失败，请重试');
        }
      }
    },
    [],
  );

  const handleEnterImmersive = useCallback(
    async (options?: { silent?: boolean }) => {
      if (mode !== 'playback') return;
      if (immersiveDisabled) {
        if (!options?.silent) {
          toast.message('请先结束当前互动，再进入沉浸播放');
        }
        return;
      }

      const root = stageRootRef.current;
      if (!root?.requestFullscreen) {
        setImmersiveModeType('inline');
        if (!options?.silent) {
          toast.message('当前环境不支持浏览器全屏，已切换为页面内沉浸播放');
        }
        return;
      }

      try {
        await root.requestFullscreen();
        setImmersiveModeType('fullscreen');
        if (!options?.silent) {
          toast.success('已进入沉浸播放，可按 Esc 退出，空格播放或暂停。');
        }
      } catch {
        setImmersiveModeType('inline');
        if (!options?.silent) {
          toast.message('浏览器未进入全屏，已切换为页面内沉浸播放');
        }
      }
    },
    [immersiveDisabled, mode],
  );

  const handleToggleImmersive = useCallback(async () => {
    if (immersivePlayback) {
      await handleExitImmersive();
      return;
    }
    await handleEnterImmersive();
  }, [handleEnterImmersive, handleExitImmersive, immersivePlayback]);

  useEffect(() => {
    if (!audienceMode) {
      if (audienceImmersiveTimerRef.current !== null) {
        window.clearTimeout(audienceImmersiveTimerRef.current);
      }
      audienceImmersiveArmedRef.current = false;
    }
  }, [audienceMode]);

  useEffect(() => {
    if (
      !audienceMode ||
      audienceImmersiveArmedRef.current ||
      mode !== 'playback' ||
      immersivePlayback ||
      immersiveDisabled ||
      !currentScene
    ) {
      return;
    }

    audienceImmersiveTimerRef.current = window.setTimeout(() => {
      audienceImmersiveArmedRef.current = true;
      void handleEnterImmersive({ silent: true });
    }, 120);

    return () => {
      if (audienceImmersiveTimerRef.current !== null) {
        window.clearTimeout(audienceImmersiveTimerRef.current);
        audienceImmersiveTimerRef.current = null;
      }
    };
  }, [
    audienceMode,
    currentScene,
    handleEnterImmersive,
    immersiveDisabled,
    immersivePlayback,
    mode,
  ]);

  useEffect(() => {
    if (!immersivePlayback || !immersiveInteractionActive) return;

    void handleExitImmersive({
      silent: true,
    }).then(() => {
      toast.message('课堂已切回互动模式，已自动退出沉浸播放');
    });
  }, [handleExitImmersive, immersiveInteractionActive, immersivePlayback]);

  /**
   * Gated scene switch — if a topic is active, show AlertDialog before switching.
   * Returns true if the switch was immediate, false if gated (dialog shown).
   */
  const gatedSceneSwitch = useCallback(
    (targetSceneId: string): boolean => {
      if (targetSceneId === currentSceneId) return false;
      if (isTopicActive) {
        setPendingSceneId(targetSceneId);
        return false;
      }
      setCurrentSceneId(targetSceneId);
      return true;
    },
    [currentSceneId, isTopicActive, setCurrentSceneId],
  );

  /** User confirmed scene switch via AlertDialog */
  const confirmSceneSwitch = useCallback(() => {
    if (!pendingSceneId) return;
    chatAreaRef.current?.endActiveSession();
    doSessionCleanup();
    setCurrentSceneId(pendingSceneId);
    setPendingSceneId(null);
  }, [pendingSceneId, setCurrentSceneId, doSessionCleanup]);

  /** User cancelled scene switch via AlertDialog */
  const cancelSceneSwitch = useCallback(() => {
    setPendingSceneId(null);
  }, []);

  // play/pause toggle
  const handlePlayPause = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine) return;

    const mode = engine.getMode();
    if (mode === 'playing' || mode === 'live') {
      engine.pause();
      // Pause lecture buffer so text stops immediately
      if (lectureSessionIdRef.current) {
        chatAreaRef.current?.pauseBuffer(lectureSessionIdRef.current);
      }
    } else if (mode === 'paused') {
      engine.resume();
      // Resume lecture buffer
      if (lectureSessionIdRef.current) {
        chatAreaRef.current?.resumeBuffer(lectureSessionIdRef.current);
      }
    } else {
      const wasCompleted = playbackCompleted;
      setPlaybackCompleted(false);
      // Starting playback - create/reuse lecture session
      if (currentScene && chatAreaRef.current) {
        const sessionId = await chatAreaRef.current.startLecture(currentScene.id);
        lectureSessionIdRef.current = sessionId;
      }
      if (wasCompleted) {
        // Restart from beginning (user clicked restart after completion)
        lectureActionCounterRef.current = 0;
        engine.start();
      } else {
        // Continue from current position (e.g. after discussion end)
        engine.continuePlayback();
      }
    }
  }, [currentScene, playbackCompleted]);

  // previous scene (gated)
  const handlePreviousScene = useCallback(() => {
    if (currentSceneId === PENDING_SCENE_ID) {
      // From pending page → go to last real scene
      if (scenes.length > 0) {
        gatedSceneSwitch(scenes[scenes.length - 1].id);
      }
      return;
    }
    const currentIndex = scenes.findIndex((s) => s.id === currentSceneId);
    if (currentIndex > 0) {
      gatedSceneSwitch(scenes[currentIndex - 1].id);
    }
  }, [currentSceneId, gatedSceneSwitch, scenes]);

  // next scene (gated)
  const handleNextScene = useCallback(() => {
    if (currentSceneId === PENDING_SCENE_ID) return; // Already on pending, nowhere to go
    const currentIndex = scenes.findIndex((s) => s.id === currentSceneId);
    if (currentIndex < scenes.length - 1) {
      gatedSceneSwitch(scenes[currentIndex + 1].id);
    } else if (generatingOutlines.length > 0) {
      // On last real scene → advance to pending page
      setCurrentSceneId(PENDING_SCENE_ID);
    }
  }, [currentSceneId, gatedSceneSwitch, generatingOutlines.length, scenes, setCurrentSceneId]);

  // get scene information
  const isPendingScene = currentSceneId === PENDING_SCENE_ID;
  const hasNextPending = generatingOutlines.length > 0;
  const currentSceneIndex = isPendingScene
    ? scenes.length
    : scenes.findIndex((s) => s.id === currentSceneId);
  const totalScenesCount = scenes.length + (hasNextPending ? 1 : 0);

  // get action information
  const totalActions = currentScene?.actions?.length || 0;

  // whiteboard toggle
  const handleWhiteboardToggle = () => {
    setWhiteboardOpen(!whiteboardOpen);
  };

  const handleCycleSpeed = useCallback(() => {
    const currentIndex = PLAYBACK_SPEEDS.indexOf(playbackSpeed as (typeof PLAYBACK_SPEEDS)[number]);
    const nextIndex = (currentIndex + 1) % PLAYBACK_SPEEDS.length;
    setPlaybackSpeed(PLAYBACK_SPEEDS[nextIndex]);
  }, [playbackSpeed, setPlaybackSpeed]);

  useEffect(() => {
    if (!immersivePlayback) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        void handleExitImmersive({ silent: true });
        return;
      }

      revealImmersiveHud(2200);

      if (event.code === 'Space') {
        event.preventDefault();
        void handlePlayPause();
        return;
      }

      if (event.key.toLowerCase() === 'f') {
        event.preventDefault();
        void handleToggleImmersive();
        return;
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        handlePreviousScene();
        return;
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        handleNextScene();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    handleExitImmersive,
    handleNextScene,
    handlePlayPause,
    handlePreviousScene,
    handleToggleImmersive,
    immersivePlayback,
    revealImmersiveHud,
  ]);

  // Map engine mode to the CanvasArea's expected engine state
  const canvasEngineState = (() => {
    switch (engineMode) {
      case 'playing':
      case 'live':
        return 'playing';
      case 'paused':
        return 'paused';
      default:
        return 'idle';
    }
  })();

  // Build discussion request for Roundtable ProactiveCard from trigger
  const discussionRequest: DiscussionAction | null = discussionTrigger
    ? {
        type: 'discussion',
        id: discussionTrigger.id,
        topic: discussionTrigger.question,
        prompt: discussionTrigger.prompt,
        agentId: discussionTrigger.agentId || 'default-1',
      }
    : null;

  return (
    <div
      ref={stageRootRef}
      onMouseMoveCapture={() => {
        if (immersivePlayback) {
          revealImmersiveHud(1800);
        }
      }}
      onPointerDownCapture={() => {
        if (immersivePlayback) {
          revealImmersiveHud(2600);
        }
      }}
      className={cn(
        'flex min-h-0 overflow-hidden isolate',
        immersivePlayback
          ? 'fixed inset-0 z-[120] bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.16),transparent_24%),linear-gradient(180deg,#020617,#020617_54%,#000814_100%)] shadow-[0_0_0_1px_rgba(255,255,255,0.04)]'
          : 'flex-1 w-full bg-[linear-gradient(180deg,#f8fbff_0%,#f5fbf9_100%)] dark:bg-slate-950',
      )}
    >
      {/* Scene Sidebar */}
      {showWorkspaceChrome && (
        <SceneSidebar
          collapsed={sidebarCollapsed}
          onCollapseChange={setSidebarCollapsed}
          onSceneSelect={gatedSceneSwitch}
          onRetryOutline={onRetryOutline}
        />
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0 relative">
        {/* Header */}
        {showWorkspaceChrome && <Header currentSceneTitle={currentScene?.title || ''} />}

        {/* Canvas Area */}
        <div className="relative isolate flex-1 min-h-0 overflow-hidden" suppressHydrationWarning>
          <CanvasArea
            currentScene={currentScene}
            currentSceneIndex={currentSceneIndex}
            scenesCount={totalScenesCount}
            mode={mode}
            engineState={canvasEngineState}
            audienceMode={audienceMode}
            isLiveSession={
              chatIsStreaming || isTopicPending || engineMode === 'live' || !!chatSessionType
            }
            whiteboardOpen={whiteboardOpen}
            sidebarCollapsed={effectiveSidebarCollapsed}
            chatCollapsed={effectiveChatAreaCollapsed}
            onToggleSidebar={
              immersivePlayback ? undefined : () => setSidebarCollapsed(!sidebarCollapsed)
            }
            onToggleChat={
              immersivePlayback ? undefined : () => setChatAreaCollapsed(!chatAreaCollapsed)
            }
            immersiveMode={immersivePlayback}
            immersiveDisabled={immersiveDisabled}
            onToggleImmersive={mode === 'playback' ? handleToggleImmersive : undefined}
            onPrevSlide={handlePreviousScene}
            onNextSlide={handleNextScene}
            onPlayPause={handlePlayPause}
            onWhiteboardClose={handleWhiteboardToggle}
            showStopDiscussion={
              engineMode === 'live' ||
              (chatIsStreaming && (chatSessionType === 'qa' || chatSessionType === 'discussion'))
            }
            onStopDiscussion={handleStopDiscussion}
            hideToolbar={mode === 'playback' && !immersivePlayback && !audienceMode}
            immersiveHudVisible={immersiveHudVisible}
            onImmersiveHudHoverChange={(hovered) => {
              setImmersiveHudHovering(hovered);
              if (hovered) {
                revealImmersiveHud(3200);
              }
            }}
            onImmersiveHudRevealRequest={() => {
              revealImmersiveHud(3200);
            }}
            ttsEnabled={ttsEnabled}
            ttsMuted={ttsMuted}
            ttsVolume={ttsVolume}
            narrationModeLabel={narrationModeLabel}
            narrationHint={narrationHint}
            narrationTone={narrationTone}
            onToggleMute={() => ttsEnabled && setTTSMuted(!ttsMuted)}
            onVolumeChange={(value) => setTTSVolume(value)}
            autoPlayLecture={autoPlayLecture}
            onToggleAutoPlay={() => setAutoPlayLecture(!autoPlayLecture)}
            playbackSpeed={playbackSpeed}
            onCycleSpeed={handleCycleSpeed}
            isPendingScene={isPendingScene}
            isGenerationFailed={
              isPendingScene && failedOutlines.some((f) => f.id === generatingOutlines[0]?.id)
            }
            onRetryGeneration={
              onRetryOutline && generatingOutlines[0]
                ? () => onRetryOutline(generatingOutlines[0].id)
                : undefined
            }
          />

          {immersivePlayback ? (
            <div
              className={cn(
                'pointer-events-none absolute inset-x-0 top-0 z-[130] px-4 pt-3 transition-all duration-300 ease-out',
                immersiveHudVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-3',
              )}
            >
              <div className="pointer-events-auto mx-auto flex w-full max-w-[min(94vw,1080px)] flex-col gap-2 rounded-[24px] border border-white/14 bg-[linear-gradient(180deg,rgba(15,23,42,0.44),rgba(15,23,42,0.32))] px-4 py-3 text-white/88 shadow-[0_18px_52px_rgba(0,0,0,0.24)] backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-white/12 px-2.5 py-1 text-[11px] font-semibold tracking-[0.08em] text-white/92">
                      {immersiveSessionLabel}
                    </span>
                    {immersiveModeLabel ? (
                      <span className="rounded-full bg-sky-400/18 px-2.5 py-1 text-[11px] font-medium text-sky-100">
                        {immersiveModeLabel}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 truncate text-[14px] font-semibold text-white sm:text-[15px]">
                    {immersiveStageTitle}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-white/70 sm:justify-end">
                  {immersiveMetaPills.map((item) => (
                    <span key={item} className="rounded-full bg-white/8 px-2 py-0.5">
                      {item}
                    </span>
                  ))}
                  {immersiveShortcutHint.map((item) => (
                    <span
                      key={item}
                      className="rounded-full bg-white/10 px-2 py-0.5 text-white/82"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Roundtable Area */}
        {showRoundtable && (
          <Roundtable
            mode={mode}
            initialParticipants={participants}
            playbackView={playbackView}
            currentSpeech={liveSpeech}
            lectureSpeech={lectureSpeech}
            idleText={firstSpeechText}
            playbackCompleted={playbackCompleted}
            discussionRequest={discussionRequest}
            engineMode={engineMode}
            isStreaming={chatIsStreaming}
            sessionType={
              chatSessionType === 'qa'
                ? 'qa'
                : chatSessionType === 'discussion'
                  ? 'discussion'
                  : undefined
            }
            speakingAgentId={speakingAgentId}
            speechProgress={speechProgress}
            showEndFlash={showEndFlash}
            endFlashSessionType={endFlashSessionType}
            thinkingState={thinkingState}
            isCueUser={isCueUser}
            isTopicPending={isTopicPending}
            onMessageSend={(msg) => {
              // Clear soft-paused state — user is continuing the topic
              if (isTopicPending) {
                setIsTopicPending(false);
                setLiveSpeech(null);
                setSpeakingAgentId(null);
              }
              // User interrupts during playback — handleUserInterrupt triggers
              // onUserInterrupt callback which already calls sendMessage, so skip
              // the direct sendMessage below to avoid sending twice.
              // Include 'paused' because onInputActivate pauses the engine before
              // the user finishes typing — without this the interrupt position
              // would never be saved and resuming after QA skips to the next sentence.
              if (
                engineRef.current &&
                (engineMode === 'playing' || engineMode === 'live' || engineMode === 'paused')
              ) {
                engineRef.current.handleUserInterrupt(msg);
              } else {
                chatAreaRef.current?.sendMessage(msg);
              }
              // Auto-switch to chat tab when user sends a message
              chatAreaRef.current?.switchToTab('chat');
              setIsCueUser(false);
              // Immediately mark streaming for synchronized stop button
              setChatIsStreaming(true);
              setChatSessionType(chatSessionType || 'qa');
              // Optimistic thinking: show thinking dots immediately so there's
              // no blank gap between userMessage expiry and the SSE thinking event.
              // The real SSE event will overwrite this with the same or updated value.
              setThinkingState({ stage: 'director' });
            }}
            onDiscussionStart={() => {
              // User clicks "Join" on ProactiveCard
              engineRef.current?.confirmDiscussion();
            }}
            onDiscussionSkip={() => {
              // User clicks "Skip" on ProactiveCard
              engineRef.current?.skipDiscussion();
            }}
            onStopDiscussion={handleStopDiscussion}
            onInputActivate={async () => {
              // Soft-pause QA/Discussion if streaming (opening input = implicit pause)
              if (chatIsStreaming) {
                await doSoftPause();
              }
              // Also pause playback engine
              if (engineRef.current && (engineMode === 'playing' || engineMode === 'live')) {
                engineRef.current.pause();
              }
            }}
            onSoftPause={doSoftPause}
            onResumeTopic={doResumeTopic}
            onPlayPause={handlePlayPause}
            totalActions={totalActions}
            currentActionIndex={0}
            currentSceneIndex={currentSceneIndex}
            scenesCount={totalScenesCount}
            whiteboardOpen={whiteboardOpen}
            sidebarCollapsed={sidebarCollapsed}
            chatCollapsed={chatAreaCollapsed}
            onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
            onToggleChat={() => setChatAreaCollapsed(!chatAreaCollapsed)}
            onPrevSlide={handlePreviousScene}
            onNextSlide={handleNextScene}
            onWhiteboardClose={handleWhiteboardToggle}
            immersiveMode={immersivePlayback}
            immersiveDisabled={immersiveDisabled}
            onToggleImmersive={handleToggleImmersive}
          />
        )}
      </div>

      {/* Chat Area */}
      <ChatArea
        ref={chatAreaRef}
        width={chatAreaWidth}
        onWidthChange={setChatAreaWidth}
        collapsed={effectiveChatAreaCollapsed}
        onCollapseChange={setChatAreaCollapsed}
        className={
          immersivePlayback || audienceMode
            ? 'pointer-events-none border-l-0 shadow-none opacity-0'
            : ''
        }
        activeBubbleId={activeBubbleId}
        onActiveBubble={(id) => setActiveBubbleId(id)}
        currentSceneId={currentSceneId}
        onLiveSpeech={(text, agentId) => {
          // Capture epoch at call time — discard if scene has changed since
          const epoch = sceneEpochRef.current;
          // Use queueMicrotask to let any pending scene-switch reset settle first
          queueMicrotask(() => {
            if (sceneEpochRef.current !== epoch) return; // stale — scene changed
            setLiveSpeech(text);
            if (agentId !== undefined) {
              setSpeakingAgentId(agentId);
            }
            if (text !== null || agentId) {
              setChatIsStreaming(true);
              setChatSessionType(chatAreaRef.current?.getActiveSessionType?.() ?? null);
              setIsTopicPending(false);
            } else if (text === null && agentId === null) {
              setChatIsStreaming(false);
              // Don't clear chatSessionType here — it's needed by the stop
              // button when director cues user (cue_user → done → liveSpeech null).
              // It gets properly cleared in doSessionCleanup and scene change.
            }
          });
        }}
        onSpeechProgress={(ratio) => {
          const epoch = sceneEpochRef.current;
          queueMicrotask(() => {
            if (sceneEpochRef.current !== epoch) return;
            setSpeechProgress(ratio);
          });
        }}
        onThinking={(state) => {
          const epoch = sceneEpochRef.current;
          queueMicrotask(() => {
            if (sceneEpochRef.current !== epoch) return;
            setThinkingState(state);
          });
        }}
        onCueUser={(_fromAgentId, _prompt) => {
          setIsCueUser(true);
        }}
        onStopSession={doSessionCleanup}
      />

      {/* Scene switch confirmation dialog */}
      <AlertDialog
        open={!!pendingSceneId}
        onOpenChange={(open) => {
          if (!open) cancelSceneSwitch();
        }}
      >
        <AlertDialogContent className="max-w-sm rounded-2xl p-0 overflow-hidden border-0 shadow-[0_25px_60px_-12px_rgba(0,0,0,0.15)] dark:shadow-[0_25px_60px_-12px_rgba(0,0,0,0.5)]">
          <VisuallyHidden.Root>
            <AlertDialogTitle>{t('stage.confirmSwitchTitle')}</AlertDialogTitle>
          </VisuallyHidden.Root>
          {/* Top accent bar */}
          <div className="h-1 bg-gradient-to-r from-amber-400 via-orange-400 to-red-400" />

          <div className="px-6 pt-5 pb-2 flex flex-col items-center text-center">
            {/* Icon */}
            <div className="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center mb-4 ring-1 ring-amber-200/50 dark:ring-amber-700/30">
              <AlertTriangle className="w-6 h-6 text-amber-500 dark:text-amber-400" />
            </div>
            {/* Title */}
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-1.5">
              {t('stage.confirmSwitchTitle')}
            </h3>
            {/* Description */}
            <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
              {t('stage.confirmSwitchMessage')}
            </p>
          </div>

          <AlertDialogFooter className="px-6 pb-5 pt-3 flex-row gap-3">
            <AlertDialogCancel onClick={cancelSceneSwitch} className="flex-1 rounded-xl">
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmSceneSwitch}
              className="flex-1 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border-0 shadow-md shadow-amber-200/50 dark:shadow-amber-900/30"
            >
              {t('common.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

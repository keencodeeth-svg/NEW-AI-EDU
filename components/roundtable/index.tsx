'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Mic,
  MicOff,
  Send,
  MessageSquare,
  Pause,
  Play,
  Repeat,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { CanvasToolbar } from '@/components/canvas/canvas-toolbar';
import { useAudioRecorder } from '@/lib/hooks/use-audio-recorder';
import { useI18n } from '@/lib/hooks/use-i18n';
import { toast } from 'sonner';
import { useSettingsStore, PLAYBACK_SPEEDS } from '@/lib/store/settings';
import { ProactiveCard } from '@/components/chat/proactive-card';
import { HoverCard, HoverCardTrigger, HoverCardContent } from '@/components/ui/hover-card';
import { useAgentRegistry } from '@/lib/orchestration/registry/store';
import type { DiscussionAction } from '@/lib/types/action';
import type { EngineMode, PlaybackView } from '@/lib/playback';
import type { Participant } from '@/lib/types/roundtable';
import {
  classroomPrimaryButton,
  classroomRoundtableAgentBubble,
  classroomRoundtablePrimaryCircle,
  classroomRoundtableTeacherBubble,
  classroomRoundtableUserBubble,
  classroomTonePill,
} from '@/lib/ui/classroom-theme';

export interface DiscussionRequest {
  topic: string;
  prompt?: string;
  agentId?: string; // Agent ID to initiate discussion (default: 'default-1')
}

interface RoundtableProps {
  readonly mode?: 'playback' | 'autonomous';
  readonly initialParticipants?: Participant[];
  readonly playbackView?: PlaybackView; // Centralised derived state from Stage
  readonly currentSpeech?: string | null; // Live SSE speech (from StreamBuffer — discussion/QA)
  readonly lectureSpeech?: string | null; // Active lecture speech (from PlaybackEngine, full text)
  readonly idleText?: string | null; // Static idle text (first speech action)
  readonly playbackCompleted?: boolean; // True when engine finished all actions (show restart icon)
  readonly discussionRequest?: DiscussionAction | null;
  readonly engineMode?: EngineMode;
  readonly isStreaming?: boolean;
  readonly sessionType?: 'qa' | 'discussion';
  readonly speakingAgentId?: string | null;
  readonly speechProgress?: number | null; // StreamBuffer reveal progress (0–1) for auto-scroll
  readonly showEndFlash?: boolean;
  readonly endFlashSessionType?: 'qa' | 'discussion';
  readonly thinkingState?: { stage: string; agentId?: string } | null;
  readonly isCueUser?: boolean;
  readonly isTopicPending?: boolean;
  readonly onMessageSend?: (message: string) => void;
  readonly onDiscussionStart?: (request: DiscussionAction) => void;
  readonly onDiscussionSkip?: () => void;
  readonly onStopDiscussion?: () => void;
  readonly onInputActivate?: () => void;
  readonly onSoftPause?: () => void;
  readonly onResumeTopic?: () => void;
  readonly onPlayPause?: () => void;
  readonly totalActions?: number;
  readonly currentActionIndex?: number;
  // Toolbar props (merged from CanvasArea)
  readonly currentSceneIndex?: number;
  readonly scenesCount?: number;
  readonly whiteboardOpen?: boolean;
  readonly sidebarCollapsed?: boolean;
  readonly chatCollapsed?: boolean;
  readonly onToggleSidebar?: () => void;
  readonly onToggleChat?: () => void;
  readonly onPrevSlide?: () => void;
  readonly onNextSlide?: () => void;
  readonly onWhiteboardClose?: () => void;
  readonly immersiveMode?: boolean;
  readonly immersiveDisabled?: boolean;
  readonly onToggleImmersive?: () => void;
}

const DEFAULT_TEACHER_AVATAR = '/avatars/hangke-mentor.svg';
const DEFAULT_USER_AVATAR = '/avatars/hangke-learner.svg';

/** Render avatar as <img> for URLs or as emoji text span */
function AvatarDisplay({ src, alt, className }: { src: string; alt?: string; className?: string }) {
  const isUrl = src.startsWith('http') || src.startsWith('data:') || src.startsWith('/');
  if (isUrl) {
    return (
      <img src={src} alt={alt || ''} className={cn('w-full h-full object-cover', className)} />
    );
  }
  return (
    <span className={cn('flex items-center justify-center w-full h-full select-none', className)}>
      {src}
    </span>
  );
}

export function Roundtable({
  mode: _mode = 'autonomous',
  initialParticipants = [],
  playbackView,
  currentSpeech,
  lectureSpeech,
  idleText,
  playbackCompleted,
  discussionRequest,
  engineMode = 'idle',
  isStreaming,
  sessionType,
  speakingAgentId,
  speechProgress: _speechProgress,
  showEndFlash,
  endFlashSessionType = 'discussion',
  thinkingState,
  isCueUser,
  isTopicPending,
  onMessageSend,
  onDiscussionStart,
  onDiscussionSkip,
  onStopDiscussion,
  onInputActivate,
  onSoftPause,
  onResumeTopic,
  onPlayPause,
  currentSceneIndex = 0,
  scenesCount = 1,
  whiteboardOpen = false,
  sidebarCollapsed,
  chatCollapsed,
  onToggleSidebar,
  onToggleChat,
  onPrevSlide,
  onNextSlide,
  onWhiteboardClose,
  immersiveMode,
  immersiveDisabled,
  onToggleImmersive,
}: RoundtableProps) {
  const { t } = useI18n();
  const ttsMuted = useSettingsStore((s) => s.ttsMuted);
  const setTTSMuted = useSettingsStore((s) => s.setTTSMuted);
  const ttsEnabled = useSettingsStore((state) => state.ttsEnabled);
  const asrEnabled = useSettingsStore((state) => state.asrEnabled);
  const ttsVolume = useSettingsStore((s) => s.ttsVolume);
  const setTTSVolume = useSettingsStore((s) => s.setTTSVolume);
  const autoPlayLecture = useSettingsStore((s) => s.autoPlayLecture);
  const setAutoPlayLecture = useSettingsStore((s) => s.setAutoPlayLecture);
  const playbackSpeed = useSettingsStore((s) => s.playbackSpeed);
  const setPlaybackSpeed = useSettingsStore((s) => s.setPlaybackSpeed);
  const [isInputOpen, setIsInputOpen] = useState(false);
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [userMessage, setUserMessage] = useState<string | null>(null);
  const agentScrollRef = useRef<HTMLDivElement>(null);
  const bubbleScrollRef = useRef<HTMLDivElement>(null);

  // End flash visible state (Issue 3)
  const [endFlashVisible, setEndFlashVisible] = useState(false);

  // Send cooldown: lock input from "message sent" until "agent bubble appears"
  const [isSendCooldown, setIsSendCooldown] = useState(false);
  const isSendCooldownRef = useRef(false);

  const teacherParticipant = initialParticipants.find((p) => p.role === 'teacher');
  const studentParticipants = initialParticipants.filter(
    (p) => p.role !== 'teacher' && p.role !== 'user',
  );

  // Derived state from Stage's computePlaybackView (centralised derivation)
  const isInLiveFlow =
    playbackView?.isInLiveFlow ??
    !!(speakingAgentId || thinkingState || isStreaming || sessionType);

  // Role-aware source text: userMessage overlay on top of playbackView
  const sourceText = userMessage
    ? userMessage
    : (playbackView?.sourceText ??
      (currentSpeech
        ? currentSpeech
        : isInLiveFlow
          ? ''
          : lectureSpeech || (playbackCompleted ? '' : idleText) || ''));

  // Auto-scroll bubble: keep latest streaming text visible during live/discussion flow
  useEffect(() => {
    if (!isInLiveFlow) return;
    const el = bubbleScrollRef.current;
    if (!el) return;
    const scrollableHeight = el.scrollHeight - el.clientHeight;
    if (scrollableHeight <= 0) return;
    el.scrollTo({ top: scrollableHeight, behavior: 'smooth' });
  }, [sourceText, isInLiveFlow]);

  // End flash effect (Issue 3)
  useEffect(() => {
    if (showEndFlash) {
      setEndFlashVisible(true);
      const timer = setTimeout(() => setEndFlashVisible(false), 1800);
      return () => clearTimeout(timer);
    } else {
      setEndFlashVisible(false);
    }
  }, [showEndFlash]);

  // Clear send cooldown when agent bubble appears
  useEffect(() => {
    if (isSendCooldown && speakingAgentId) {
      setIsSendCooldown(false);
      isSendCooldownRef.current = false;
    }
  }, [isSendCooldown, speakingAgentId]);

  // Safety net: clear cooldown when streaming transitions from active → ended
  // (not when isStreaming was already false — that would clear cooldown immediately)
  const prevStreamingRef = useRef(false);
  useEffect(() => {
    if (prevStreamingRef.current && !isStreaming && isSendCooldown) {
      setIsSendCooldown(false);
      isSendCooldownRef.current = false;
    }
    prevStreamingRef.current = !!isStreaming;
  }, [isStreaming, isSendCooldown]);

  // Separate participants by role (teacherParticipant & studentParticipants declared earlier for effect)
  const userParticipant = initialParticipants.find((p) => p.role === 'user');

  const teacherAvatar = teacherParticipant?.avatar || DEFAULT_TEACHER_AVATAR;
  const teacherName = teacherParticipant?.name || t('roundtable.teacher');
  const userAvatar = userParticipant?.avatar || DEFAULT_USER_AVATAR;
  const discussionAgentConfig = discussionRequest
    ? useAgentRegistry.getState().getAgent(discussionRequest.agentId || '')
    : null;
  const discussionAgentParticipant = discussionRequest
    ? discussionRequest.agentId === teacherParticipant?.id
      ? teacherParticipant
      : studentParticipants.find((participant) => participant.id === discussionRequest.agentId)
    : null;
  const discussionAgentName =
    discussionAgentParticipant?.name ||
    discussionAgentConfig?.name ||
    (discussionRequest?.agentId === teacherParticipant?.id
      ? teacherName
      : t('settings.agentRoles.student'));
  const discussionAgentAvatar =
    discussionAgentParticipant?.avatar ||
    discussionAgentConfig?.avatar ||
    (discussionRequest?.agentId === teacherParticipant?.id ? teacherAvatar : undefined);

  // Audio recording
  const { isRecording, isProcessing, startRecording, stopRecording } = useAudioRecorder({
    onTranscription: (text) => {
      if (!text.trim()) {
        toast.info(t('roundtable.noSpeechDetected'));
        setIsVoiceOpen(false);
        return;
      }
      // Block if in send cooldown (e.g. text was sent while voice was processing)
      if (isSendCooldownRef.current) {
        setIsVoiceOpen(false);
        return;
      }
      setUserMessage(text);
      onMessageSend?.(text);
      setIsSendCooldown(true);
      isSendCooldownRef.current = true;
      setIsVoiceOpen(false);

      setTimeout(() => {
        setUserMessage(null);
      }, 3000);
    },
    onError: (error) => {
      toast.error(error);
    },
  });

  const handleSendMessage = () => {
    if (!inputValue.trim() || isSendCooldown) return;

    setUserMessage(inputValue);
    onMessageSend?.(inputValue);
    setIsSendCooldown(true);
    isSendCooldownRef.current = true;
    setInputValue('');
    setIsInputOpen(false);

    setTimeout(() => {
      setUserMessage(null);
    }, 3000);
  };

  const handleToggleInput = () => {
    if (isSendCooldown) return;
    if (!isInputOpen) {
      onInputActivate?.();
    }
    setIsInputOpen(!isInputOpen);
    setIsVoiceOpen(false);
  };

  const handleToggleVoice = () => {
    if (isVoiceOpen) {
      if (isRecording) {
        stopRecording();
      }
      setIsVoiceOpen(false);
    } else {
      if (isSendCooldown) return;
      onInputActivate?.();
      setIsVoiceOpen(true);
      setIsInputOpen(false);
      startRecording();
    }
  };

  // Determine active speaking state and bubble ownership
  // Check if current speaker is a student agent (not teacher)
  const speakingStudent = speakingAgentId
    ? studentParticipants.find((s) => s.id === speakingAgentId)
    : null;

  // Bubble loading: speakingAgentId is set (agent_start fired) but text hasn't arrived yet
  const isBubbleLoading = !!(speakingAgentId && !currentSpeech && !userMessage);
  // Student agent specifically loading (for agent-style bubble)
  const isAgentLoading = !!(speakingStudent && !currentSpeech && !userMessage);

  const activeRole: 'teacher' | 'user' | 'agent' | null = userMessage
    ? 'user'
    : (playbackView?.activeRole ??
      (currentSpeech && speakingStudent
        ? 'agent'
        : currentSpeech
          ? 'teacher'
          : isAgentLoading
            ? 'agent'
            : isBubbleLoading
              ? 'teacher'
              : isCueUser
                ? null
                : lectureSpeech
                  ? 'teacher'
                  : null));

  const bubbleRole: 'teacher' | 'user' | 'agent' | null = userMessage
    ? 'user'
    : (playbackView?.bubbleRole ??
      (currentSpeech && speakingStudent
        ? 'agent'
        : currentSpeech
          ? 'teacher'
          : isAgentLoading
            ? 'agent'
            : isBubbleLoading
              ? 'teacher'
              : isInLiveFlow
                ? null
                : isCueUser
                  ? null
                  : lectureSpeech || idleText
                    ? 'teacher'
                    : null));

  const bubbleName =
    bubbleRole === 'agent'
      ? speakingStudent?.name || t('settings.agentRoles.student')
      : bubbleRole === 'teacher'
        ? teacherName
        : bubbleRole === 'user'
          ? t('roundtable.you')
          : '';

  // Stable key based on speaker identity, NOT text content (prevents re-mount flicker)
  const bubbleKey =
    bubbleRole === 'user'
      ? 'user'
      : bubbleRole === 'agent'
        ? `agent-${speakingAgentId}`
        : bubbleRole === 'teacher'
          ? 'teacher'
          : 'idle';

  // Show stop button whenever there's an active QA/discussion session or live mode.
  // sessionType is only cleared in doSessionCleanup, so this stays stable through
  // brief loading gaps (e.g. between user message and agent SSE response).
  const showStopButton =
    engineMode === 'live' || sessionType === 'qa' || sessionType === 'discussion';

  const handleCycleSpeed = useCallback(() => {
    const currentIndex = PLAYBACK_SPEEDS.indexOf(playbackSpeed as (typeof PLAYBACK_SPEEDS)[number]);
    const nextIndex = (currentIndex + 1) % PLAYBACK_SPEEDS.length;
    setPlaybackSpeed(PLAYBACK_SPEEDS[nextIndex]);
  }, [playbackSpeed, setPlaybackSpeed]);

  const sessionStatusTone: 'sky' | 'emerald' | 'amber' | 'slate' = isTopicPending
    ? 'amber'
    : isInLiveFlow
      ? 'emerald'
      : playbackCompleted
        ? 'sky'
        : 'slate';
  const sessionStatusLabel = isTopicPending
    ? '等待继续'
    : isInLiveFlow
      ? '实时互动'
      : playbackCompleted
        ? '本节已完成'
        : '课堂讲解';
  const studentDockStatus = isSendCooldown
    ? '等待回应'
    : isCueUser
      ? t('roundtable.yourTurn')
      : isVoiceOpen
        ? isProcessing
          ? t('roundtable.processing')
          : t('roundtable.listening')
        : isInputOpen
          ? '文字输入中'
          : '可随时发起提问';
  const studentDockTone: 'sky' | 'emerald' | 'amber' | 'slate' = isCueUser
    ? 'amber'
    : isVoiceOpen || isInputOpen
      ? 'sky'
      : isSendCooldown
        ? 'emerald'
        : 'slate';
  const primaryCueActionLabel = asrEnabled ? '语音接力' : '继续提问';

  return (
    <div
      style={{
        height: discussionRequest ? 'clamp(152px, 17.2vh, 184px)' : 'clamp(120px, 14.4vh, 144px)',
      }}
      className="relative z-10 flex w-full flex-col overflow-hidden border-t border-sky-100/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(246,250,253,0.94))] backdrop-blur-xl dark:border-slate-800/80 dark:bg-[linear-gradient(180deg,rgba(12,18,28,0.9),rgba(10,14,22,0.96))]"
    >
      {/* ── Toolbar strip — merged from CanvasArea ── */}
      <CanvasToolbar
        className="h-10 shrink-0 border-b border-sky-100/80 px-3 dark:border-slate-800/60"
        currentSceneIndex={currentSceneIndex}
        scenesCount={scenesCount}
        engineState={
          engineMode === 'playing' || engineMode === 'live'
            ? 'playing'
            : engineMode === 'paused'
              ? 'paused'
              : 'idle'
        }
        isLiveSession={isStreaming || isTopicPending || engineMode === 'live'}
        whiteboardOpen={whiteboardOpen}
        sidebarCollapsed={sidebarCollapsed}
        chatCollapsed={chatCollapsed}
        onToggleSidebar={onToggleSidebar}
        onToggleChat={onToggleChat}
        immersiveMode={immersiveMode}
        immersiveDisabled={immersiveDisabled}
        onToggleImmersive={onToggleImmersive}
        onPrevSlide={onPrevSlide ?? (() => {})}
        onNextSlide={onNextSlide ?? (() => {})}
        onPlayPause={onPlayPause ?? (() => {})}
        onWhiteboardClose={onWhiteboardClose ?? (() => {})}
        showStopDiscussion={showStopButton}
        onStopDiscussion={onStopDiscussion}
        ttsEnabled={ttsEnabled}
        ttsMuted={ttsMuted}
        ttsVolume={ttsVolume}
        onToggleMute={() => ttsEnabled && setTTSMuted(!ttsMuted)}
        onVolumeChange={(v) => setTTSVolume(v)}
        autoPlayLecture={autoPlayLecture}
        onToggleAutoPlay={() => setAutoPlayLecture(!autoPlayLecture)}
        playbackSpeed={playbackSpeed}
        onCycleSpeed={handleCycleSpeed}
      />

      <AnimatePresence>
        {discussionRequest && (
          <ProactiveCard
            action={discussionRequest}
            mode={engineMode === 'paused' ? 'paused' : 'playback'}
            agentName={discussionAgentName}
            agentAvatar={discussionAgentAvatar}
            agentColor={discussionAgentConfig?.color}
            onSkip={() => onDiscussionSkip?.()}
            onListen={() => onDiscussionStart?.(discussionRequest)}
            onTogglePause={() => onPlayPause?.()}
          />
        )}
      </AnimatePresence>

      {/* ── Interaction area — three-column layout ── */}
      <div className="flex-1 flex items-stretch min-h-0">
        {/* Left: Teacher identity */}
        <div className="relative flex w-[88px] shrink-0 flex-col overflow-visible border-r border-sky-100/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(246,249,252,0.92))] px-1.5 py-1.5 dark:border-slate-800/80 dark:bg-[linear-gradient(180deg,rgba(14,19,28,0.8),rgba(10,14,22,0.94))] sm:w-[104px]">
          <HoverCard openDelay={300} closeDelay={100}>
            <HoverCardTrigger asChild>
              <div className="flex h-full cursor-pointer flex-col items-center justify-between rounded-[22px] border border-white/92 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(247,250,253,0.9))] px-2.5 py-2.5 shadow-[0_14px_34px_rgba(15,23,42,0.05)] dark:border-slate-800/76 dark:bg-slate-900/72">
                <span
                  className={classroomTonePill(
                    'slate',
                    'inline-flex items-center px-2 py-0.5 text-[8px] tracking-[0.16em]',
                  )}
                >
                  主讲
                </span>

                <div className="flex flex-1 flex-col items-center justify-center gap-1.5 py-1.5">
                  <div
                    className={cn(
                      'relative flex h-12 w-12 items-center justify-center rounded-full transition-all duration-500',
                      activeRole === 'teacher' ? 'scale-[1.02]' : 'opacity-95',
                    )}
                  >
                    <div
                      className={cn(
                        'absolute inset-0 rounded-full border transition-all duration-500',
                        activeRole === 'teacher'
                          ? 'border-sky-300/90 bg-sky-100/50 shadow-[0_0_0_6px_rgba(125,211,252,0.16)] dark:border-sky-300/70 dark:bg-sky-400/10'
                          : 'border-slate-200/80 bg-white/78 dark:border-slate-700/80 dark:bg-slate-900/70',
                      )}
                    />

                    <div className="relative z-10 h-10 w-10 overflow-hidden rounded-full border border-white/90 bg-white shadow-sm dark:border-slate-700/90 dark:bg-slate-900">
                      <img src={teacherAvatar} alt="Teacher" className="h-full w-full object-cover" />
                    </div>

                    {activeRole === 'teacher' && (
                      <div className="absolute -right-0.5 top-0.5 z-20 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-white bg-emerald-500 dark:border-slate-900 dark:bg-emerald-400">
                        <div className="h-1 w-1 rounded-full bg-white animate-pulse" />
                      </div>
                    )}
                  </div>

                  <div className="space-y-1 text-center">
                    <p className="max-w-[72px] truncate text-[10px] font-semibold leading-tight text-slate-700 dark:text-slate-100 sm:max-w-[80px]">
                      {teacherName}
                    </p>
                    <p className="text-[9px] text-slate-400 dark:text-slate-500">数字教师席</p>
                  </div>
                </div>

                <span
                  className={cn(
                    'rounded-full px-1.5 py-0.5 text-[8px] font-semibold tracking-[0.14em]',
                    bubbleRole === 'teacher' || (activeRole === 'teacher' && !speakingStudent)
                      ? classroomTonePill('sky', 'px-1.5 py-0.5 text-[8px] tracking-[0.14em]')
                      : classroomTonePill(
                          'slate',
                          'px-1.5 py-0.5 text-[8px] tracking-[0.14em] text-slate-500 dark:text-slate-400',
                        ),
                  )}
                >
                  {bubbleRole === 'teacher' || (activeRole === 'teacher' && !speakingStudent)
                    ? '讲解中'
                    : '待命'}
                </span>
              </div>
            </HoverCardTrigger>
            <HoverCardContent
              side="bottom"
              align="center"
              className="w-64 max-h-[300px] overflow-y-auto p-3"
            >
              {(() => {
                const teacherConfig = useAgentRegistry.getState().getAgent(teacherParticipant?.id || '');
                return (
                  <>
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                        <img
                          src={teacherAvatar}
                          alt={teacherName}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{teacherName}</p>
                        <span
                          className={classroomTonePill(
                            'sky',
                            'mt-0.5 inline-block px-1.5 py-0.5 text-[10px] leading-tight',
                          )}
                        >
                          {t('settings.agentRoles.teacher')}
                        </span>
                      </div>
                    </div>
                    {teacherConfig?.persona && (
                      <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-muted-foreground">
                        {teacherConfig.persona}
                      </p>
                    )}
                  </>
                );
              })()}
            </HoverCardContent>
          </HoverCard>
        </div>

        {/* Center: Interaction stage */}
        <div className="relative mx-1 my-1 flex-1 sm:mx-2">
          {/* End flash banner (Issue 3) */}
          <AnimatePresence>
            {endFlashVisible && (
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.9 }}
                animate={{
                  opacity: [0, 1, 1, 0],
                  y: [-10, 0, 0, -6],
                  scale: [0.9, 1, 1, 0.95],
                }}
                transition={{
                  duration: 1.8,
                  times: [0, 0.15, 0.7, 1],
                  ease: 'easeOut',
                }}
                className="pointer-events-none absolute left-1/2 top-2 z-50 -translate-x-1/2 rounded-full border border-sky-100/80 bg-[linear-gradient(135deg,rgba(248,252,255,0.96),rgba(224,242,254,0.92))] px-3.5 py-1.5 text-xs font-medium text-sky-950 shadow-[0_16px_40px_rgba(14,165,233,0.12)] backdrop-blur-md"
              >
                <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-sky-300" />
                {endFlashSessionType === 'discussion'
                  ? t('roundtable.discussionEnded')
                  : t('roundtable.qaEnded')}
              </motion.div>
            )}
          </AnimatePresence>

          <div
            onClick={() => {
              if (isInputOpen || isVoiceOpen) {
                setIsInputOpen(false);
                setIsVoiceOpen(false);
                if (isRecording) stopRecording();
              }
            }}
            className="group relative flex h-full w-full flex-col justify-center overflow-hidden rounded-[28px] border border-white/82 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(246,250,253,0.9))] px-3.5 shadow-[0_24px_56px_-20px_rgba(15,23,42,0.16),inset_0_1px_0_0_rgba(255,255,255,0.92)] transition-all duration-700 cursor-default dark:border-slate-700/70 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.9),rgba(15,23,42,0.76))] dark:shadow-[0_24px_60px_-18px_rgba(2,6,23,0.58)] sm:px-4"
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-[radial-gradient(circle_at_top,rgba(125,211,252,0.14),transparent_66%)] dark:bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.16),transparent_62%)]" />
            <div className="absolute left-3.5 right-3.5 top-3.5 z-10 flex items-center justify-between gap-2">
              <span
                className={classroomTonePill(
                  'slate',
                  'px-2.5 py-1 text-[9px] font-semibold tracking-[0.16em]',
                )}
              >
                课堂互动区
              </span>
              <div className="flex flex-wrap items-center justify-end gap-1.5">
                <span
                  className={classroomTonePill(
                    sessionStatusTone,
                    'px-2.5 py-1 text-[9px] font-semibold',
                  )}
                >
                  {sessionStatusLabel}
                </span>
                {bubbleRole && bubbleName ? (
                  <span className="rounded-full border border-slate-200/80 bg-white/88 px-2.5 py-1 text-[9px] font-medium text-slate-500 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/78 dark:text-slate-300">
                    {bubbleName}
                  </span>
                ) : null}
              </div>
            </div>

            {/* Text input box */}
            <AnimatePresence>
              {isInputOpen && (
                <motion.div
                  key="input-stage"
                  initial={{
                    opacity: 0,
                    scale: 0.95,
                    y: 15,
                    filter: 'blur(4px)',
                  }}
                  animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, scale: 0.95, y: 15, filter: 'blur(4px)' }}
                  onClick={(e) => e.stopPropagation()}
                  className="absolute inset-x-4 bottom-4 z-20 flex items-center justify-center"
                >
                  <div className="relative flex w-full max-w-[min(720px,100%)] min-w-[220px] items-end gap-3 rounded-[26px] border border-slate-200/80 bg-white/95 px-3 py-3 shadow-[0_18px_40px_-18px_rgba(15,23,42,0.22)] ring-1 ring-white/70 backdrop-blur-md dark:border-slate-700/80 dark:bg-slate-900/92 dark:ring-slate-800/70">
                    <div className="flex min-w-0 flex-1 items-end gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                        <MessageSquare className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1 py-1">
                        <textarea
                          value={inputValue}
                          onChange={(e) => setInputValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                              e.preventDefault();
                              handleSendMessage();
                            }
                          }}
                          placeholder={t('roundtable.inputPlaceholder')}
                          autoFocus
                          rows={1}
                          className="min-h-[40px] max-h-[120px] w-full resize-none border-none bg-transparent text-sm text-slate-700 shadow-none outline-none ring-0 placeholder:text-slate-400 focus:outline-none focus:ring-0 dark:text-slate-100 dark:placeholder:text-slate-500"
                          style={{ fieldSizing: 'content' } as Record<string, string>}
                        />
                      </div>
                    </div>
                    <button
                      onClick={handleSendMessage}
                      disabled={isSendCooldown}
                      className={cn(
                        'mb-0.5 shrink-0 rounded-2xl px-3.5 py-3 transition',
                        isSendCooldown
                          ? 'cursor-not-allowed bg-slate-300 dark:bg-slate-700'
                          : cn(classroomPrimaryButton, 'text-sky-950 hover:translate-y-[-1px]'),
                      )}
                    >
                      {isSendCooldown ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Audio recording status */}
              {isVoiceOpen && (
                <motion.div
                  key="voice-stage"
                  initial={{
                    opacity: 0,
                    scale: 0.96,
                    y: 10,
                    filter: 'blur(2px)',
                  }}
                  animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, scale: 0.96, y: 10, filter: 'blur(2px)' }}
                  onClick={(e) => e.stopPropagation()}
                  className="absolute bottom-4 right-4 z-30"
                >
                  <div className="flex items-center gap-2 rounded-full border border-white/88 bg-white/94 px-3 py-2 shadow-[0_18px_36px_rgba(15,23,42,0.12)] backdrop-blur-md dark:border-slate-700/80 dark:bg-slate-900/92">
                    <div className="flex items-center gap-[3px]">
                      {[0, 1, 2, 1].map((intensity, i) => (
                        <motion.div
                          key={i}
                          animate={{
                            scaleY: [0.45, 0.85 + intensity * 0.08, 0.45],
                            opacity: [0.35, 0.9, 0.35],
                          }}
                          transition={{
                            repeat: Infinity,
                            duration: 0.9,
                            delay: i * 0.08,
                            ease: 'easeInOut',
                          }}
                          className="h-4 w-[3px] origin-center rounded-full bg-sky-400"
                        />
                      ))}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-100">
                        {isProcessing ? t('roundtable.processing') : t('roundtable.listening')}
                      </p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500">
                        再点一次即可结束本轮语音
                      </p>
                    </div>
                    <button
                      className={cn(
                        classroomRoundtablePrimaryCircle,
                        'h-10 w-10 shrink-0 shadow-none',
                      )}
                      onClick={handleToggleVoice}
                    >
                      {isProcessing ? (
                        <Loader2 className="h-4 w-4 animate-spin text-current" />
                      ) : (
                        <Mic className="h-4 w-4 text-current" />
                      )}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Thinking dots (Issue 5) */}
            <AnimatePresence>
              {thinkingState?.stage === 'director' && !currentSpeech && !userMessage && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="absolute left-1/2 top-1/2 z-20 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full border border-slate-200/80 bg-white/92 px-4 py-2 shadow-sm backdrop-blur-md dark:border-slate-700/70 dark:bg-slate-900/90"
                >
                  <div className="flex gap-1">
                    <motion.div
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{
                        repeat: Infinity,
                        duration: 1.2,
                        delay: 0,
                      }}
                      className="h-1.5 w-1.5 rounded-full bg-sky-500"
                    />
                    <motion.div
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{
                        repeat: Infinity,
                        duration: 1.2,
                        delay: 0.2,
                      }}
                      className="h-1.5 w-1.5 rounded-full bg-sky-500"
                    />
                    <motion.div
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{
                        repeat: Infinity,
                        duration: 1.2,
                        delay: 0.4,
                      }}
                      className="h-1.5 w-1.5 rounded-full bg-sky-500"
                    />
                  </div>
                  <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                    {t('roundtable.thinking')}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Cue user: centered indicator when waiting for user input */}
            <AnimatePresence>
              {isCueUser && !bubbleRole && !thinkingState && !isInputOpen && !isVoiceOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.85 }}
                  transition={{ duration: 0.35, ease: [0.21, 1, 0.36, 1] }}
                  className="absolute left-1/2 top-1/2 z-20 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-3"
                >
                  <motion.div
                    animate={{
                      boxShadow: [
                        '0 0 0 0 rgba(245,158,11,0.16)',
                        '0 0 0 14px rgba(245,158,11,0)',
                        '0 0 0 0 rgba(245,158,11,0)',
                      ],
                    }}
                    transition={{ repeat: Infinity, duration: 2.2, ease: 'easeOut' }}
                    className="rounded-full"
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (asrEnabled) handleToggleVoice();
                        else handleToggleInput();
                      }}
                      className={cn(
                        'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold shadow-[0_16px_36px_rgba(15,23,42,0.12)] transition hover:-translate-y-[1px] active:scale-95',
                        asrEnabled
                          ? 'border-amber-200 bg-[linear-gradient(180deg,rgba(255,251,235,0.98),rgba(254,243,199,0.94))] text-amber-700 dark:border-amber-700/40 dark:bg-amber-950/38 dark:text-amber-100'
                          : 'border-sky-200 bg-[linear-gradient(180deg,rgba(240,249,255,0.98),rgba(224,242,254,0.94))] text-sky-700 dark:border-sky-700/40 dark:bg-sky-950/36 dark:text-sky-100',
                      )}
                    >
                      {asrEnabled ? <Mic className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
                      {primaryCueActionLabel}
                    </button>
                  </motion.div>

                  <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    {t('roundtable.yourTurn')}，支持语音或文字继续
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Chat bubble */}
            <AnimatePresence mode="wait">
              {bubbleRole && (
                <motion.div
                  key={bubbleKey}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{
                    opacity: isInputOpen || isVoiceOpen ? 0.4 : 1,
                    y: 0,
                    filter: isInputOpen || isVoiceOpen ? 'blur(1px) grayscale(0.2)' : 'none',
                  }}
                  exit={{ opacity: 0, y: -8, transition: { duration: 0.12 } }}
                  transition={{ duration: 0.2, ease: [0.21, 1, 0.36, 1] }}
                  className="w-full flex items-center relative z-10"
                >
                  <div
                    className={cn(
                      'flex w-full transition-all duration-500',
                      bubbleRole === 'teacher' ? 'justify-start' : 'justify-end',
                    )}
                  >
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        if (bubbleRole === 'user') return;
                        // Topic pending: click Play to resume
                        if (isTopicPending) {
                          onResumeTopic?.();
                          return;
                        }
                        // QA/Discussion: soft pause (interrupt agent but keep session active)
                        if (isInLiveFlow) {
                          onSoftPause?.();
                          return;
                        }
                        // Lecture playback: toggle play/pause
                        onPlayPause?.();
                      }}
                      className={cn(
                        'group/bubble relative flex max-h-[112px] min-w-[220px] max-w-[min(70%,720px)] flex-col rounded-[22px] border px-4 pb-3.5 pt-3 text-[14px] leading-[1.72] transition-all',
                        bubbleRole === 'teacher' ? 'pl-4 pr-10' : 'pl-4 pr-10',
                        bubbleRole === 'user'
                          ? classroomRoundtableUserBubble
                          : bubbleRole === 'agent'
                            ? cn(
                                classroomRoundtableAgentBubble,
                                (isInLiveFlow || isTopicPending) &&
                                  'cursor-pointer hover:border-sky-300 hover:shadow-md dark:hover:border-sky-400/35',
                              )
                            : cn(
                                classroomRoundtableTeacherBubble,
                                'cursor-pointer hover:border-slate-300 hover:shadow-md dark:hover:border-slate-500',
                              ),
                      )}
                    >
                      {bubbleRole &&
                        (() => {
                          const bubbleAvatar =
                            bubbleRole === 'user'
                              ? userAvatar
                              : bubbleRole === 'agent'
                                ? speakingStudent?.avatar || userAvatar
                                : teacherAvatar;
                          return (
                            <div
                              className={cn(
                                'absolute -top-2.5 z-20 pointer-events-none select-none',
                                bubbleRole === 'teacher' ? '-left-2.5' : '-right-2.5',
                              )}
                              title={bubbleName}
                            >
                              <div
                                className={cn(
                                  'w-6 h-6 rounded-full overflow-hidden border-2 shadow-sm',
                                  bubbleRole === 'user'
                                    ? 'border-teal-300 dark:border-teal-300/60'
                                    : bubbleRole === 'agent'
                                      ? 'border-sky-300 dark:border-sky-400/50'
                                      : 'border-slate-200 dark:border-slate-600',
                                )}
                              >
                                <AvatarDisplay src={bubbleAvatar} alt={bubbleName} />
                              </div>
                            </div>
                          );
                        })()}

                      <div className="mb-1.5 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                        <span>{bubbleName}</span>
                        {bubbleRole !== 'user' ? (
                          <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                        ) : null}
                      </div>

                      <div ref={bubbleScrollRef} className="overflow-y-auto scrollbar-hide pr-1">
                        {isBubbleLoading ? (
                          <div className="flex gap-1 items-center py-1">
                            <motion.div
                              animate={{ opacity: [0.3, 1, 0.3] }}
                              transition={{
                                repeat: Infinity,
                                duration: 1,
                                delay: 0,
                              }}
                              className={cn(
                                'w-1.5 h-1.5 rounded-full',
                                isAgentLoading
                                  ? 'bg-sky-400 dark:bg-sky-400'
                                  : 'bg-slate-400 dark:bg-slate-500',
                              )}
                            />
                            <motion.div
                              animate={{ opacity: [0.3, 1, 0.3] }}
                              transition={{
                                repeat: Infinity,
                                duration: 1,
                                delay: 0.2,
                              }}
                              className={cn(
                                'w-1.5 h-1.5 rounded-full',
                                isAgentLoading
                                  ? 'bg-sky-400 dark:bg-sky-400'
                                  : 'bg-slate-400 dark:bg-slate-500',
                              )}
                            />
                            <motion.div
                              animate={{ opacity: [0.3, 1, 0.3] }}
                              transition={{
                                repeat: Infinity,
                                duration: 1,
                                delay: 0.4,
                              }}
                              className={cn(
                                'w-1.5 h-1.5 rounded-full',
                                isAgentLoading
                                  ? 'bg-sky-400 dark:bg-sky-400'
                                  : 'bg-slate-400 dark:bg-slate-500',
                              )}
                            />
                          </div>
                        ) : (
                          <p
                            className="whitespace-pre-wrap break-words text-[14px] leading-[1.72]"
                            suppressHydrationWarning
                          >
                            {sourceText}
                            {isTopicPending && (
                              <span className="ml-1 inline-block h-1.5 w-1.5 align-middle rounded-full bg-amber-500" />
                            )}
                          </p>
                        )}
                      </div>

                      {/* Playback state icon (hidden during loading — dots already indicate activity) */}
                      {bubbleRole !== 'user' &&
                        !isBubbleLoading &&
                        (() => {
                          const btnState = playbackView?.buttonState ?? 'none';
                          const barsColor = bubbleRole === 'agent' ? 'bg-sky-500' : 'bg-slate-500';

                          if (btnState === 'none') return null;

                          if (btnState === 'play') {
                            return (
                              <div className="absolute bottom-2.5 right-2.5 cursor-pointer rounded-full bg-slate-100/90 p-1.5 transition-all duration-300 hover:bg-sky-50 group-hover/bubble:bg-sky-50 dark:bg-slate-800/88 dark:hover:bg-sky-500/15 dark:group-hover/bubble:bg-sky-500/15">
                                <Play className="ml-0.5 h-3.5 w-3.5 text-slate-500 hover:text-sky-700 group-hover/bubble:text-sky-700 dark:text-slate-400 dark:hover:text-sky-200 dark:group-hover/bubble:text-sky-200" />
                              </div>
                            );
                          }

                          if (btnState === 'restart') {
                            return (
                              <div className="absolute bottom-2.5 right-2.5 cursor-pointer rounded-full bg-slate-100/90 p-1.5 transition-all duration-300 hover:bg-sky-50 group-hover/bubble:bg-sky-50 dark:bg-slate-800/88 dark:hover:bg-sky-500/15 dark:group-hover/bubble:bg-sky-500/15">
                                <Repeat className="h-3.5 w-3.5 text-slate-500 hover:text-sky-700 group-hover/bubble:text-sky-700 dark:text-slate-400 dark:hover:text-sky-200 dark:group-hover/bubble:text-sky-200" />
                              </div>
                            );
                          }

                          // btnState === 'bars'
                          return (
                            <div className="absolute bottom-2.5 right-2.5 rounded-full bg-slate-100/90 p-1.5 transition-all duration-300 group-hover/bubble:bg-sky-50 dark:bg-slate-800/88 dark:group-hover/bubble:bg-sky-500/15">
                              {/* Breathing bars — visible by default, hidden on hover */}
                              <div className="flex gap-0.5 items-end justify-center h-3.5 w-3.5 group-hover/bubble:hidden">
                                <motion.div
                                  animate={{ height: ['20%', '100%', '20%'] }}
                                  transition={{
                                    repeat: Infinity,
                                    duration: 0.6,
                                  }}
                                  className={cn('w-1 rounded-full', barsColor)}
                                />
                                <motion.div
                                  animate={{ height: ['40%', '100%', '40%'] }}
                                  transition={{
                                    repeat: Infinity,
                                    duration: 0.4,
                                  }}
                                  className={cn('w-1 rounded-full', barsColor)}
                                />
                                <motion.div
                                  animate={{ height: ['20%', '80%', '20%'] }}
                                  transition={{
                                    repeat: Infinity,
                                    duration: 0.5,
                                  }}
                                  className={cn('w-1 rounded-full', barsColor)}
                                />
                              </div>
                              {/* Pause icon on hover */}
                              <Pause className="hidden h-3.5 w-3.5 text-sky-700 group-hover/bubble:block dark:text-sky-200" />
                            </div>
                          );
                        })()}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Right: Participants area */}
        <div className="flex w-[134px] shrink-0 flex-col overflow-visible border-l border-sky-100/80 bg-[linear-gradient(180deg,rgba(251,253,255,0.88),rgba(244,248,251,0.94))] px-1.5 py-1.5 dark:border-slate-800/80 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.78),rgba(10,14,22,0.94))] sm:w-[164px]">
          <div className="flex min-h-0 flex-1 flex-col gap-1.5">
            <div className="rounded-[22px] border border-white/92 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(247,250,253,0.9))] px-2.5 py-2.5 shadow-[0_14px_34px_rgba(15,23,42,0.05)] dark:border-slate-800/76 dark:bg-slate-900/72">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[9px] font-semibold tracking-[0.16em] text-slate-400 dark:text-slate-500">
                  协同角色
                </span>
                <span className={classroomTonePill('slate', 'px-1.5 py-0.5 text-[8px]')}>
                  {studentParticipants.length}
                </span>
              </div>

              <div ref={agentScrollRef} className="mt-2.5 max-h-[76px] overflow-y-auto pr-1 scrollbar-hide">
                <div className="grid grid-cols-2 gap-1.5">
                  {studentParticipants.map((student) => {
                    const isSpeaking = speakingAgentId === student.id;
                    const isThinkingAgent =
                      thinkingState?.stage === 'agent_loading' &&
                      thinkingState.agentId === student.id;
                    const agentConfig = useAgentRegistry.getState().getAgent(student.id);
                    const roleLabelKey = agentConfig?.role as
                      | 'teacher'
                      | 'assistant'
                      | 'student'
                      | undefined;
                    const roleLabel = roleLabelKey ? t(`settings.agentRoles.${roleLabelKey}`) : '';
                    const i18nDescription = t(`settings.agentDescriptions.${student.id}`);
                    const description =
                      i18nDescription !== `settings.agentDescriptions.${student.id}`
                        ? i18nDescription
                        : agentConfig?.persona || '';
                    const hasDescription = !!description;
                    const isDiscussionAgent =
                      !!discussionRequest && discussionRequest.agentId === student.id;
                    return (
                      <div
                        key={student.id}
                        data-agent-id={student.id}
                        className="relative"
                      >
                        {isDiscussionAgent && (
                          <motion.div
                            animate={{ scale: [1, 1.12, 1], opacity: [0.65, 0.15, 0.65] }}
                            transition={{ repeat: Infinity, duration: 2.1, ease: 'easeInOut' }}
                            className="absolute inset-0 rounded-[18px] pointer-events-none"
                            style={{ border: `1.5px solid ${agentConfig?.color || '#d97706'}` }}
                          />
                        )}
                        <HoverCard openDelay={300} closeDelay={100}>
                          <HoverCardTrigger asChild>
                            <div
                              className={cn(
                                'group/student flex cursor-pointer flex-col items-center gap-1 rounded-[16px] border px-1.5 py-1.5 transition-all',
                                isSpeaking
                                  ? 'border-sky-200 bg-sky-50/90 shadow-sm dark:border-sky-500/30 dark:bg-sky-500/12'
                                  : 'border-slate-200/80 bg-white/88 hover:border-slate-300 hover:bg-white dark:border-slate-800/80 dark:bg-slate-950/45 dark:hover:border-slate-700',
                              )}
                            >
                              <div className="relative h-8 w-8">
                                <div className="absolute inset-0 overflow-hidden rounded-full border border-white bg-gray-100 dark:border-slate-700 dark:bg-slate-800">
                                  <img src={student.avatar} alt={student.name} className="h-full w-full" />
                                </div>
                                {isSpeaking && (
                                  <div className="absolute -right-0.5 -top-0.5 z-20 flex h-2.5 w-2.5 items-center justify-center rounded-full border border-white bg-emerald-500 dark:border-slate-800">
                                    <div className="h-1 w-1 rounded-full bg-white animate-pulse" />
                                  </div>
                                )}
                                {isThinkingAgent && (
                                  <div className="absolute inset-0 z-20 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
                                )}
                              </div>
                              <span className="max-w-full truncate text-[9px] font-medium text-slate-600 dark:text-slate-200">
                                {student.name}
                              </span>
                            </div>
                          </HoverCardTrigger>
                          <HoverCardContent
                            side="bottom"
                            align="center"
                            className="w-64 max-h-[300px] overflow-y-auto p-3"
                          >
                            <div className="flex items-center gap-2">
                              <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                                <img
                                  src={student.avatar}
                                  alt={student.name}
                                  className="h-full w-full"
                                />
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium">{student.name}</p>
                                {roleLabel && roleLabel !== `settings.agentRoles.${roleLabelKey}` && (
                                  <span
                                    className="mt-0.5 inline-block rounded-full px-1.5 py-0.5 text-[10px] leading-tight text-white"
                                    style={{ backgroundColor: agentConfig?.color || '#6b7280' }}
                                  >
                                    {roleLabel}
                                  </span>
                                )}
                              </div>
                            </div>
                            {hasDescription && (
                              <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-muted-foreground">
                                {description}
                              </p>
                            )}
                          </HoverCardContent>
                        </HoverCard>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="rounded-[22px] border border-white/92 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(247,250,253,0.9))] px-2.5 py-2.5 shadow-[0_14px_34px_rgba(15,23,42,0.05)] dark:border-slate-800/76 dark:bg-slate-900/72">
              <div className="flex items-center gap-2.5">
                <div
                  className={cn(
                    'relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-all duration-300',
                    activeRole === 'user' || isInputOpen || isCueUser ? 'scale-[1.02]' : 'opacity-95',
                  )}
                >
                  <div
                    className={cn(
                      'absolute inset-0 rounded-full border-2 transition-all duration-300',
                      isCueUser
                        ? 'border-amber-500 shadow-[0_0_0_6px_rgba(245,158,11,0.14)] dark:border-amber-400'
                        : activeRole === 'user' || isInputOpen || isVoiceOpen
                          ? 'border-sky-500 shadow-[0_0_0_6px_rgba(56,189,248,0.14)] dark:border-sky-400'
                          : 'border-white dark:border-slate-700',
                    )}
                  />
                  <div className="relative z-10 h-9 w-9 overflow-hidden rounded-full border border-white bg-gray-50 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                    <AvatarDisplay src={userAvatar} alt="You" />
                  </div>
                  <div className="absolute right-0 top-0 z-20 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-white bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
                    <div
                      className={cn(
                        'h-1.5 w-1.5 rounded-full',
                        isCueUser || isInputOpen || isVoiceOpen
                          ? 'bg-sky-500 animate-pulse'
                          : 'bg-slate-300 dark:bg-slate-600',
                      )}
                    />
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-semibold tracking-[0.16em] text-slate-400 dark:text-slate-500">
                      学生席
                    </span>
                    <span className={classroomTonePill(studentDockTone, 'px-1.5 py-0.5 text-[8px]')}>
                      {studentDockStatus}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
                    语音和文字入口统一放在这里
                  </p>
                </div>
              </div>

              <div className="mt-2.5">
                {isSendCooldown ? (
                  <div className="flex h-9 items-center justify-center rounded-[16px] border border-slate-200/80 bg-white/82 dark:border-slate-700/80 dark:bg-slate-900/82">
                    <div className="flex items-center gap-[4px]">
                      {[0, 1, 2].map((i) => (
                        <motion.div
                          key={i}
                          animate={{ y: [0, -3, 0], opacity: [0.35, 0.9, 0.35] }}
                          transition={{
                            repeat: Infinity,
                            duration: 0.9,
                            delay: i * 0.12,
                            ease: 'easeInOut',
                          }}
                          className="h-[4px] w-[4px] rounded-full bg-sky-400 dark:bg-sky-400"
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (asrEnabled) handleToggleVoice();
                      }}
                      disabled={!asrEnabled}
                      className={cn(
                        'flex h-10 flex-col items-center justify-center gap-0.5 rounded-[16px] border transition-all active:scale-95 shadow-sm',
                        !asrEnabled
                          ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-300 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-600'
                          : isVoiceOpen
                            ? 'border-teal-200 bg-teal-50 text-teal-700 shadow-teal-100 dark:border-teal-500/30 dark:bg-teal-500/18 dark:text-teal-100 dark:shadow-teal-900/18'
                            : 'border-slate-200 bg-white text-slate-500 hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:border-sky-400/35 dark:hover:bg-sky-500/15 dark:hover:text-sky-200',
                      )}
                    >
                      {asrEnabled ? <Mic className="h-3.5 w-3.5" /> : <MicOff className="h-3.5 w-3.5" />}
                      <span className="text-[10px] font-semibold">语音</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleInput();
                      }}
                      className={cn(
                        'flex h-10 flex-col items-center justify-center gap-0.5 rounded-[16px] border transition-all active:scale-95 shadow-sm',
                        isInputOpen
                          ? 'border-sky-200 bg-sky-50 text-sky-700 shadow-sky-100 dark:border-sky-500/30 dark:bg-sky-500/18 dark:text-sky-100 dark:shadow-sky-900/18'
                          : 'border-slate-200 bg-white text-slate-500 hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:border-sky-400/35 dark:hover:bg-sky-500/15 dark:hover:text-sky-200',
                      )}
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      <span className="text-[10px] font-semibold">文字</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* close interaction row */}
    </div>
  );
}

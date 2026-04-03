'use client';

import { useImperativeHandle, forwardRef, useRef, useCallback, useState, useMemo } from 'react';
import type { SessionType } from '@/lib/types/chat';
import type { LectureNoteEntry } from '@/lib/types/chat';
import type { DiscussionRequest } from '@/components/roundtable';
import type { Action, SpeechAction, DiscussionAction } from '@/lib/types/action';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/hooks/use-i18n';
import { useStageStore } from '@/lib/store';
import { PanelRightClose, BookOpen, MessageSquare } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useChatSessions } from './use-chat-sessions';
import { SessionList } from './session-list';
import { LectureNotesView } from './lecture-notes-view';
import {
  classroomIconButton,
  classroomToneCard,
  classroomTonePill,
  classroomToolbarStrip,
} from '@/lib/ui/classroom-theme';

interface ChatAreaProps {
  className?: string;
  width?: number;
  onWidthChange?: (width: number) => void;
  collapsed?: boolean;
  onCollapseChange?: (collapsed: boolean) => void;
  activeBubbleId?: string | null;
  onActiveBubble?: (messageId: string | null) => void;
  onLiveSpeech?: (text: string | null, agentId?: string | null) => void;
  onSpeechProgress?: (ratio: number | null) => void;
  onThinking?: (state: { stage: string; agentId?: string } | null) => void;
  onCueUser?: (fromAgentId?: string, prompt?: string) => void;
  onStopSession?: () => void;
  currentSceneId?: string | null;
}

export interface ChatAreaRef {
  createSession: (type: SessionType, title: string) => Promise<string>;
  endSession: (sessionId: string) => Promise<void>;
  endActiveSession: () => Promise<void>;
  softPauseActiveSession: () => Promise<void>;
  resumeActiveSession: () => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  startDiscussion: (request: DiscussionRequest) => Promise<void>;
  startLecture: (sceneId: string) => Promise<string>;
  addLectureMessage: (sessionId: string, action: Action, actionIndex: number) => void;
  getIsStreaming: () => boolean;
  getActiveSessionType: () => string | null;
  getLectureMessageId: (sessionId: string) => string | null;
  pauseBuffer: (sessionId: string) => void;
  resumeBuffer: (sessionId: string) => void;
  switchToTab: (tab: 'lecture' | 'chat') => void;
}

const DEFAULT_WIDTH = 320;
const MIN_WIDTH = 240;
const MAX_WIDTH = 500;

export const ChatArea = forwardRef<ChatAreaRef, ChatAreaProps>(
  (
    {
      className,
      width = DEFAULT_WIDTH,
      onWidthChange,
      collapsed = false,
      onCollapseChange,
      activeBubbleId,
      onActiveBubble,
      onLiveSpeech,
      onSpeechProgress,
      onThinking,
      onCueUser,
      onStopSession,
      currentSceneId,
    },
    ref,
  ) => {
    const { t } = useI18n();
    const scenes = useStageStore((s) => s.scenes);
    const {
      sessions,
      activeSessionType,
      expandedSessionIds,
      isStreaming,
      createSession,
      endSession,
      endActiveSession,
      softPauseActiveSession,
      resumeActiveSession,
      sendMessage,
      startDiscussion,
      startLecture,
      addLectureMessage,
      toggleSessionExpand,
      getLectureMessageId,
      pauseBuffer,
      resumeBuffer,
    } = useChatSessions({
      onLiveSpeech,
      onSpeechProgress,
      onThinking,
      onCueUser,
      onActiveBubble,
      onStopSession,
    });

    const [activeTab, setActiveTab] = useState<'lecture' | 'chat'>('lecture');
    const isDraggingRef = useRef(false);
    const [isDragging, setIsDragging] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);

    // Derive lecture notes directly from scenes — updates reactively as scenes stream in
    // Preserves action order so spotlight/laser badges appear inline between speech texts
    const lectureNotes: LectureNoteEntry[] = useMemo(
      () =>
        scenes
          .filter((scene) => scene.actions && scene.actions.length > 0)
          .map((scene) => ({
            sceneId: scene.id,
            sceneTitle: scene.title,
            sceneOrder: scene.order,
            items: scene
              .actions!.filter(
                (a) =>
                  a.type === 'speech' ||
                  a.type === 'spotlight' ||
                  a.type === 'laser' ||
                  a.type === 'play_video' ||
                  a.type === 'discussion',
              )
              .map((a) => {
                if (a.type === 'speech') {
                  return {
                    kind: 'speech' as const,
                    text: (a as SpeechAction).text,
                  };
                }
                return {
                  kind: 'action' as const,
                  type: a.type,
                  label: a.type === 'discussion' ? (a as DiscussionAction).topic : undefined,
                };
              }),
            completedAt: scene.updatedAt || scene.createdAt || 0,
          }))
          .sort((a, b) => a.sceneOrder - b.sceneOrder),
      [scenes],
    );

    // Filter out lecture sessions for the Chat tab
    const chatSessions = useMemo(() => sessions.filter((s) => s.type !== 'lecture'), [sessions]);

    // Whether there's an active discussion/QA session (for amber dot on Chat tab)
    const hasActiveChatSession = useMemo(
      () => chatSessions.some((s) => s.status === 'active'),
      [chatSessions],
    );
    const chatSessionCountLabel = chatSessions.length > 0 ? `${chatSessions.length} 段对话` : '暂无对话';

    // Wrap endSession for QA/Discussion: also notify parent for engine cleanup
    const handleEndSession = useCallback(
      async (sessionId: string) => {
        await endSession(sessionId);
        onStopSession?.();
      },
      [endSession, onStopSession],
    );

    const switchToTab = useCallback((tab: 'lecture' | 'chat') => {
      setActiveTab(tab);
    }, []);

    useImperativeHandle(ref, () => ({
      createSession,
      endSession,
      endActiveSession,
      softPauseActiveSession,
      resumeActiveSession,
      sendMessage,
      startDiscussion,
      startLecture,
      addLectureMessage,
      getIsStreaming: () => isStreaming,
      getActiveSessionType: () => activeSessionType,
      getLectureMessageId,
      pauseBuffer,
      resumeBuffer,
      switchToTab,
    }));

    // Drag-to-resize
    const handleDragStart = useCallback(
      (e: React.MouseEvent) => {
        e.preventDefault();
        isDraggingRef.current = true;
        setIsDragging(true);
        const startX = e.clientX;
        const startWidth = width;

        const handleMouseMove = (me: MouseEvent) => {
          const delta = startX - me.clientX;
          const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + delta));
          onWidthChange?.(newWidth);
        };

        const handleMouseUp = () => {
          isDraggingRef.current = false;
          setIsDragging(false);
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
      [width, onWidthChange],
    );

    const displayWidth = collapsed ? 0 : width;

    return (
      <div
        style={{
          width: displayWidth,
          transition: isDragging ? 'none' : 'width 0.3s ease',
        }}
        className={cn(
          'border-l border-sky-100/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(244,249,255,0.88))] shadow-[-2px_0_24px_rgba(56,189,248,0.05)] backdrop-blur-xl flex flex-col shrink-0 z-20 relative overflow-visible dark:border-slate-800 dark:bg-slate-900/80',
          className,
        )}
      >
        {/* Drag handle */}
        {!collapsed && (
          <div
            onMouseDown={handleDragStart}
            className="absolute left-0 top-0 bottom-0 z-50 w-1.5 cursor-col-resize transition-colors group hover:bg-sky-400/30 dark:hover:bg-sky-600/30 active:bg-sky-500/40 dark:active:bg-sky-500/40"
          >
            <div className="absolute left-0.5 top-1/2 h-8 w-0.5 -translate-y-1/2 rounded-full bg-gray-300 transition-colors group-hover:bg-sky-400 dark:bg-gray-600 dark:group-hover:bg-sky-500" />
          </div>
        )}

        <div className={cn('flex flex-col w-full h-full overflow-hidden', collapsed && 'hidden')}>
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as 'lecture' | 'chat')}
            className="flex flex-col h-full gap-0"
          >
            {/* Tab header row */}
            <div className="mt-2 mb-1 shrink-0 px-3">
              <div className={cn(classroomToolbarStrip, 'flex-col items-stretch gap-2 rounded-[20px] px-2.5 py-2.5')}>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold tracking-[0.12em] text-slate-500 dark:text-slate-400">
                      讲义与对话
                    </div>
                    <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {chatSessionCountLabel}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={classroomTonePill(
                        hasActiveChatSession ? 'amber' : 'slate',
                        'px-2 py-0.5 text-[10px] font-medium tracking-normal normal-case',
                      )}
                    >
                      {hasActiveChatSession ? '对话进行中' : '讲义可回看'}
                    </span>
                    {onCollapseChange && (
                      <button
                        onClick={() => onCollapseChange(true)}
                        className={cn(classroomIconButton, 'h-8 w-8 shrink-0 rounded-lg active:scale-90')}
                      >
                        <PanelRightClose className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <TabsList variant="line" className="h-10 w-full">
                  <TabsTrigger value="lecture" className="text-xs gap-1 flex-1">
                    <BookOpen className="w-3.5 h-3.5" />
                    {t('chat.tabs.lecture')}
                  </TabsTrigger>
                  <TabsTrigger value="chat" className="text-xs gap-1 flex-1 relative">
                    <MessageSquare className="w-3.5 h-3.5" />
                    {t('chat.tabs.chat')}
                    {hasActiveChatSession && activeTab === 'lecture' && (
                      <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                      </span>
                    )}
                  </TabsTrigger>
                </TabsList>
              </div>
            </div>

            {/* Notes Tab */}
            <TabsContent value="lecture" className="flex-1 overflow-hidden flex flex-col">
              <LectureNotesView notes={lectureNotes} currentSceneId={currentSceneId} />
            </TabsContent>

            {/* Chat Tab */}
            <TabsContent value="chat" className="flex-1 overflow-hidden flex flex-col">
              <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-2 scrollbar-hide">
                {chatSessions.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center p-6 text-center">
                    <div
                      className={cn(
                        classroomToneCard('slate', 'flex max-w-[220px] flex-col items-center px-5 py-5'),
                      )}
                    >
                      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-sky-50 text-sky-400 dark:bg-slate-800 dark:text-slate-500">
                        <MessageSquare className="w-6 h-6" />
                      </div>
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                        {t('chat.noConversations')}
                      </p>
                      <p className="mt-1 text-[11px] leading-5 text-slate-500 dark:text-slate-400">
                        {t('chat.startConversation')}
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <SessionList
                      sessions={chatSessions}
                      expandedSessionIds={expandedSessionIds}
                      isStreaming={isStreaming}
                      activeBubbleId={activeBubbleId}
                      onToggleExpand={toggleSessionExpand}
                      onEndSession={handleEndSession}
                    />
                    <div ref={bottomRef} />
                  </>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    );
  },
);

ChatArea.displayName = 'ChatArea';

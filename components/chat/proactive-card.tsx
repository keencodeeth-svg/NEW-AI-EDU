'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Play, Pause, X } from 'lucide-react';
import { useI18n } from '@/lib/hooks/use-i18n';
import type { DiscussionAction } from '@/lib/types/action';

interface ProactiveCardProps {
  action: DiscussionAction;
  mode: 'playback' | 'paused' | 'autonomous';
  agentName?: string;
  agentAvatar?: string;
  agentColor?: string;
  onSkip: () => void;
  onListen: () => void;
  onTogglePause: () => void;
}

export const ProactiveCard = ({
  action,
  mode,
  agentName,
  agentAvatar,
  agentColor,
  onSkip,
  onListen,
  onTogglePause,
}: ProactiveCardProps) => {
  return (
    <ProactiveCardBody
      key={`${action.agentId}-${action.topic}`}
      action={action}
      mode={mode}
      agentName={agentName}
      agentAvatar={agentAvatar}
      agentColor={agentColor}
      onSkip={onSkip}
      onListen={onListen}
      onTogglePause={onTogglePause}
    />
  );
};

function ProactiveCardBody({
  action,
  mode,
  agentName,
  agentAvatar,
  agentColor,
  onSkip,
  onListen,
  onTogglePause,
}: ProactiveCardProps) {
  const { t } = useI18n();
  const [progress, setProgress] = useState(100);
  const skippedRef = useRef(false);
  const isPaused = mode === 'paused';

  useEffect(() => {
    if (mode !== 'playback') return;

    const duration = 5000;
    const interval = 50;
    const step = (interval / duration) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        const newProgress = prev - step;
        if (newProgress <= 0) {
          clearInterval(timer);
          return 0;
        }
        return newProgress;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [mode]);

  useEffect(() => {
    if (progress <= 0 && !skippedRef.current && mode === 'playback') {
      skippedRef.current = true;
      onSkip();
    }
  }, [progress, onSkip, mode]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6, scale: 0.98, transition: { duration: 0.18 } }}
      className="relative mx-2.5 mt-1.5 mb-1 overflow-hidden rounded-[1.35rem] border border-amber-200/70 bg-amber-50/92 shadow-[0_10px_28px_rgba(217,119,6,0.12)] backdrop-blur-md dark:border-amber-800/60 dark:bg-amber-950/28 dark:shadow-[0_12px_32px_rgba(0,0,0,0.18)]"
    >
      <div className="absolute inset-x-0 bottom-0 h-1 bg-amber-100/80 dark:bg-amber-900/40">
        <div
          className={`h-full transition-all duration-[50ms] ease-linear ${
            isPaused
              ? 'bg-amber-200/80 dark:bg-amber-800/70'
              : 'bg-gradient-to-r from-amber-400 to-orange-500 dark:from-amber-500 dark:to-orange-600'
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 px-3.5 py-2.5 sm:flex-nowrap">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/80 bg-white shadow-sm dark:border-amber-900/60 dark:bg-amber-950/30"
            style={{
              boxShadow: agentColor ? `0 0 0 1px ${agentColor}22` : undefined,
            }}
          >
            {agentAvatar ? (
              <img src={agentAvatar} alt={agentName || ''} className="h-full w-full object-cover" />
            ) : (
              <span className="text-sm font-bold text-amber-700 dark:text-amber-300">
                {(agentName || t('roundtable.teacher')).slice(0, 1)}
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-1.5 text-[10px]">
              {agentName ? (
                <span className="max-w-[120px] truncate font-semibold text-amber-900 dark:text-amber-100">
                  {agentName}
                </span>
              ) : null}
              <span
                className="rounded-full px-2 py-0.5 font-black uppercase tracking-[0.16em]"
                style={{
                  color: agentColor || '#b45309',
                  backgroundColor: agentColor ? `${agentColor}1a` : 'rgba(245, 158, 11, 0.14)',
                }}
              >
                {t('proactiveCard.discussion')}
              </span>
              <span className="rounded-full bg-white/80 px-1.5 py-0.5 font-semibold text-amber-700 dark:bg-amber-950/45 dark:text-amber-300">
                {Math.max(0, Math.ceil((progress / 100) * 5))}s
              </span>
            </div>

            <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-amber-950 dark:text-amber-50">
              {action.topic}
            </p>
          </div>
        </div>

        <div className="ml-auto flex w-full shrink-0 items-center justify-end gap-1.5 sm:w-auto">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onTogglePause();
            }}
            className={`inline-flex h-9 w-9 items-center justify-center rounded-full border transition-colors active:scale-95 ${
              isPaused
                ? 'border-amber-300 bg-white text-amber-600 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-900/50'
                : 'border-amber-200 bg-white text-amber-700 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200 dark:hover:bg-amber-900/50'
            }`}
            title={isPaused ? t('proactiveCard.resume') : t('proactiveCard.pause')}
          >
            {isPaused ? (
              <Play className="h-3.5 w-3.5 fill-current" />
            ) : (
              <Pause className="h-3.5 w-3.5 fill-current" />
            )}
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onListen();
            }}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-4 text-[12px] font-black text-white shadow-sm shadow-amber-300/50 transition-all hover:from-amber-500 hover:to-orange-600 active:scale-[0.98] dark:shadow-amber-900/30"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            {t('proactiveCard.join')}
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onSkip();
            }}
            className="inline-flex h-9 items-center justify-center gap-1 rounded-full border border-amber-200 bg-white px-3 text-[12px] font-semibold text-amber-700 transition-colors hover:bg-amber-100 active:scale-[0.98] dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200 dark:hover:bg-amber-900/50"
            title={t('proactiveCard.skip')}
          >
            <X className="h-3.5 w-3.5" />
            {t('proactiveCard.skip')}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

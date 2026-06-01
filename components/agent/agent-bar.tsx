'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/hooks/use-i18n';
import { useSettingsStore } from '@/lib/store/settings';
import { useAgentRegistry } from '@/lib/orchestration/registry/store';
import { Sparkles, ChevronDown, ChevronUp, Shuffle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export function AgentBar({ compact = false }: { compact?: boolean } = {}) {
  const { t } = useI18n();
  const { listAgents } = useAgentRegistry();
  const selectedAgentIds = useSettingsStore((s) => s.selectedAgentIds);
  const setSelectedAgentIds = useSettingsStore((s) => s.setSelectedAgentIds);
  const maxTurns = useSettingsStore((s) => s.maxTurns);
  const setMaxTurns = useSettingsStore((s) => s.setMaxTurns);
  const agentMode = useSettingsStore((s) => s.agentMode);
  const setAgentMode = useSettingsStore((s) => s.setAgentMode);

  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const allAgents = listAgents();
  // In preset mode, only show default (non-generated) agents
  const agents = allAgents.filter((a) => !a.isGenerated);
  const teacherAgent = agents.find((a) => a.role === 'teacher');
  const selectedAgents = agents.filter((a) => selectedAgentIds.includes(a.id));
  const nonTeacherSelected = selectedAgents.filter((a) => a.role !== 'teacher');

  // Click-outside to collapse
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleModeChange = (mode: 'preset' | 'auto') => {
    setAgentMode(mode);
    if (mode === 'preset') {
      // Ensure a teacher is always selected in preset mode
      const hasTeacherSelected = selectedAgentIds.some((id) => {
        const a = agents.find((agent) => agent.id === id);
        return a?.role === 'teacher';
      });
      if (!hasTeacherSelected && teacherAgent) {
        setSelectedAgentIds([teacherAgent.id, ...selectedAgentIds]);
      }
    }
  };

  const toggleAgent = (agentId: string) => {
    const agent = agents.find((a) => a.id === agentId);
    if (agent?.role === 'teacher') return; // teacher is always selected
    if (selectedAgentIds.includes(agentId)) {
      setSelectedAgentIds(selectedAgentIds.filter((id) => id !== agentId));
    } else {
      setSelectedAgentIds([...selectedAgentIds, agentId]);
    }
  };

  const getAgentName = (agent: { id: string; name: string }) => {
    const key = `settings.agentNames.${agent.id}`;
    const translated = t(key);
    return translated !== key ? translated : agent.name;
  };

  const getAgentRole = (agent: { role: string }) => {
    const key = `settings.agentRoles.${agent.role}`;
    const translated = t(key);
    return translated !== key ? translated : agent.role;
  };

  /* ── Shared avatar row — always visible on the right side ── */
  const avatarRow = (
    <div className="flex items-center gap-1.5 shrink-0">
      {/* Teacher avatar — always shown */}
      {teacherAgent && (
        <div
          className={cn(
            'rounded-full overflow-hidden ring-2 ring-sky-400/40 dark:ring-sky-500/30 shrink-0',
            compact ? 'size-7' : 'size-8',
          )}
        >
          <img
            src={teacherAgent.avatar}
            alt={getAgentName(teacherAgent)}
            className="size-full object-cover"
          />
        </div>
      )}

      {agentMode === 'auto' ? (
        <>
          {/* In auto mode: show assistant avatar + shuffle indicator */}
          <div className="flex -space-x-2">
            {agents.find((a) => a.role === 'assistant') && (
              <div
                className={cn(
                  'rounded-full overflow-hidden ring-[1.5px] ring-background',
                  compact ? 'size-[22px]' : 'size-6',
                )}
              >
                <img
                  src={agents.find((a) => a.role === 'assistant')!.avatar}
                  alt=""
                  className="size-full object-cover"
                />
              </div>
            )}
          </div>
          <Shuffle className={cn(compact ? 'size-3.5' : 'size-4', 'text-sky-400 dark:text-sky-500')} />
        </>
      ) : (
        <>
          {/* In preset mode: show selected non-teacher agents */}
          {nonTeacherSelected.length > 0 && (
            <div className="flex -space-x-2">
              {nonTeacherSelected.slice(0, 4).map((agent) => (
                <div
                  key={agent.id}
                  className={cn(
                    'rounded-full overflow-hidden ring-[1.5px] ring-background',
                    compact ? 'size-[22px]' : 'size-6',
                  )}
                >
                  <img
                    src={agent.avatar}
                    alt={getAgentName(agent)}
                    className="size-full object-cover"
                  />
                </div>
              ))}
              {nonTeacherSelected.length > 4 && (
                <div
                  className={cn(
                    'rounded-full bg-muted ring-[1.5px] ring-background flex items-center justify-center',
                    compact ? 'size-[22px]' : 'size-6',
                  )}
                >
                  <span className="text-[9px] font-bold text-muted-foreground">
                    +{nonTeacherSelected.length - 4}
                  </span>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );

  return (
    <div ref={containerRef} className={cn('relative w-full', compact ? 'lg:w-[272px]' : 'lg:w-80')}>
      {/* ── Header row — always in document flow ── */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn(
              'group flex items-center gap-2 cursor-pointer transition-all w-full',
              'border border-border/50 text-muted-foreground/70 hover:text-foreground hover:bg-muted/60',
              compact ? 'rounded-[18px] px-2.5 py-1' : 'rounded-full px-2.5 py-2',
            )}
            onClick={() => setOpen(!open)}
          >
            {/* Left side — text changes based on open/close */}
            <span
              className={cn(
                'flex-1 text-left font-medium text-muted-foreground/60 transition-colors group-hover:text-muted-foreground',
                compact ? 'text-[11px]' : 'text-xs',
              )}
            >
              {open ? t('agentBar.expandedTitle') : t('agentBar.readyToLearn')}
            </span>

            {/* Right side — avatars always visible */}
            {avatarRow}

            {/* Chevron */}
            {open ? (
              <ChevronUp
                className={cn(
                  compact ? 'size-2.5' : 'size-3',
                  'text-muted-foreground/40 group-hover:text-muted-foreground/70 transition-colors',
                )}
              />
            ) : (
              <ChevronDown
                className={cn(
                  compact ? 'size-2.5' : 'size-3',
                  'text-muted-foreground/40 group-hover:text-muted-foreground/70 transition-colors',
                )}
              />
            )}
          </button>
        </TooltipTrigger>
        {!open && (
          <TooltipContent side="bottom" sideOffset={4}>
            {t('agentBar.configTooltip')}
          </TooltipContent>
        )}
      </Tooltip>

      {/* ── Expanded panel (mobile inline, desktop floating) ── */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            className={cn(
              'mt-2 w-full',
              compact ? 'lg:absolute lg:right-0 lg:top-full lg:z-50 lg:mt-1 lg:w-[296px]' : 'lg:absolute lg:right-0 lg:top-full lg:z-50 lg:mt-1 lg:w-80',
            )}
          >
            <div className="rounded-2xl bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06] shadow-[0_1px_8px_-2px_rgba(0,0,0,0.06)] dark:shadow-[0_1px_8px_-2px_rgba(0,0,0,0.3)] px-2.5 py-2">
              {/* Mode tabs — full width, 50/50 */}
              <div className="flex rounded-lg border bg-muted/30 p-0.5 mb-2.5">
                <button
                  type="button"
                  onClick={() => handleModeChange('preset')}
                  aria-pressed={agentMode === 'preset'}
                  className={cn(
                    'flex-1 py-1.5 text-xs font-medium rounded-md transition-all text-center',
                    agentMode === 'preset'
                      ? 'bg-background shadow-sm text-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {t('settings.agentModePreset')}
                </button>
                <button
                  type="button"
                  onClick={() => handleModeChange('auto')}
                  aria-pressed={agentMode === 'auto'}
                  className={cn(
                    'flex-1 py-1.5 text-xs font-medium rounded-md transition-all text-center flex items-center justify-center gap-1',
                    agentMode === 'auto'
                      ? 'bg-background shadow-sm text-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Sparkles className="h-3 w-3" />
                  {t('settings.agentModeAuto')}
                </button>
              </div>

              {agentMode === 'preset' ? (
                /* Agent list — teacher is always selected, no need to show */
                <div className="max-h-72 overflow-y-auto -mx-1">
                  {agents
                    .filter((a) => a.role !== 'teacher')
                    .map((agent) => {
                      const isSelected = selectedAgentIds.includes(agent.id);
                      return (
                        <button
                          type="button"
                          key={agent.id}
                          onClick={() => toggleAgent(agent.id)}
                          aria-pressed={isSelected}
                          className={cn(
                            'w-full flex items-center gap-3 px-3 py-2 text-left transition-colors cursor-pointer rounded-lg',
                            isSelected ? 'bg-primary/5' : 'hover:bg-muted/50',
                          )}
                        >
                          <span
                            aria-hidden="true"
                            className={cn(
                              'flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-primary transition-colors',
                              isSelected && 'bg-primary',
                            )}
                          >
                            {isSelected && (
                              <span className="block h-2 w-2 rounded-[2px] bg-primary-foreground" />
                            )}
                          </span>
                          <div
                            className="size-8 rounded-full overflow-hidden shrink-0 ring-1 ring-border/40"
                            style={{
                              boxShadow: isSelected ? `0 0 0 2px ${agent.color}30` : undefined,
                            }}
                          >
                            <img
                              src={agent.avatar}
                              alt={getAgentName(agent)}
                              className="size-full object-cover"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium flex items-center gap-1.5">
                              {getAgentName(agent)}
                              <span className="text-[10px] text-muted-foreground/50 font-normal">
                                {getAgentRole(agent)}
                              </span>
                            </div>
                            {(() => {
                              const descKey = `settings.agentDescriptions.${agent.id}`;
                              const desc = t(descKey);
                              return desc !== descKey ? (
                                <p className="text-xs text-muted-foreground/60 mt-0.5 leading-relaxed">
                                  {desc}
                                </p>
                              ) : null;
                            })()}
                          </div>
                        </button>
                      );
                    })}
                </div>
              ) : (
                /* Auto-generate mode */
                <div className="flex flex-col items-center pt-6 pb-2 gap-8">
                  {/* Shuffle icon with ambient animation */}
                  <div className="relative flex items-center justify-center">
                    {/* Ping ripple */}
                    <div className="absolute size-12 rounded-full bg-sky-400/10 dark:bg-sky-400/15 animate-ping [animation-duration:3s]" />
                    {/* Soft glow ring */}
                    <div className="absolute size-14 rounded-full bg-sky-400/5 dark:bg-sky-400/10 animate-pulse [animation-duration:2.5s]" />
                    {/* Icon */}
                    <Shuffle className="relative size-7 text-sky-400 dark:text-sky-500" />
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    {t('settings.agentModeAutoDesc')}
                  </p>
                </div>
              )}

              {/* Max turns — always visible */}
              <div className="pt-2.5 mt-2.5 border-t flex items-center gap-3">
                <label htmlFor="agent-max-turns" className="text-xs text-muted-foreground shrink-0">
                  {t('settings.maxTurns')}
                </label>
                <Input
                  id="agent-max-turns"
                  type="number"
                  min="1"
                  max="20"
                  value={maxTurns}
                  onChange={(e) => setMaxTurns(e.target.value)}
                  className="w-16 h-7 text-xs"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

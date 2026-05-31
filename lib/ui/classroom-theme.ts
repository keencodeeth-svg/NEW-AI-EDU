import { cn } from '@/lib/utils';

export type ClassroomTone = 'sky' | 'emerald' | 'amber' | 'slate';

const tonePillStyles: Record<ClassroomTone, string> = {
  sky: 'border-sky-200/80 bg-sky-50/95 text-sky-700 dark:border-sky-800/60 dark:bg-sky-950/34 dark:text-sky-200',
  emerald:
    'border-emerald-200/80 bg-emerald-50/95 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/30 dark:text-emerald-200',
  amber:
    'border-amber-200/80 bg-amber-50/95 text-amber-700 dark:border-amber-800/60 dark:bg-amber-950/28 dark:text-amber-200',
  slate:
    'border-sky-100/90 bg-white/94 text-slate-700 dark:border-slate-800/80 dark:bg-slate-900/76 dark:text-slate-200',
};

const toneCardStyles: Record<ClassroomTone, string> = {
  sky: 'border-sky-200/80 bg-sky-50/92 dark:border-sky-900/50 dark:bg-sky-950/24',
  emerald:
    'border-emerald-200/80 bg-emerald-50/92 dark:border-emerald-900/50 dark:bg-emerald-950/22',
  amber: 'border-amber-200/80 bg-amber-50/92 dark:border-amber-900/50 dark:bg-amber-950/22',
  slate: 'border-sky-100/80 bg-white/90 dark:border-slate-800/80 dark:bg-slate-950/36',
};

const toneIconBadgeStyles: Record<ClassroomTone, string> = {
  sky: 'bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-200',
  emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-200',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-200',
  slate: 'bg-sky-50 text-slate-600 dark:bg-slate-800 dark:text-slate-200',
};

const outlineButtonStyles: Record<ClassroomTone, string> = {
  sky: 'border-sky-100 text-slate-700 hover:border-sky-300 hover:bg-white hover:text-sky-700 dark:border-slate-700 dark:bg-slate-900/78 dark:text-slate-200 dark:hover:border-sky-700 dark:hover:text-sky-300',
  emerald:
    'border-sky-100 text-slate-700 hover:border-emerald-300 hover:bg-white hover:text-emerald-700 dark:border-slate-700 dark:bg-slate-900/78 dark:text-slate-200 dark:hover:border-emerald-700 dark:hover:text-emerald-300',
  amber:
    'border-sky-100 text-slate-700 hover:border-amber-300 hover:bg-white hover:text-amber-700 dark:border-slate-700 dark:bg-slate-900/78 dark:text-slate-200 dark:hover:border-amber-700 dark:hover:text-amber-300',
  slate:
    'border-sky-100/90 text-slate-700 hover:border-slate-300 hover:bg-white dark:border-slate-700/80 dark:bg-slate-900/78 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-900/92',
};

const softButtonStyles: Record<ClassroomTone, string> = {
  sky: 'border-sky-200/80 bg-sky-50/95 text-sky-700 hover:border-sky-300 hover:bg-white dark:border-sky-800/60 dark:bg-sky-950/32 dark:text-sky-200 dark:hover:bg-sky-950/48',
  emerald:
    'border-emerald-200/80 bg-emerald-50/95 text-emerald-700 hover:border-emerald-300 hover:bg-white dark:border-emerald-800/60 dark:bg-emerald-950/30 dark:text-emerald-200 dark:hover:bg-emerald-950/44',
  amber:
    'border-amber-200/80 bg-amber-50/95 text-amber-700 hover:border-amber-300 hover:bg-white dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-200 dark:hover:bg-amber-950/44',
  slate:
    'border-sky-100/90 bg-white/94 text-slate-700 hover:border-slate-300 hover:bg-white dark:border-slate-800/80 dark:bg-slate-900/76 dark:text-slate-200 dark:hover:bg-slate-900/92',
};

export const classroomHeroPanel =
  'classroom-hero-panel rounded-[32px] border shadow-[0_24px_68px_rgba(73,122,189,0.08)] backdrop-blur-xl';

export const classroomPanel =
  'classroom-panel rounded-[28px] border shadow-[0_18px_46px_rgba(73,122,189,0.065)] backdrop-blur-xl';

export const classroomSectionPanel =
  'classroom-section-panel rounded-[26px] border shadow-[0_16px_40px_rgba(73,122,189,0.06)] backdrop-blur-xl';

export const classroomInsetPanel =
  'classroom-inset-panel rounded-[22px] border shadow-[0_10px_24px_rgba(73,122,189,0.04)]';

export const classroomSoftSurface = 'classroom-soft-surface rounded-[22px] border';

export const classroomToolbarStrip =
  'classroom-toolbar-strip flex max-w-full flex-wrap items-center gap-1.5 rounded-[22px] border px-1.5 py-1.5 shadow-[0_10px_22px_rgba(73,122,189,0.06)] backdrop-blur-xl';

export const classroomControlDivider = 'h-4 w-px bg-slate-200/80 dark:bg-slate-700/70';

export const classroomControlToggle =
  'classroom-control-toggle inline-flex min-h-11 items-center justify-center gap-1 rounded-full border border-transparent px-3.5 py-2 text-xs font-semibold text-slate-600 transition-all hover:border-sky-100 hover:bg-white hover:text-slate-900 hover:shadow-sm dark:text-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-800/90 dark:hover:text-slate-100';

export const classroomControlButton =
  'classroom-control-button group inline-flex h-11 w-11 items-center justify-center rounded-full border border-transparent text-slate-500 transition-all hover:border-sky-100 hover:bg-white hover:text-slate-900 hover:shadow-sm dark:text-slate-400 dark:hover:border-slate-700 dark:hover:bg-slate-800/90 dark:hover:text-slate-100';

export const classroomIconButton =
  'classroom-icon-button flex h-11 w-11 items-center justify-center rounded-[18px] border text-slate-500 shadow-[0_8px_18px_rgba(15,23,42,0.05)] transition hover:-translate-y-[1px] hover:border-sky-200/90 hover:bg-white hover:text-slate-700 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-900 dark:hover:text-slate-100';

export const classroomDropdownMenu =
  'classroom-dropdown-menu absolute top-full right-0 z-50 mt-2 min-w-[140px] overflow-hidden rounded-[20px] border p-1.5 shadow-[0_20px_42px_rgba(15,23,42,0.12)] backdrop-blur-xl';

export function classroomDropdownItem(active?: boolean) {
  return cn(
    'flex w-full items-center gap-2 rounded-[16px] px-3 py-2.5 text-left text-sm text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/80 dark:hover:text-slate-50',
    active && 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-200',
  );
}

export const classroomPrimaryButton =
  'classroom-primary-button rounded-2xl border px-4 py-2.5 text-xs font-semibold shadow-[0_10px_26px_rgba(14,165,233,0.10)] transition hover:border-sky-300 hover:bg-white dark:text-sky-100 dark:hover:bg-sky-950/48';

export function classroomOutlineButton(tone: ClassroomTone = 'slate') {
  return cn(
    'rounded-2xl border bg-white/90 px-4 py-2.5 text-xs font-semibold transition',
    outlineButtonStyles[tone],
  );
}

export function classroomSoftButton(tone: ClassroomTone = 'sky') {
  return cn(
    'rounded-full border px-3 py-1.5 text-xs font-semibold transition',
    softButtonStyles[tone],
  );
}

export function classroomTonePill(tone: ClassroomTone = 'slate', className?: string) {
  return cn('rounded-full border px-3 py-1 text-xs font-semibold', tonePillStyles[tone], className);
}

export function classroomToneCard(tone: ClassroomTone = 'slate', className?: string) {
  return cn('rounded-[22px] border px-3.5 py-3 shadow-sm', toneCardStyles[tone], className);
}

export function classroomToneIconBadge(tone: ClassroomTone = 'sky', className?: string) {
  return cn(
    'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold',
    toneIconBadgeStyles[tone],
    className,
  );
}

export const classroomRoundtableUserBubble =
  'rounded-br-md border-sky-200/70 bg-[linear-gradient(135deg,rgba(240,249,255,0.98),rgba(186,230,253,0.92))] text-sky-950 shadow-[0_18px_34px_-18px_rgba(14,165,233,0.18)] dark:border-sky-800/50 dark:bg-[linear-gradient(135deg,rgba(14,165,233,0.25),rgba(13,148,136,0.26))] dark:text-sky-50';

export const classroomRoundtableAgentBubble =
  'rounded-br-md border-sky-200/80 bg-sky-50/92 text-slate-700 shadow-sm dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-slate-100';

export const classroomRoundtableTeacherBubble =
  'rounded-bl-md border-slate-200/80 bg-white/95 text-slate-700 shadow-sm dark:border-slate-700/80 dark:bg-slate-900/95 dark:text-slate-100';

export const classroomRoundtablePrimaryCircle =
  'relative z-10 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-sky-200/70 bg-[linear-gradient(135deg,rgba(240,249,255,0.98),rgba(186,230,253,0.92))] text-sky-700 shadow-[0_14px_30px_-14px_rgba(14,165,233,0.18)] transition-all hover:border-sky-300 hover:shadow-[0_18px_34px_-14px_rgba(14,165,233,0.24)] dark:border-sky-800/40 dark:bg-[linear-gradient(135deg,rgba(14,165,233,0.25),rgba(13,148,136,0.22))] dark:text-sky-50';

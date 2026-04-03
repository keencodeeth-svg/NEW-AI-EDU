import { cn } from '@/lib/utils';
import {
  PRODUCT_BRAND_NAME,
  PRODUCT_BRAND_SUBTITLE,
  PRODUCT_BRAND_TAGLINE,
} from '@/lib/classroom-integration';

type ClassroomBrandProps = {
  readonly className?: string;
  readonly size?: 'sm' | 'md' | 'lg';
  readonly align?: 'left' | 'center';
  readonly showSubtitle?: boolean;
  readonly showTagline?: boolean;
  readonly subtitle?: string;
};

const sizeMap = {
  sm: {
    mark: 'h-10 w-10 rounded-2xl',
    title: 'text-[15px] font-semibold tracking-[0.02em]',
    subtitle: 'text-[9px] tracking-[0.18em]',
    tagline: 'text-xs leading-5',
    gap: 'gap-3',
  },
  md: {
    mark: 'h-12 w-12 rounded-[18px]',
    title: 'text-[18px] font-semibold tracking-[0.02em]',
    subtitle: 'text-[10px] tracking-[0.2em]',
    tagline: 'text-sm leading-6',
    gap: 'gap-3.5',
  },
  lg: {
    mark: 'h-14 w-14 rounded-[20px]',
    title: 'text-[22px] font-semibold tracking-[0.01em]',
    subtitle: 'text-[10px] tracking-[0.22em]',
    tagline: 'text-[15px] leading-7',
    gap: 'gap-4',
  },
} as const;

export function ClassroomBrand({
  className,
  size = 'md',
  align = 'left',
  showSubtitle = true,
  showTagline = false,
  subtitle = PRODUCT_BRAND_SUBTITLE,
}: ClassroomBrandProps) {
  const config = sizeMap[size];

  return (
    <div
      className={cn(
        'classroom-brand',
        'flex items-center',
        config.gap,
        align === 'center' ? 'justify-center text-center' : 'justify-start text-left',
        className,
      )}
    >
      <span
        className={cn(
          'classroom-brand-mark',
          'relative inline-flex shrink-0 items-center justify-center overflow-hidden border border-white/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(246,251,255,0.92))] shadow-[0_18px_36px_rgba(73,122,189,0.10)]',
          config.mark,
        )}
      >
        <img src="/logos/hangke-mark.svg" alt="" className="h-full w-full object-cover" />
      </span>
      <span className="classroom-brand-copy flex min-w-0 flex-col">
        {showSubtitle ? (
          <span
            className={cn(
              'classroom-brand-subtitle',
              'font-medium uppercase text-sky-700/80 dark:text-sky-300/80',
              config.subtitle,
            )}
          >
            {subtitle}
          </span>
        ) : null}
        <span
          className={cn('classroom-brand-title text-slate-950 dark:text-slate-50', config.title)}
        >
          {PRODUCT_BRAND_NAME}
        </span>
        {showTagline ? (
          <span
            className={cn(
              'classroom-brand-tagline max-w-2xl text-slate-600 dark:text-slate-300/85',
              config.tagline,
            )}
          >
            {PRODUCT_BRAND_TAGLINE}
          </span>
        ) : null}
      </span>
    </div>
  );
}

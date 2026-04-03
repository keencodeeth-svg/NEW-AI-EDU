import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type WorkspaceHeroTone = "sky" | "emerald" | "amber" | "slate";

export type WorkspaceHeroStat = {
  label: string;
  value: string;
  description: string;
  tone?: WorkspaceHeroTone;
};

export type WorkspaceHeroNote = {
  title: string;
  description: string;
  tone?: WorkspaceHeroTone;
};

type WorkspaceHeroProps = {
  eyebrow: string;
  title: string;
  description: string;
  badges?: string[];
  actions?: ReactNode;
  stats: WorkspaceHeroStat[];
  sideLabel: string;
  sideTitle: string;
  sideDescription: string;
  notes: WorkspaceHeroNote[];
  className?: string;
};

const TONE_CARD_CLASS: Record<WorkspaceHeroTone, string> = {
  sky: "border-sky-200/80 bg-sky-50/86",
  emerald: "border-emerald-200/80 bg-emerald-50/86",
  amber: "border-amber-200/80 bg-amber-50/86",
  slate: "border-slate-200/85 bg-white/86",
};

const TONE_BADGE_CLASS: Record<WorkspaceHeroTone, string> = {
  sky: "bg-sky-100 text-sky-700",
  emerald: "bg-emerald-100 text-emerald-700",
  amber: "bg-amber-100 text-amber-700",
  slate: "bg-slate-100 text-slate-700",
};

export default function WorkspaceHero({
  eyebrow,
  title,
  description,
  badges = [],
  actions,
  stats,
  sideLabel,
  sideTitle,
  sideDescription,
  notes,
  className,
}: WorkspaceHeroProps) {
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-[32px] border border-[rgba(116,150,191,0.12)] bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(247,251,255,0.94))] p-5 shadow-[0_20px_56px_rgba(73,122,189,0.07)] md:p-7",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[8%] top-0 h-28 w-28 rounded-full bg-sky-200/18 blur-3xl" />
        <div className="absolute bottom-[-12%] right-[12%] h-36 w-36 rounded-full bg-emerald-200/18 blur-3xl" />
        <div className="absolute inset-x-10 top-0 h-px bg-white/80" />
      </div>

      <div className="relative grid gap-4 xl:grid-cols-[minmax(0,1.16fr)_minmax(320px,0.84fr)]">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700/80">
            {eyebrow}
          </div>
          <h1 className="mt-3 max-w-[19ch] text-balance text-[clamp(2rem,3.8vw,3.05rem)] font-semibold leading-[1.04] tracking-[-0.03em] text-slate-900">
            {title}
          </h1>
          <p className="mt-3 max-w-[68ch] text-sm leading-7 text-slate-600 md:text-[15px]">
            {description}
          </p>

          {badges.length ? (
            <div className="mt-5 flex flex-wrap gap-2">
              {badges.map((badge) => (
                <span key={badge} className="chip">
                  {badge}
                </span>
              ))}
            </div>
          ) : null}

          {actions ? <div className="cta-row no-margin mt-6 flex-wrap">{actions}</div> : null}
        </div>

        <div className="rounded-[26px] border border-white/84 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(249,252,255,0.84))] p-4 shadow-[0_14px_36px_rgba(73,122,189,0.05)] backdrop-blur-xl">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            {sideLabel}
          </div>
          <div className="mt-2 text-xl font-semibold tracking-[-0.02em] text-slate-900">
            {sideTitle}
          </div>
          <div className="mt-2 text-sm leading-6 text-slate-600">{sideDescription}</div>

          <div className="mt-4 grid gap-3">
            {notes.map((note, index) => {
              const tone = note.tone ?? "sky";
              return (
                <div
                  key={`${note.title}-${index}`}
                  className={cn(
                    "rounded-[22px] border px-4 py-3.5 shadow-sm",
                    TONE_CARD_CLASS[tone],
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={cn(
                        "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                        TONE_BADGE_CLASS[tone],
                      )}
                    >
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-900">{note.title}</div>
                      <div className="mt-1 text-xs leading-5 text-slate-600">
                        {note.description}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="relative mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {stats.map((stat) => {
          const tone = stat.tone ?? "slate";
          return (
            <div
              key={`${stat.label}-${stat.value}`}
              className={cn(
                "rounded-[24px] border px-4 py-4 shadow-sm backdrop-blur-sm",
                TONE_CARD_CLASS[tone],
              )}
            >
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                {stat.label}
              </div>
              <div className="mt-2 text-[clamp(1.35rem,2vw,1.8rem)] font-semibold tracking-[-0.03em] text-slate-900">
                {stat.value}
              </div>
              <div className="mt-2 text-sm leading-6 text-slate-600">{stat.description}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

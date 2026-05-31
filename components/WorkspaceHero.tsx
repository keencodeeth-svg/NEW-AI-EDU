import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type WorkspaceHeroTone = 'sky' | 'emerald' | 'amber' | 'slate';

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
  sky: 'workspace-hero-tone-sky',
  emerald: 'workspace-hero-tone-emerald',
  amber: 'workspace-hero-tone-amber',
  slate: 'workspace-hero-tone-slate',
};

const TONE_BADGE_CLASS: Record<WorkspaceHeroTone, string> = {
  sky: 'workspace-hero-badge-sky',
  emerald: 'workspace-hero-badge-emerald',
  amber: 'workspace-hero-badge-amber',
  slate: 'workspace-hero-badge-slate',
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
    <section className={cn('workspace-hero', className)}>
      <div className="workspace-hero-grid">
        <div className="workspace-hero-copy">
          <div className="workspace-hero-eyebrow">{eyebrow}</div>
          <h1 className="workspace-hero-title">{title}</h1>
          <p className="workspace-hero-description">{description}</p>

          {badges.length ? (
            <div className="workspace-hero-badges">
              {badges.map((badge) => (
                <span key={badge} className="chip">
                  {badge}
                </span>
              ))}
            </div>
          ) : null}

          {actions ? (
            <div className="cta-row no-margin workspace-hero-actions">{actions}</div>
          ) : null}
        </div>

        <div className="workspace-hero-side">
          <div className="workspace-hero-side-label">{sideLabel}</div>
          <div className="workspace-hero-side-title">{sideTitle}</div>
          <div className="workspace-hero-side-description">{sideDescription}</div>

          <div className="workspace-hero-notes">
            {notes.map((note, index) => {
              const tone = note.tone ?? 'sky';
              return (
                <div
                  key={`${note.title}-${index}`}
                  className={cn('workspace-hero-note', TONE_CARD_CLASS[tone])}
                >
                  <div className="workspace-hero-note-row">
                    <span className={cn('workspace-hero-note-index', TONE_BADGE_CLASS[tone])}>
                      {index + 1}
                    </span>
                    <div className="workspace-hero-note-copy">
                      <div className="workspace-hero-note-title">{note.title}</div>
                      <div className="workspace-hero-note-description">{note.description}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="workspace-hero-stat-grid">
        {stats.map((stat) => {
          const tone = stat.tone ?? 'slate';
          return (
            <div
              key={`${stat.label}-${stat.value}`}
              className={cn('workspace-hero-stat', TONE_CARD_CLASS[tone])}
            >
              <div className="workspace-hero-stat-label">{stat.label}</div>
              <div className="workspace-hero-stat-value">{stat.value}</div>
              <div className="workspace-hero-stat-description">{stat.description}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

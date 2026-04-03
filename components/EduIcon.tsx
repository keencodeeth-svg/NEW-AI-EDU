import type { ReactNode } from "react";

type IconName =
  | "book"
  | "pencil"
  | "rocket"
  | "chart"
  | "brain"
  | "trophy"
  | "board"
  | "puzzle";

const icons: Record<IconName, ReactNode> = {
  book: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 5.5C4 4.1 5.1 3 6.5 3H20v15.5H6.5C5.1 18.5 4 19.6 4 21V5.5Z" />
      <path d="M20 5H7.5C6.1 5 5 6.1 5 7.5V21" />
    </svg>
  ),
  pencil: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 20l4.5-1 10-10-3.5-3.5-10 10L4 20Z" />
      <path d="M13.5 5.5l3.5 3.5" />
    </svg>
  ),
  rocket: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3c3 1 5 4 5 7-2 0-5 2-6 4-1-2-4-4-6-4 0-3 2-6 7-7Z" />
      <path d="M9 14l-2 4 4-2" />
      <circle cx="14" cy="9" r="2" />
    </svg>
  ),
  chart: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 20V6" />
      <path d="M4 20h16" />
      <path d="M8 16v-5" />
      <path d="M12 16v-8" />
      <path d="M16 16v-3" />
    </svg>
  ),
  brain: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 5a3 3 0 0 1 5-1 3 3 0 0 1 5 2v8a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3Z" />
      <path d="M9 6v8" />
      <path d="M15 6v8" />
    </svg>
  ),
  trophy: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 4h12v3a5 5 0 0 1-4 5v3H10v-3a5 5 0 0 1-4-5V4Z" />
      <path d="M8 21h8" />
      <path d="M4 6h2v2a3 3 0 0 1-2-2Z" />
      <path d="M20 6h-2v2a3 3 0 0 0 2-2Z" />
    </svg>
  ),
  board: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="5" width="16" height="11" rx="2" />
      <path d="M8 19h8" />
      <path d="M12 16v3" />
    </svg>
  ),
  puzzle: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 3h6v3a2 2 0 1 1 2 2h3v6h-3a2 2 0 1 1-2 2v3H9v-3a2 2 0 1 1-2-2H4V8h3a2 2 0 1 1 2-2V3Z" />
    </svg>
  )
};

export default function EduIcon({ name }: { name: IconName }) {
  return <span className="edu-icon">{icons[name]}</span>;
}

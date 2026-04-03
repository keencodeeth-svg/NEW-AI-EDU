"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";

export type MathLineMode = "compact" | "comfortable";

type MathViewStyle = CSSProperties & Record<`--${string}`, string>;

const MIN_FONT_SCALE = 0.9;
const MAX_FONT_SCALE = 1.2;
const FONT_STEP = 0.05;

type MathViewSettingsState = {
  fontScale: number;
  lineMode: MathLineMode;
};

function clampScale(value: number) {
  if (Number.isNaN(value)) return 1;
  return Math.max(MIN_FONT_SCALE, Math.min(MAX_FONT_SCALE, value));
}

function readStoredSettings(storageKey: string): MathViewSettingsState {
  if (typeof window === "undefined") {
    return { fontScale: 1, lineMode: "comfortable" };
  }

  const raw = window.localStorage.getItem(`math-view:${storageKey}`);
  if (!raw) {
    return { fontScale: 1, lineMode: "comfortable" };
  }

  try {
    const parsed = JSON.parse(raw) as { fontScale?: number; lineMode?: MathLineMode };
    return {
      fontScale: typeof parsed.fontScale === "number" ? clampScale(parsed.fontScale) : 1,
      lineMode: parsed.lineMode === "compact" || parsed.lineMode === "comfortable" ? parsed.lineMode : "comfortable"
    };
  } catch {
    return { fontScale: 1, lineMode: "comfortable" };
  }
}

export function useMathViewSettings(storageKey: string) {
  const [settings, setSettings] = useState<MathViewSettingsState>(() => readStoredSettings(storageKey));
  const { fontScale, lineMode } = settings;

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      `math-view:${storageKey}`,
      JSON.stringify({ fontScale, lineMode })
    );
  }, [fontScale, lineMode, storageKey]);

  const style = useMemo(
    () =>
      ({
        "--math-scale": String(fontScale),
        "--math-line-height": lineMode === "compact" ? "1.6" : "1.9"
      }) as MathViewStyle,
    [fontScale, lineMode]
  );

  return {
    fontScale,
    lineMode,
    style,
    setLineMode: (nextLineMode: MathLineMode) =>
      setSettings((prev) => ({
        ...prev,
        lineMode: nextLineMode
      })),
    decreaseFontScale: () =>
      setSettings((prev) => ({
        ...prev,
        fontScale: clampScale(prev.fontScale - FONT_STEP)
      })),
    increaseFontScale: () =>
      setSettings((prev) => ({
        ...prev,
        fontScale: clampScale(prev.fontScale + FONT_STEP)
      })),
    resetView: () => {
      setSettings({ fontScale: 1, lineMode: "comfortable" });
    }
  };
}

"use client";

import { useCallback, useState } from "react";

export function usePracticeGuide(storageKey: string) {
  const [showPracticeGuide, setShowPracticeGuide] = useState(() => {
    try {
      const hidden = window.localStorage.getItem(storageKey) === "hidden";
      return !hidden;
    } catch {
      return true;
    }
  });

  const hidePracticeGuide = useCallback(() => {
    setShowPracticeGuide(false);
    try {
      window.localStorage.setItem(storageKey, "hidden");
    } catch {
      // ignore localStorage errors
    }
  }, [storageKey]);

  const showPracticeGuideAgain = useCallback(() => {
    setShowPracticeGuide(true);
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      // ignore localStorage errors
    }
  }, [storageKey]);

  return {
    showPracticeGuide,
    hidePracticeGuide,
    showPracticeGuideAgain
  };
}

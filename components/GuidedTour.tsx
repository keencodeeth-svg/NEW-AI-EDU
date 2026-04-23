"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

export type TourStep = {
  targetSelector: string;
  title: string;
  content: string;
  placement?: "top" | "bottom" | "left" | "right";
};

type GuidedTourProps = {
  open: boolean;
  steps: TourStep[];
  onComplete: () => void;
  onSkip: () => void;
};

type Box = {
  top: number;
  left: number;
  width: number;
  height: number;
};

function resolveBox(step: TourStep | undefined): Box | null {
  if (!step || typeof document === "undefined") {
    return null;
  }
  const target = document.querySelector(step.targetSelector);
  if (!(target instanceof HTMLElement)) {
    return null;
  }
  const rect = target.getBoundingClientRect();
  return {
    top: Math.max(12, rect.top - 8),
    left: Math.max(12, rect.left - 8),
    width: Math.max(240, rect.width + 16),
    height: Math.max(56, rect.height + 16)
  };
}

function resolveTooltipStyle(box: Box | null, placement: TourStep["placement"]) {
  if (!box) {
    return {
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)"
    } as const;
  }

  if (placement === "top") {
    return {
      top: Math.max(16, box.top - 170),
      left: Math.min(window.innerWidth - 360, box.left),
      transform: "none"
    } as const;
  }
  if (placement === "left") {
    return {
      top: box.top,
      left: Math.max(16, box.left - 360),
      transform: "none"
    } as const;
  }
  if (placement === "right") {
    return {
      top: box.top,
      left: Math.min(window.innerWidth - 360, box.left + box.width + 16),
      transform: "none"
    } as const;
  }
  return {
    top: Math.min(window.innerHeight - 220, box.top + box.height + 16),
    left: Math.min(window.innerWidth - 360, box.left),
    transform: "none"
  } as const;
}

export default function GuidedTour({ open, steps, onComplete, onSkip }: GuidedTourProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [targetBox, setTargetBox] = useState<Box | null>(null);
  const titleId = useId();
  const descriptionId = useId();
  const primaryActionRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    queueMicrotask(() => {
      setCurrentIndex(0);
    });
  }, [open]);

  const currentStep = steps[currentIndex];

  useEffect(() => {
    if (!open) {
      return;
    }
    const sync = () => {
      setTargetBox(resolveBox(currentStep));
    };
    sync();
    window.addEventListener("resize", sync);
    window.addEventListener("scroll", sync, true);
    return () => {
      window.removeEventListener("resize", sync);
      window.removeEventListener("scroll", sync, true);
    };
  }, [currentStep, open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      primaryActionRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [currentIndex, open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onSkip();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onSkip, open]);

  const tooltipStyle = useMemo(
    () => resolveTooltipStyle(targetBox, currentStep?.placement ?? "bottom"),
    [currentStep?.placement, targetBox]
  );

  if (!open || !currentStep) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(15, 23, 42, 0.42)",
          pointerEvents: "none",
          zIndex: 90
        }}
      />
      {targetBox ? (
        <motion.div
          key={`${currentStep.targetSelector}-${currentIndex}`}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          aria-hidden="true"
          style={{
            position: "fixed",
            top: targetBox.top,
            left: targetBox.left,
            width: targetBox.width,
            height: targetBox.height,
            borderRadius: 20,
            boxShadow: "0 0 0 9999px rgba(15, 23, 42, 0.42)",
            border: "2px solid rgba(56, 189, 248, 0.9)",
            pointerEvents: "none",
            zIndex: 91
          }}
        />
      ) : null}
      <motion.div
        key={`tooltip-${currentIndex}`}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 12 }}
        transition={{ duration: 0.2 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        style={{
          position: "fixed",
          zIndex: 92,
          width: 340,
          maxWidth: "calc(100vw - 32px)",
          borderRadius: 24,
          padding: 20,
          background: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)",
          border: "1px solid rgba(148, 163, 184, 0.24)",
          boxShadow: "0 24px 80px rgba(15, 23, 42, 0.18)",
          ...tooltipStyle
        }}
      >
        <div style={{ display: "grid", gap: 10 }}>
          <div className="pill-list">
            <span className="pill">
              引导 {currentIndex + 1}/{steps.length}
            </span>
          </div>
          <div className="section-title" id={titleId} style={{ fontSize: 20 }}>
            {currentStep.title}
          </div>
          <p id={descriptionId} style={{ margin: 0, color: "var(--ink-1)", lineHeight: 1.6 }}>
            {currentStep.content}
          </p>
          <div className="cta-row" style={{ marginTop: 4 }}>
            <button className="button ghost" type="button" onClick={onSkip}>
              跳过
            </button>
            <button
              className="button secondary"
              type="button"
              onClick={() => {
                setCurrentIndex((prev) => Math.max(0, prev - 1));
              }}
              disabled={currentIndex === 0}
            >
              上一步
            </button>
            <button
              className="button primary"
              type="button"
              ref={primaryActionRef}
              onClick={() => {
                if (currentIndex >= steps.length - 1) {
                  onComplete();
                  return;
                }
                setCurrentIndex((prev) => prev + 1);
              }}
            >
              {currentIndex >= steps.length - 1 ? "完成引导" : "下一步"}
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

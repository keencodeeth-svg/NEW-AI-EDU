"use client";

import { useState } from "react";
import Card from "@/components/Card";
import { requestJson } from "@/lib/client-request";

type StudentMoodCheckinProps = {
  visible: boolean;
  context?: string;
  onSaved?: () => void;
};

const OPTIONS = [
  { mood: "good", emoji: "😊", label: "状态不错" },
  { mood: "neutral", emoji: "😐", label: "还算平稳" },
  { mood: "tired", emoji: "😟", label: "有点疲惫" }
] as const;

export default function StudentMoodCheckin({ visible, context, onSaved }: StudentMoodCheckinProps) {
  const [submitting, setSubmitting] = useState(false);
  const [savedMood, setSavedMood] = useState<string | null>(null);

  if (!visible) {
    return null;
  }

  return (
    <Card title="结束前记录一下今天的学习状态" tag="情绪日记">
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ color: "var(--ink-1)" }}>只要点一下表情就可以，老师和家长看到的是趋势，不会给你增加额外任务。</div>
        <div className="cta-row">
          {OPTIONS.map((option) => (
            <button
              key={option.mood}
              type="button"
              className={savedMood === option.mood ? "button primary" : "button secondary"}
              disabled={submitting || Boolean(savedMood)}
              onClick={async () => {
                setSubmitting(true);
                try {
                  await requestJson("/api/student/mood", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ mood: option.mood, context })
                  });
                  setSavedMood(option.mood);
                  onSaved?.();
                } finally {
                  setSubmitting(false);
                }
              }}
            >
              <span style={{ fontSize: 18, marginRight: 6 }}>{option.emoji}</span>
              {option.label}
            </button>
          ))}
        </div>
        {savedMood ? <div className="status-note success">已记录，今天的状态会进入成长趋势里。</div> : null}
      </div>
    </Card>
  );
}

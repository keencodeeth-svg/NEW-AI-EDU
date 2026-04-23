"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Card from "@/components/Card";

type ChallengeQuestion = {
  id: string;
  stem: string;
  options: string[];
};

type DailyChallengeData = {
  id: string;
  challengeDate: string;
  questionIds: string[];
  timeLimitSeconds: number;
  questions?: ChallengeQuestion[];
  answers: Record<string, string> | null;
  score: number | null;
  total: number;
  bonusXp: number;
  completedAt: string | null;
};

type Phase = "idle" | "playing" | "done";

export default function StudentDailyChallengeCard() {
  const [challenge, setChallenge] = useState<DailyChallengeData | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const answersRef = useRef(answers);
  const challengeRef = useRef(challenge);
  const submittingRef = useRef(false);

  answersRef.current = answers;
  challengeRef.current = challenge;

  const loadChallenge = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/student/daily-challenge");
      if (!res.ok) {
        setError("加载失败");
        return;
      }
      const json = await res.json();
      const data = json.data as DailyChallengeData;
      setChallenge(data);
      if (data.completedAt) {
        setPhase("done");
      } else {
        setPhase("idle");
      }
    } catch {
      setError("加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadChallenge();
  }, [loadChallenge]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const doSubmit = useCallback(async () => {
    const current = challengeRef.current;
    if (!current || submittingRef.current) return;
    if (timerRef.current) clearInterval(timerRef.current);
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const res = await fetch("/api/student/daily-challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challengeId: current.id,
          answers: answersRef.current,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        setChallenge(json.data as DailyChallengeData);
        setPhase("done");
        setError(null);
      } else {
        setError("提交失败，请稍后重试");
      }
    } catch {
      setError("提交失败，请稍后重试");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, []);

  function startChallenge() {
    if (!challenge) return;
    setPhase("playing");
    setAnswers({});
    setTimeLeft(challenge.timeLimitSeconds);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          doSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  function selectAnswer(questionId: string, option: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: option }));
  }

  if (loading) {
    return (
      <Card title="每日挑战" tag="挑战">
        <div className="status-note info">加载中...</div>
      </Card>
    );
  }

  if (error || !challenge) {
    return (
      <Card title="每日挑战" tag="挑战">
        <div className="status-note info">{error ?? "暂无挑战"}</div>
      </Card>
    );
  }

  if (phase === "done") {
    return (
      <Card title="每日挑战" tag="挑战">
        <div className="stack-8 panel-section">
          <div className="kpi">
            <div className="section-title kpi-title">今日成绩</div>
            <div className="kpi-value">
              {challenge.score ?? 0} / {challenge.total}
            </div>
          </div>
          {challenge.bonusXp > 0 ? (
            <div className="meta-text">
              获得 +{challenge.bonusXp} XP
              {challenge.score === challenge.total ? " (满分奖励)" : ""}
            </div>
          ) : null}
          <div className="status-note info">明天再来挑战</div>
        </div>
      </Card>
    );
  }

  if (phase === "playing") {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    return (
      <Card title="每日挑战" tag="进行中">
        <div className="stack-8 panel-section">
          {error ? <div className="status-note warning">{error}</div> : null}
          <div className="meta-text" style={{ fontVariantNumeric: "tabular-nums" }}>
            剩余时间 {minutes}:{String(seconds).padStart(2, "0")}
          </div>
          {challenge.questions?.map((q, qi) => (
            <div key={q.id} className="stack-8" style={{ padding: "8px 0" }}>
              <div className="section-title">
                {qi + 1}. {q.stem}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {q.options.map((opt) => (
                  <label
                    key={opt}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      cursor: "pointer",
                      padding: "4px 0",
                    }}
                  >
                    <input
                      type="radio"
                      name={`dc-${q.id}`}
                      checked={answers[q.id] === opt}
                      onChange={() => selectAnswer(q.id, opt)}
                    />
                    <span>{opt}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
          <button
            className="button primary"
            type="button"
            onClick={doSubmit}
            disabled={submitting}
          >
            {submitting ? "提交中..." : "提交答案"}
          </button>
        </div>
      </Card>
    );
  }

  return (
    <Card title="每日挑战" tag="挑战">
      <div className="stack-8 panel-section">
        <div className="meta-text">
          {challenge.total} 道题，{Math.floor(challenge.timeLimitSeconds / 60)} 分钟
        </div>
        <button
          className="button primary"
          type="button"
          onClick={startChallenge}
        >
          开始挑战
        </button>
      </div>
    </Card>
  );
}

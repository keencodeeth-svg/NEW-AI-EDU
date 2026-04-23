"use client";

import { useState } from "react";
import Card from "@/components/Card";
import MathText from "@/components/MathText";
import { requestJson } from "@/lib/client-request";

type PeerChallengePayload = {
  wrongSolution?: string;
  confusionPrompt?: string;
  followUpPrompt?: string;
  feedback?: string;
  awardedXp?: number;
  totalXp?: number;
};

type PracticePeerChallengeCardProps = {
  questionId: string;
  questionStem: string;
  correctAnswer: string;
  commonMistake?: string;
};

export default function PracticePeerChallengeCard({
  questionId,
  questionStem,
  correctAnswer,
  commonMistake
}: PracticePeerChallengeCardProps) {
  const [loading, setLoading] = useState(false);
  const [challenge, setChallenge] = useState<PeerChallengePayload | null>(null);
  const [explanation, setExplanation] = useState("");
  const [response, setResponse] = useState<PeerChallengePayload | null>(null);

  return (
    <Card title="AI 同伴学习" tag="费曼练习">
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ color: "var(--ink-1)" }}>
          做完这题后，换成“教别人”的视角会更容易真正吃透。让 AI 学伴先犯一个典型错误，你来指出并解释。
        </div>
        {!challenge ? (
          <div className="cta-row">
            <button
              className="button secondary"
              type="button"
              disabled={loading}
              onClick={async () => {
                setLoading(true);
                try {
                  const payload = await requestJson<{ data?: PeerChallengePayload }>("/api/ai/peer-learner", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      sourceId: questionId,
                      question: questionStem,
                      correctAnswer,
                      commonMistake
                    })
                  });
                  setChallenge(payload.data ?? null);
                } finally {
                  setLoading(false);
                }
              }}
            >
              {loading ? "生成中..." : "考考 AI 学伴"}
            </button>
          </div>
        ) : (
          <>
            {challenge.wrongSolution ? (
              <div className="card" style={{ display: "grid", gap: 8 }}>
                <div className="badge">AI 学伴的错误解法</div>
                <MathText as="div" text={challenge.wrongSolution} />
                {challenge.confusionPrompt ? <div className="status-note info">{challenge.confusionPrompt}</div> : null}
              </div>
            ) : null}
            <label style={{ display: "grid", gap: 8 }}>
              <div className="section-title">你来讲给它听</div>
              <textarea
                rows={4}
                value={explanation}
                onChange={(event) => setExplanation(event.target.value)}
                placeholder="比如：你这里把条件看漏了，真正要先判断……"
                style={{ width: "100%", padding: 12, borderRadius: 14, border: "1px solid var(--stroke)" }}
              />
            </label>
            <div className="cta-row">
              <button
                className="button primary"
                type="button"
                disabled={!explanation.trim() || loading}
                onClick={async () => {
                  setLoading(true);
                  try {
                    const payload = await requestJson<{ data?: PeerChallengePayload }>("/api/ai/peer-learner", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        sourceId: questionId,
                        question: questionStem,
                        correctAnswer,
                        commonMistake,
                        studentExplanation: explanation
                      })
                    });
                    setResponse(payload.data ?? null);
                  } finally {
                    setLoading(false);
                  }
                }}
              >
                {loading ? "提交中..." : "提交我的讲解"}
              </button>
            </div>
            {response?.feedback ? <div className="status-note success">{response.feedback}</div> : null}
            {response?.followUpPrompt ? <div className="status-note info">{response.followUpPrompt}</div> : null}
            {typeof response?.awardedXp === "number" ? (
              <div className="pill-list">
                <span className="pill">额外 XP +{response.awardedXp}</span>
                {typeof response.totalXp === "number" ? <span className="pill">总 XP {response.totalXp}</span> : null}
              </div>
            ) : null}
          </>
        )}
      </div>
    </Card>
  );
}

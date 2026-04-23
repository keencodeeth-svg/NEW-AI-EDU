import type { MetacognitionPrompt } from "@/lib/ai-types";

type TutorMetacognitionCardProps = {
  metacognition: MetacognitionPrompt;
  submitted: boolean;
  submittedAttribution: string | null;
  loading: boolean;
  onSubmit: (attribution: string) => void;
};

export function TutorMetacognitionCard({
  metacognition,
  submitted,
  submittedAttribution,
  loading,
  onSubmit,
}: TutorMetacognitionCardProps) {
  return (
    <div className="card" style={{ marginBottom: 12, display: "grid", gap: 10 }}>
      <div className="badge">元认知反思</div>
      <div style={{ fontWeight: 600 }}>{metacognition.question}</div>
      {!submitted ? (
        <>
          <div style={{ fontSize: 12, color: "var(--ink-1)" }}>
            选一个最接近的原因，帮助系统更精准地给你建议。
          </div>
          <div className="cta-row" style={{ flexWrap: "wrap", gap: 8 }}>
            {metacognition.attributionSuggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                className="button secondary"
                disabled={loading}
                onClick={() => onSubmit(suggestion)}
                style={{ borderRadius: 20 }}
              >
                {loading ? "提交中..." : suggestion}
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="status-note success">
          已提交自我归因：「{submittedAttribution}」。系统会根据你的反思调整后续提示方式。
        </div>
      )}
    </div>
  );
}

import type { HintTier, ScaffoldedHint } from "@/lib/ai-types";
import MathText from "@/components/MathText";

type TutorHintTierSelectorProps = {
  scaffoldedHints: ScaffoldedHint[];
  activeTier: HintTier;
  maxUnlockedTier: HintTier;
  loading: boolean;
  onRequestTier: (tier: HintTier) => void;
};

const TIER_CONFIG: { tier: HintTier; label: string; description: string }[] = [
  { tier: 1, label: "类比提示", description: "用类比帮你找到切入方向" },
  { tier: 2, label: "第一步", description: "揭示解题的第一个动作" },
  { tier: 3, label: "关键公式", description: "直接给出核心知识点和公式" },
];

export function TutorHintTierSelector({
  scaffoldedHints,
  activeTier,
  maxUnlockedTier,
  loading,
  onRequestTier,
}: TutorHintTierSelectorProps) {
  return (
    <div className="card" style={{ marginBottom: 12, display: "grid", gap: 10 }}>
      <div className="badge">思维脚手架</div>
      <div style={{ fontSize: 12, color: "var(--ink-1)" }}>
        从类比开始，逐步获取更多帮助。尽量自己先想，再请求下一级提示。
      </div>
      <div className="cta-row" style={{ flexWrap: "wrap" }}>
        {TIER_CONFIG.map(({ tier, label, description }) => {
          const isUnlocked = tier <= maxUnlockedTier;
          const isActive = tier <= activeTier;
          const canRequest = tier === maxUnlockedTier + 1 || (isUnlocked && tier > activeTier);
          return (
            <button
              key={tier}
              type="button"
              className={`button ${isActive ? "primary" : "secondary"}`}
              disabled={loading || (!canRequest && !isActive)}
              onClick={() => {
                if (!isActive || canRequest) {
                  onRequestTier(tier);
                }
              }}
              title={description}
              style={{ opacity: !isUnlocked && !canRequest ? 0.5 : 1 }}
            >
              {loading && tier === activeTier + 1 ? "加载中..." : `${label}`}
              {!isUnlocked && !canRequest ? " 🔒" : ""}
            </button>
          );
        })}
      </div>
      {scaffoldedHints.length > 0 ? (
        <div className="grid" style={{ gap: 8 }}>
          {scaffoldedHints.map((hint) => (
            <div key={hint.tier} className="card" style={{ display: "grid", gap: 4 }}>
              <div className="cta-row">
                <span className="badge">{hint.tierLabel}</span>
                <span className="pill">Tier {hint.tier}</span>
              </div>
              <MathText as="div" text={hint.content} />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

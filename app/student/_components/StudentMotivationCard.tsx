import Card from "@/components/Card";
import type { MotivationPayload } from "../types";

type StudentMotivationCardProps = {
  motivation: MotivationPayload | null;
};

export default function StudentMotivationCard({ motivation }: StudentMotivationCardProps) {
  const xp = motivation?.xp;
  const xpNeeded = xp ? xp.nextLevelXp - xp.totalXp : 0;

  return (
    <Card title="学习激励" tag="成长">
      {xp ? (
        <div className="stack-8 panel-section">
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span className="kpi-value" style={{ fontSize: 18 }}>
              Lv.{xp.level} {xp.rankTitle}
            </span>
            <span className="meta-text">{xp.totalXp} XP</span>
          </div>
          <div
            style={{
              height: 8,
              background: "var(--color-surface-2, #e5e7eb)",
              borderRadius: 4,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${xp.progress}%`,
                height: "100%",
                background: "var(--color-primary, #3b82f6)",
                borderRadius: 4,
                transition: "width 0.3s ease",
              }}
            />
          </div>
          {xp.progress < 100 ? (
            <div className="meta-text">
              下次升级还需 {xpNeeded} XP
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="grid grid-2">
        <div className="kpi">
          <div className="section-title kpi-title">连续学习</div>
          <div className="kpi-value">{motivation?.streak ?? 0} 天</div>
        </div>
        <div className="kpi">
          <div className="section-title kpi-title">本周正确率</div>
          <div className="kpi-value">{motivation?.weekly?.accuracy ?? 0}%</div>
        </div>
      </div>
      <div className="stack-8 panel-section">
        <div className="badge">徽章</div>
        {motivation?.badges?.length ? (
          motivation.badges.map((badge) => (
            <div className="meta-text" key={badge.id}>
              {badge.title} - {badge.description}
            </div>
          ))
        ) : (
          <div className="status-note info">完成一次练习即可获得首枚徽章。</div>
        )}
      </div>
    </Card>
  );
}

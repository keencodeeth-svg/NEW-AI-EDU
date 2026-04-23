"use client";

import Link from "next/link";
import Card from "@/components/Card";
import type { KnowledgeGraphNode } from "../types";

const LEVEL_LABELS: Record<KnowledgeGraphNode["masteryLevel"], string> = {
  locked: "未解锁",
  not_started: "未开始",
  weak: "薄弱",
  developing: "发展中",
  strong: "已掌握",
};

function TrendBadge({ trend }: { trend: number }) {
  if (trend === 0) return <span style={{ color: "var(--ink-2, #64748b)" }}>-- 持平</span>;
  if (trend > 0) return <span style={{ color: "#16a34a" }}>+{trend} 上升</span>;
  return <span style={{ color: "#dc2626" }}>{trend} 下降</span>;
}

export default function KnowledgeMapNodeDetail({
  node,
  prerequisites,
  onClose,
}: {
  node: KnowledgeGraphNode;
  prerequisites: KnowledgeGraphNode[];
  onClose: () => void;
}) {
  return (
    <Card title={node.title} tag={LEVEL_LABELS[node.masteryLevel]}>
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ fontSize: 13, color: "var(--ink-2, #64748b)" }}>
          {node.chapter} / {node.unit}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
          }}
        >
          <div>
            <div style={{ fontSize: 11, color: "var(--ink-2, #64748b)" }}>掌握度</div>
            <div style={{ fontSize: 20, fontWeight: 600 }}>{node.masteryScore}%</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "var(--ink-2, #64748b)" }}>置信度</div>
            <div style={{ fontSize: 20, fontWeight: 600 }}>{node.confidenceScore}%</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "var(--ink-2, #64748b)" }}>7日趋势</div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>
              <TrendBadge trend={node.masteryTrend7d} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "var(--ink-2, #64748b)" }}>练习次数</div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>{node.totalAttempts}</div>
          </div>
        </div>

        {prerequisites.length > 0 ? (
          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--ink-1, #334155)",
                marginBottom: 6,
              }}
            >
              前置知识点
            </div>
            <div style={{ display: "grid", gap: 4 }}>
              {prerequisites.map((prereq) => (
                <div
                  key={prereq.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: 13,
                    padding: "4px 0",
                    borderBottom: "1px solid var(--stroke, #e2e8f0)",
                  }}
                >
                  <span style={{ color: "var(--ink-0, #1e293b)" }}>{prereq.title}</span>
                  <span
                    style={{
                      fontSize: 12,
                      color:
                        prereq.masteryLevel === "strong"
                          ? "#16a34a"
                          : prereq.masteryLevel === "developing"
                            ? "#d97706"
                            : "#dc2626",
                    }}
                  >
                    {prereq.masteryScore}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <Link
            className="button primary"
            href={node.practiceHref}
            style={{ flex: 1, textAlign: "center" }}
          >
            开始练习
          </Link>
          <button
            className="button secondary"
            type="button"
            onClick={onClose}
          >
            关闭
          </button>
        </div>
      </div>
    </Card>
  );
}

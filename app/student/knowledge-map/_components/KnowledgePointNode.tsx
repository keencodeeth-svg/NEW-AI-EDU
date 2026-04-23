"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { KnowledgeGraphNode } from "../types";

type KnowledgePointNodeData = KnowledgeGraphNode & { [key: string]: unknown };

const LEVEL_STYLES: Record<
  KnowledgeGraphNode["masteryLevel"],
  { background: string; opacity?: number }
> = {
  locked: { background: "var(--surface-1, #f1f5f9)", opacity: 0.6 },
  not_started: { background: "var(--surface-1, #f1f5f9)" },
  weak: { background: "#fee2e2" },
  developing: { background: "#fef3c7" },
  strong: { background: "#d1fae5" },
};

function truncate(text: string, maxLength: number) {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}

export default function KnowledgePointNode({ data }: NodeProps) {
  const nodeData = data as unknown as KnowledgePointNodeData;
  const style = LEVEL_STYLES[nodeData.masteryLevel] ?? LEVEL_STYLES.not_started;

  return (
    <div
      style={{
        background: style.background,
        opacity: style.opacity ?? 1,
        borderRadius: 10,
        border: "1px solid var(--stroke, #e2e8f0)",
        padding: "8px 12px",
        minWidth: 140,
        maxWidth: 180,
        position: "relative",
        cursor: "pointer",
        fontSize: 13,
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: "#94a3b8" }} />

      <div
        style={{
          position: "absolute",
          top: -8,
          right: -8,
          background: "var(--brand-0, #3b82f6)",
          color: "#fff",
          borderRadius: 10,
          padding: "1px 6px",
          fontSize: 10,
          fontWeight: 600,
          lineHeight: "16px",
        }}
      >
        {nodeData.masteryScore}%
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        {nodeData.masteryLevel === "locked" ? (
          <span style={{ fontSize: 14 }} aria-label="locked">
            🔒
          </span>
        ) : null}
        <span
          style={{
            fontWeight: 500,
            color: "var(--ink-0, #1e293b)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {truncate(nodeData.title, 20)}
        </span>
      </div>

      <Handle type="source" position={Position.Bottom} style={{ background: "#94a3b8" }} />
    </div>
  );
}

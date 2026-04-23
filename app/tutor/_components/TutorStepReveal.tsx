"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import MathText from "@/components/MathText";
import { requestJson } from "@/lib/client-request";

type TutorStepRevealProps = {
  steps: string[];
  subject?: string;
  grade?: string;
};

export default function TutorStepReveal({ steps, subject, grade }: TutorStepRevealProps) {
  const [visibleCount, setVisibleCount] = useState(1);
  const [expandedAll, setExpandedAll] = useState(false);
  const [reexplanations, setReexplanations] = useState<Record<number, string>>({});
  const [loadingIndex, setLoadingIndex] = useState<number | null>(null);

  useEffect(() => {
    setVisibleCount(1);
    setExpandedAll(false);
    setReexplanations({});
  }, [steps]);

  useEffect(() => {
    if (expandedAll || visibleCount >= steps.length) {
      return;
    }
    const timer = window.setTimeout(() => {
      setVisibleCount((prev) => Math.min(prev + 1, steps.length));
    }, 600);
    return () => window.clearTimeout(timer);
  }, [expandedAll, steps.length, visibleCount]);

  const visibleSteps = steps.slice(0, expandedAll ? steps.length : visibleCount);

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <div className="badge">完整讲解步骤</div>
        {!expandedAll && visibleCount < steps.length ? (
          <button
            type="button"
            className="button ghost"
            onClick={() => {
              setVisibleCount(steps.length);
              setExpandedAll(true);
            }}
          >
            立即展开全部
          </button>
        ) : null}
      </div>
      {visibleSteps.map((item, index) => (
        <motion.div
          key={`${index}-${item}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22 }}
          className="card"
          style={{ display: "grid", gap: 8 }}
        >
          <div className="badge">步骤 {index + 1}</div>
          <MathText as="div" text={item} />
          <div className="cta-row">
            <button
              type="button"
              className="button ghost"
              disabled={loadingIndex === index}
              onClick={async () => {
                setLoadingIndex(index);
                try {
                  const payload = await requestJson<{ data?: { explanation?: string } }>("/api/ai/reexplain", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ step: item, subject, grade })
                  });
                  setReexplanations((prev) => ({
                    ...prev,
                    [index]:
                      payload.data?.explanation ||
                      "可以先把这一步理解成“先判断眼前这块材料要怎么处理”，不要急着一口气跳到最后答案。"
                  }));
                } finally {
                  setLoadingIndex(null);
                }
              }}
            >
              {loadingIndex === index ? "换种方式讲解中..." : "我不懂，换种方式说"}
            </button>
          </div>
          {reexplanations[index] ? <div className="status-note info">{reexplanations[index]}</div> : null}
        </motion.div>
      ))}
    </div>
  );
}

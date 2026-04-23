"use client";

import { useEffect, useState } from "react";
import Card from "@/components/Card";
import { requestJson } from "@/lib/client-request";

type GoalPayload = {
  goal?: {
    title: string;
    targetDate: string;
    knowledgePointId?: string | null;
  } | null;
  suggestions?: string[];
  mastery?: {
    masteryScore: number;
    masteryLevel: string;
  } | null;
};

export default function ParentGoalSetCard() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [payload, setPayload] = useState<GoalPayload | null>(null);
  const [title, setTitle] = useState("");
  const [targetDate, setTargetDate] = useState("");

  useEffect(() => {
    let mounted = true;
    void requestJson<{ data?: GoalPayload }>("/api/parent/goal")
      .then((result) => {
        if (!mounted) {
          return;
        }
        setPayload(result.data ?? null);
        setTitle(result.data?.goal?.title ?? "");
        setTargetDate(result.data?.goal?.targetDate?.slice(0, 10) ?? "");
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <Card title="亲子目标共设" tag="本周目标">
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ color: "var(--ink-1)" }}>把目标写成一个具体动作，比只说“这周要加油”更容易真的执行下去。</div>
        <label style={{ display: "grid", gap: 8 }}>
          <div className="section-title">目标内容</div>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="例如：本周把分数运算讲明白并完成 6 道巩固题"
            style={{ width: "100%", padding: 12, borderRadius: 14, border: "1px solid var(--stroke)" }}
          />
        </label>
        <label style={{ display: "grid", gap: 8 }}>
          <div className="section-title">目标日期</div>
          <input
            type="date"
            value={targetDate}
            onChange={(event) => setTargetDate(event.target.value)}
            style={{ width: "100%", padding: 12, borderRadius: 14, border: "1px solid var(--stroke)" }}
          />
        </label>
        <div className="cta-row">
          <button
            className="button primary"
            type="button"
            disabled={saving || !title.trim() || !targetDate}
            onClick={async () => {
              setSaving(true);
              try {
                const result = await requestJson<{ data?: GoalPayload["goal"] }>("/api/parent/goal", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ title, targetDate })
                });
                setPayload((prev) => ({ ...prev, goal: result.data ?? null }));
                setMessage("本周目标已保存，后续可以围绕这个目标安排今晚的陪伴。");
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "保存中..." : "保存目标"}
          </button>
        </div>
        {payload?.mastery ? (
          <div className="pill-list">
            <span className="pill">当前掌握度 {payload.mastery.masteryScore}</span>
            <span className="pill">状态 {payload.mastery.masteryLevel}</span>
          </div>
        ) : null}
        {payload?.suggestions?.length ? (
          <div className="card" style={{ display: "grid", gap: 8 }}>
            <div className="badge">AI 建议</div>
            {payload.suggestions.slice(0, 3).map((item) => (
              <div key={item} style={{ color: "var(--ink-1)" }}>
                {item}
              </div>
            ))}
          </div>
        ) : null}
        {message ? <div className="status-note success">{message}</div> : null}
        {loading ? <div className="status-note info">正在读取当前目标与建议...</div> : null}
      </div>
    </Card>
  );
}

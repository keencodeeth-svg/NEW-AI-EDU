"use client";

import { useEffect, useState } from "react";
import Card from "@/components/Card";
import { requestJson } from "@/lib/client-request";

type MoodSummary = {
  total: number;
  latestMood: "good" | "neutral" | "tired" | null;
  counts: {
    good: number;
    neutral: number;
    tired: number;
  };
  trend: Array<{
    date: string;
    good: number;
    neutral: number;
    tired: number;
  }>;
};

const MOOD_LABEL: Record<"good" | "neutral" | "tired", string> = {
  good: "状态不错",
  neutral: "状态一般",
  tired: "有点疲惫"
};

export default function ParentMoodTrendCard() {
  const [summary, setSummary] = useState<MoodSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    void requestJson<{ data?: { summary?: MoodSummary } }>("/api/student/mood")
      .then((payload) => {
        if (mounted) {
          setSummary(payload.data?.summary ?? null);
        }
      })
      .catch(() => {
        if (mounted) {
          setSummary(null);
        }
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
    <Card title="学习情绪趋势" tag="Mood">
      <div style={{ display: "grid", gap: 12 }}>
        {loading ? <div className="status-note info">正在读取最近练习后的情绪记录...</div> : null}
        {!loading && !summary?.total ? <div className="status-note info">孩子最近还没有提交情绪日记，后续完成练习后会在这里形成趋势。</div> : null}
        {summary?.total ? (
          <>
            <div className="pill-list">
              <span className="pill">最近记录 {summary.total}</span>
              <span className="pill">最近状态 {summary.latestMood ? MOOD_LABEL[summary.latestMood] : "暂无"}</span>
            </div>
            <div className="workflow-summary-grid">
              <div className="workflow-summary-card">
                <div className="workflow-summary-label">状态不错</div>
                <div className="workflow-summary-value">{summary.counts.good}</div>
              </div>
              <div className="workflow-summary-card">
                <div className="workflow-summary-label">状态一般</div>
                <div className="workflow-summary-value">{summary.counts.neutral}</div>
              </div>
              <div className="workflow-summary-card">
                <div className="workflow-summary-label">有点疲惫</div>
                <div className="workflow-summary-value">{summary.counts.tired}</div>
              </div>
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {summary.trend.slice(-5).map((item) => (
                <div
                  key={item.date}
                  className="card"
                  style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}
                >
                  <div className="section-title" style={{ margin: 0 }}>
                    {item.date}
                  </div>
                  <div className="pill-list">
                    <span className="pill">好 {item.good}</span>
                    <span className="pill">一般 {item.neutral}</span>
                    <span className="pill">累 {item.tired}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </Card>
  );
}

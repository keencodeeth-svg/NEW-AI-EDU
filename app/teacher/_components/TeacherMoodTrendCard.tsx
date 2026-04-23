"use client";

import { useEffect, useMemo, useState } from "react";
import Card from "@/components/Card";
import { requestJson } from "@/lib/client-request";

type TeacherClassOption = {
  id: string;
  name: string;
};

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

export default function TeacherMoodTrendCard({ classes }: { classes: TeacherClassOption[] }) {
  const [classId, setClassId] = useState(classes[0]?.id ?? "");
  const [summary, setSummary] = useState<MoodSummary | null>(null);
  const [studentCount, setStudentCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const resolvedClassId = useMemo(() => {
    if (classId && classes.some((item) => item.id === classId)) {
      return classId;
    }
    return classes[0]?.id ?? "";
  }, [classId, classes]);

  useEffect(() => {
    if (!resolvedClassId) {
      return;
    }
    let mounted = true;
    queueMicrotask(() => {
      if (mounted) {
        setLoading(true);
      }
    });
    void requestJson<{ data?: { students?: string[]; summary?: MoodSummary } }>(
      `/api/student/mood?classId=${encodeURIComponent(resolvedClassId)}`
    )
      .then((payload) => {
        if (!mounted) {
          return;
        }
        setSummary(payload.data?.summary ?? null);
        setStudentCount(payload.data?.students?.length ?? 0);
      })
      .catch(() => {
        if (mounted) {
          setSummary(null);
          setStudentCount(0);
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
  }, [resolvedClassId]);

  const displaySummary = resolvedClassId ? summary : null;
  const displayStudentCount = resolvedClassId ? studentCount : 0;

  return (
    <Card title="班级情绪趋势" tag="Mood">
      <div style={{ display: "grid", gap: 12 }}>
        {!classes.length ? <div className="status-note info">先创建班级并邀请学生后，这里会显示最近练习后的情绪趋势。</div> : null}
        {classes.length ? (
          <label style={{ display: "grid", gap: 8 }}>
            <div className="section-title">查看班级</div>
            <select
              value={resolvedClassId}
              onChange={(event) => setClassId(event.target.value)}
              style={{ width: "100%", padding: 12, borderRadius: 14, border: "1px solid var(--stroke)" }}
            >
              {classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {loading ? <div className="status-note info">正在汇总最近 7 天的情绪签到...</div> : null}
        {!loading && displaySummary ? (
          <>
            <div className="pill-list">
              <span className="pill">覆盖学生 {displayStudentCount}</span>
              <span className="pill">最近签到 {displaySummary.total}</span>
              <span className="pill">疲惫信号 {displaySummary.counts.tired}</span>
            </div>
            <div className="workflow-summary-grid">
              <div className="workflow-summary-card">
                <div className="workflow-summary-label">状态不错</div>
                <div className="workflow-summary-value">{displaySummary.counts.good}</div>
              </div>
              <div className="workflow-summary-card">
                <div className="workflow-summary-label">状态一般</div>
                <div className="workflow-summary-value">{displaySummary.counts.neutral}</div>
              </div>
              <div className="workflow-summary-card">
                <div className="workflow-summary-label">有点疲惫</div>
                <div className="workflow-summary-value">{displaySummary.counts.tired}</div>
              </div>
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {displaySummary.trend.slice(-5).map((item) => (
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

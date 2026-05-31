"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Card from "@/components/Card";
import StatePanel from "@/components/StatePanel";
import {
  buildAudienceModeLabel,
  buildLearningModeLabel,
  type ClassroomDeliveryRecord,
} from "@/lib/classroom-integration";
import { listStages, type StageListItem } from "@/lib/utils/stage-storage";

type DeliveredStageItem = StageListItem & {
  deliveryRecords: ClassroomDeliveryRecord[];
  latestDeliveryAt: number;
};

function toTimeLabel(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export default function TeacherInteractiveClassroomDeliveryLedgerCard() {
  const [items, setItems] = useState<DeliveredStageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    if (mode === "initial") {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    setLoadError(null);

    try {
      const stages = await listStages();
      const deliveredStages = stages
        .map((stage) => {
          const deliveryRecords = [...(stage.classroomMeta?.deliveryRecords ?? [])].sort(
            (left, right) =>
              new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
          );

          if (!deliveryRecords.length) return null;

          return {
            ...stage,
            deliveryRecords,
            latestDeliveryAt: new Date(deliveryRecords[0].createdAt).getTime(),
          };
        })
        .filter((item): item is DeliveredStageItem => Boolean(item))
        .sort((left, right) => right.latestDeliveryAt - left.latestDeliveryAt);

      setItems(deliveredStages);
    } catch (nextError) {
      setLoadError(nextError instanceof Error ? nextError.message : "课堂分享记录加载失败");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = useMemo(() => {
    const records = items.flatMap((item) => item.deliveryRecords);
    return {
      classrooms: items.length,
      publishes: records.filter((item) => item.kind === "publish").length,
      exports: records.filter((item) => item.kind === "export").length,
    };
  }, [items]);

  async function handleCopy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setActionError(null);
      setMessage("全班观看地址已复制，可直接发给班级或投到群里。");
      window.setTimeout(() => setMessage(null), 1800);
    } catch (nextError) {
      setActionError(nextError instanceof Error ? nextError.message : "复制观看地址失败");
    }
  }

  if (loading) {
    return (
      <Card title="课堂分享记录" tag="课堂闭环">
        <StatePanel
          compact
          tone="loading"
          title="课堂分享记录加载中"
          description="正在汇总最近的发布、导出与资源包记录。"
        />
      </Card>
    );
  }

  if (loadError) {
    return (
      <Card title="课堂分享记录" tag="课堂闭环">
        <StatePanel
          compact
          tone="error"
          title="课堂分享记录加载失败"
          description={loadError}
          action={
            <button className="button secondary" type="button" onClick={() => void load("refresh")}>
              重试
            </button>
          }
        />
      </Card>
    );
  }

  return (
    <Card title="课堂分享记录" tag="课堂闭环">
      <div className="grid" style={{ gap: 14 }}>
        <div style={{ fontSize: 14, lineHeight: 1.7 }}>
          这里汇总最近课堂的全班观看发布、PPT 课件导出和资源包导出记录，方便老师回看哪一节课已经分享、是否适合继续复用，或继续加工成学生自主巩固课堂。
        </div>

        <div className="badge-row">
          <span className="badge">已分享课堂 {summary.classrooms} 节</span>
          <span className="badge">全班观看发布 {summary.publishes} 次</span>
          <span className="badge">导出记录 {summary.exports} 次</span>
        </div>

        <div className="cta-row">
          <button
            className="button secondary"
            type="button"
            onClick={() => void load("refresh")}
            disabled={refreshing}
          >
            {refreshing ? "刷新中..." : "刷新记录"}
          </button>
          <Link className="button ghost" href="/ai-classroom">
            新建互动课堂
          </Link>
        </div>

        {items.length ? (
          <div className="grid" style={{ gap: 12 }}>
            {items.slice(0, 6).map((item) => {
              const latest = item.deliveryRecords[0];
              const className = item.classroomMeta?.className || item.name;
              const publishedUrl = item.classroomMeta?.publishedUrl;

              return (
                <div key={item.id} className="card" style={{ padding: 12 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      alignItems: "flex-start",
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ minWidth: 0, flex: "1 1 360px" }}>
                      <div style={{ fontSize: 15, fontWeight: 700 }}>{className}</div>
                      <div
                        style={{
                          marginTop: 6,
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 8,
                        }}
                      >
                        {item.classroomMeta?.subject ? (
                          <span className="badge">{item.classroomMeta.subject}</span>
                        ) : null}
                        {item.classroomMeta?.grade ? (
                          <span className="badge">{item.classroomMeta.grade} 年级</span>
                        ) : null}
                        <span className="badge">
                          {buildAudienceModeLabel(item.classroomMeta?.audienceMode)}
                        </span>
                        {item.classroomMeta?.learningMode ? (
                          <span className="badge">
                            {buildLearningModeLabel(item.classroomMeta.learningMode)}
                          </span>
                        ) : null}
                      </div>
                      <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.7 }}>
                        最近动作：{latest.label} · {toTimeLabel(latest.createdAt)}
                        {latest.fileName ? ` · ${latest.fileName}` : ""}
                      </div>
                    </div>

                    <div className="cta-row cta-row-tight no-margin">
                      <Link className="button secondary" href={`/classroom/${item.id}`}>
                        打开课堂
                      </Link>
                      {publishedUrl ? (
                        <button
                          className="button ghost"
                          type="button"
                          onClick={() => void handleCopy(publishedUrl)}
                        >
                          复制观看地址
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: 12,
                      display: "grid",
                      gap: 8,
                      gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    }}
                  >
                    {item.deliveryRecords.slice(0, 3).map((record) => (
                      <div
                        key={record.id}
                        style={{
                          border: "1px solid var(--stroke)",
                          borderRadius: 12,
                          padding: "10px 12px",
                          background: "rgba(15, 23, 42, 0.02)",
                        }}
                      >
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{record.label}</div>
                        <div style={{ marginTop: 4, fontSize: 12, lineHeight: 1.6, color: "var(--ink-1)" }}>
                          {toTimeLabel(record.createdAt)}
                          {record.fileName ? ` · ${record.fileName}` : ""}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <StatePanel
            compact
            tone="info"
            title="还没有课堂分享记录"
            description="先生成一节互动课堂并发布全班观看地址，或导出 PPT / 资源包后，这里就会开始沉淀课堂分享记录。"
          />
        )}

        {message ? <div style={{ color: "#027a48", fontSize: 13 }}>{message}</div> : null}
        {actionError ? <div className="status-note error">{actionError}</div> : null}
      </div>
    </Card>
  );
}

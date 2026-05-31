import Link from "next/link";
import Card from "@/components/Card";
import Stat from "@/components/Stat";
import StatePanel from "@/components/StatePanel";
import {
  buildAudienceModeLabel,
  buildDeliveryFormatLabel,
  buildLearningModeLabel,
  type ClassroomDeliveryAuditRecord,
  type SchoolClassroomDeliverySummary,
} from "@/lib/classroom-integration";

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

function buildActorRoleLabel(record: ClassroomDeliveryAuditRecord) {
  if (record.actorRole === "student") {
    return "学生自主使用";
  }
  if (record.actorRole === "school_admin") {
    return "学校管理员发起";
  }
  if (record.actorRole === "admin") {
    return "平台管理员发起";
  }
  return "教师发起";
}

export function SchoolInteractiveClassroomDeliveryCard({
  summary,
}: {
  summary: SchoolClassroomDeliverySummary | null;
}) {
  if (!summary) {
    return (
      <Card title="课堂交付质量" tag="知序课堂">
        <StatePanel
          compact
          tone="loading"
          title="课堂交付质量加载中"
          description="正在汇总学校内的发布、导出与学生自主使用数据。"
        />
      </Card>
    );
  }

  return (
    <Card title="课堂交付质量" tag="知序课堂">
      <div className="section-sub">
        把教师发布、资源导出与学生自主巩固放在同一套质量视图里，学校可以直接看到课堂学习的实际覆盖、传播与复用情况。
      </div>

      <div className="grid grid-3" style={{ marginTop: 12 }}>
        <Stat label="累计交付动作" value={String(summary.totalDeliveries)} helper="发布 + 导出" />
        <Stat label="已交付课堂" value={String(summary.deliveredClassroomCount)} helper="按课堂去重" />
        <Stat label="覆盖班级/主题" value={String(summary.coveredClassCount)} helper="按班级或课堂去重" />
        <Stat label="全班观看发布" value={String(summary.publishCount)} helper={`${summary.wholeClassDeliveryCount} 次面向整班`} />
        <Stat label="导出归档" value={String(summary.exportCount)} helper={`${summary.pptxExportCount} 次 PPTX / ${summary.resourcePackExportCount} 次资源包`} />
        <Stat label="学生自主使用" value={String(summary.studentInitiatedCount)} helper={`${summary.teacherInitiatedCount} 次教师发起`} />
      </div>

      {summary.totalDeliveries === 0 ? (
        <div style={{ marginTop: 14 }}>
          <StatePanel
            compact
            tone="info"
            title="学校还没有沉淀课堂交付记录"
            description="老师发布全班观看地址、导出 PPT/资源包，或学生开始自主巩固之后，这里会自动形成学校级质量台账。"
          />
        </div>
      ) : (
        <div className="grid grid-2" style={{ marginTop: 14, alignItems: "start" }}>
          <div className="card">
            <div className="section-title">最近交付</div>
            <div className="grid" style={{ gap: 10, marginTop: 10 }}>
              {summary.recentDeliveries.map((record) => (
                <div
                  key={record.id}
                  style={{
                    border: "1px solid var(--stroke)",
                    borderRadius: 12,
                    padding: "10px 12px",
                    background: "rgba(15, 23, 42, 0.02)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 10,
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ minWidth: 0, flex: "1 1 260px" }}>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>
                        {record.className || record.stageName}
                      </div>
                      <div style={{ marginTop: 4, fontSize: 12, color: "var(--ink-1)", lineHeight: 1.7 }}>
                        {record.label} · {buildDeliveryFormatLabel(record.format)} · {toTimeLabel(record.createdAt)}
                      </div>
                    </div>
                    <span className="badge">{buildActorRoleLabel(record)}</span>
                  </div>

                  <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {record.subject ? <span className="badge">{record.subject}</span> : null}
                    {record.grade ? <span className="badge">{record.grade} 年级</span> : null}
                    {record.audienceMode ? (
                      <span className="badge">{buildAudienceModeLabel(record.audienceMode)}</span>
                    ) : null}
                    {record.learningMode ? (
                      <span className="badge">{buildLearningModeLabel(record.learningMode)}</span>
                    ) : null}
                  </div>

                  <div style={{ marginTop: 8, fontSize: 12, color: "var(--ink-1)", lineHeight: 1.7 }}>
                    发起人：{record.actorName || record.actorUserId}
                    {record.teacherName ? ` · 教师：${record.teacherName}` : ""}
                    {record.learnerName ? ` · 学习者：${record.learnerName}` : ""}
                    {record.fileName ? ` · 文件：${record.fileName}` : ""}
                  </div>

                  {record.publishedUrl ? (
                    <div className="cta-row cta-row-tight no-margin" style={{ marginTop: 10 }}>
                      <a className="button ghost" href={record.publishedUrl} target="_blank" rel="noreferrer">
                        打开观看页
                      </a>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="section-title">高频使用班级</div>
            <div className="grid" style={{ gap: 10, marginTop: 10 }}>
              {summary.topClasses.map((item) => (
                <div
                  key={item.key}
                  style={{
                    border: "1px solid var(--stroke)",
                    borderRadius: 12,
                    padding: "10px 12px",
                    background: "rgba(2, 132, 199, 0.04)",
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{item.className}</div>
                  <div style={{ marginTop: 4, fontSize: 12, color: "var(--ink-1)" }}>
                    {item.subject || "未标注学科"}
                    {item.grade ? ` · ${item.grade} 年级` : ""}
                  </div>
                  <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 8 }}>
                    <span className="badge">累计 {item.deliveryCount} 次</span>
                    <span className="badge">发布 {item.publishCount} 次</span>
                    <span className="badge">导出 {item.exportCount} 次</span>
                  </div>
                  <div style={{ marginTop: 8, fontSize: 12, color: "var(--ink-1)" }}>
                    最近一次：{toTimeLabel(item.lastDeliveredAt)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="cta-row" style={{ marginTop: 14 }}>
        <Link className="button secondary" href="/school/interactive-classrooms">
          进入质量中心
        </Link>
        <Link className="button ghost" href="/school">
          返回学校总览
        </Link>
      </div>

      <div className="cta-row" style={{ marginTop: 8 }}>
        <Link className="button secondary" href="/teacher/ai-tools">
          查看教师互动工具台
        </Link>
        <Link className="button ghost" href="/ai-classroom">
          进入课堂工作区
        </Link>
      </div>
    </Card>
  );
}

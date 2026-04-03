import Link from "next/link";
import Card from "@/components/Card";
import { getLaunchReadinessReport } from "@/lib/launch-readiness";

const stateMeta = {
  pass: { label: "可上线", color: "#166534", bg: "#dcfce7" },
  warn: { label: "需收敛", color: "#92400e", bg: "#fef3c7" },
  fail: { label: "有阻断", color: "#b42318", bg: "#fee4e2" },
} as const;

export default async function LaunchReadinessOverviewCard() {
  const report = await getLaunchReadinessReport();
  const meta = stateMeta[report.overallState];

  return (
    <Card title="上线准备中心" tag="发布">
      <div className="feature-card">
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 10px",
            borderRadius: 999,
            background: meta.bg,
            color: meta.color,
            fontWeight: 700,
            fontSize: 12,
          }}
        >
          {meta.label}
        </div>
        <p style={{ marginTop: 12 }}>
          当前共有 {report.summary.fail} 项阻断、{report.summary.warn} 项预警。
          {report.providerSource === "runtime"
            ? " 当前 AI 生效链来自后台运行时配置。"
            : " 当前 AI 生效链来自环境变量。"}
        </p>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 10,
          marginTop: 12,
        }}
      >
        <div className="card" style={{ padding: 12 }}>
          <div className="section-title">通过</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{report.summary.pass}</div>
        </div>
        <div className="card" style={{ padding: 12 }}>
          <div className="section-title">预警</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{report.summary.warn}</div>
        </div>
        <div className="card" style={{ padding: 12 }}>
          <div className="section-title">阻断</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{report.summary.fail}</div>
        </div>
      </div>
      <Link className="button secondary" href="/admin/launch-readiness" style={{ marginTop: 12 }}>
        打开上线准备中心
      </Link>
    </Card>
  );
}

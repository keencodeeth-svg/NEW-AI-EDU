import Link from "next/link";
import Card from "@/components/Card";
import { getCurrentUser } from "@/lib/auth";
import { getLaunchReadinessReport } from "@/lib/launch-readiness";

const stateMeta = {
  pass: {
    label: "可上线",
    color: "#166534",
    bg: "#dcfce7",
    border: "#86efac",
  },
  warn: {
    label: "需收敛",
    color: "#92400e",
    bg: "#fef3c7",
    border: "#fcd34d",
  },
  fail: {
    label: "存在阻断",
    color: "#b42318",
    bg: "#fee4e2",
    border: "#fda29b",
  },
} as const;

function formatTime(value: string) {
  return new Date(value).toLocaleString("zh-CN");
}

export default async function AdminLaunchReadinessPage() {
  const user = await getCurrentUser();

  if (user?.role !== "admin") {
    return (
      <div className="grid" style={{ gap: 18 }}>
        <div className="section-head">
          <div>
            <h2>上线准备中心</h2>
            <div className="section-sub">该页面仅对管理员开放，用于发布前的依赖与配置自检。</div>
          </div>
          <span className="chip">发布</span>
        </div>
        <Card title="需要管理员登录" tag="权限">
          <p>请先使用管理员账号登录，再查看上线准备状态、模型链路和发布前阻断项。</p>
          <Link className="button secondary" href="/login?role=admin" style={{ marginTop: 12 }}>
            去管理员登录
          </Link>
        </Card>
      </div>
    );
  }

  const report = await getLaunchReadinessReport();
  const overallMeta = stateMeta[report.overallState];
  const blockers = report.items.filter((item) => item.state === "fail");
  const warnings = report.items.filter((item) => item.state === "warn");

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="section-head">
        <div>
          <h2>上线准备中心</h2>
          <div className="section-sub">
            把数据库、对象存储、AI 模型链和后台安全配置收成一份统一报告，发布前先看这里。
          </div>
        </div>
        <span className="chip">发布</span>
      </div>

      <Card title="当前结论" tag={overallMeta.label}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.4fr 1fr",
            gap: 16,
            alignItems: "stretch",
          }}
        >
          <div
            style={{
              borderRadius: 18,
              border: `1px solid ${overallMeta.border}`,
              background: overallMeta.bg,
              color: overallMeta.color,
              padding: 16,
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 700 }}>{overallMeta.label}</div>
            <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.7 }}>
              环境：{report.environment} · 严格上线模式：{report.strictLaunchMode ? "开启" : "未开启"} ·
              检查时间：{formatTime(report.generatedAt)}
            </div>
            <div style={{ marginTop: 10, fontSize: 14, lineHeight: 1.8 }}>
              当前共有 {report.summary.fail} 项阻断、{report.summary.warn} 项预警、{report.summary.pass} 项通过。
              AI 生效链为 {report.providerChain.join(" -> ")}，来源为
              {report.providerSource === "runtime" ? "后台运行时配置" : "环境变量"}。
            </div>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 10,
            }}
          >
            <div className="card" style={{ padding: 14 }}>
              <div className="section-title">通过</div>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{report.summary.pass}</div>
            </div>
            <div className="card" style={{ padding: 14 }}>
              <div className="section-title">预警</div>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{report.summary.warn}</div>
            </div>
            <div className="card" style={{ padding: 14 }}>
              <div className="section-title">阻断</div>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{report.summary.fail}</div>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-2">
        <Card title="上线前优先处理" tag="阻断">
          {blockers.length ? (
            <div className="grid" style={{ gap: 10 }}>
              {blockers.map((item) => (
                <div
                  key={item.key}
                  className="card"
                  style={{ padding: 12, borderColor: stateMeta.fail.border }}
                >
                  <div className="section-title">{item.label}</div>
                  <div style={{ marginTop: 6, fontSize: 14, lineHeight: 1.7 }}>{item.message}</div>
                  {item.action ? (
                    <div style={{ marginTop: 8, fontSize: 12, color: "var(--ink-1)" }}>{item.action}</div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p>当前没有 fail 级阻断项，可以继续收敛 warn 项后进入发布验证。</p>
          )}
        </Card>

        <Card title="建议继续收敛" tag="预警">
          {warnings.length ? (
            <div className="grid" style={{ gap: 10 }}>
              {warnings.map((item) => (
                <div
                  key={item.key}
                  className="card"
                  style={{ padding: 12, borderColor: stateMeta.warn.border }}
                >
                  <div className="section-title">{item.label}</div>
                  <div style={{ marginTop: 6, fontSize: 14, lineHeight: 1.7 }}>{item.message}</div>
                  {item.action ? (
                    <div style={{ marginTop: 8, fontSize: 12, color: "var(--ink-1)" }}>{item.action}</div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p>当前 warn 项已清空，可以直接进入发布验证与远端 smoke。</p>
          )}
        </Card>
      </div>

      <Card title="逐项检查" tag="清单">
        <div className="grid grid-2" style={{ gap: 12 }}>
          {report.items.map((item) => {
            const meta = stateMeta[item.state];
            return (
              <div
                key={item.key}
                className="card"
                style={{
                  padding: 14,
                  borderColor: meta.border,
                  background: item.state === "pass" ? undefined : meta.bg,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <div className="section-title">{item.label}</div>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "4px 8px",
                      borderRadius: 999,
                      fontSize: 12,
                      fontWeight: 700,
                      background: meta.bg,
                      color: meta.color,
                    }}
                  >
                    {meta.label}
                  </span>
                </div>
                <div style={{ marginTop: 8, fontSize: 14, lineHeight: 1.8 }}>{item.message}</div>
                {item.action ? (
                  <div style={{ marginTop: 8, fontSize: 12, color: "var(--ink-1)" }}>{item.action}</div>
                ) : null}
              </div>
            );
          })}
        </div>
      </Card>

      <Card title="运行时依赖明细" tag="readiness">
        <div className="grid" style={{ gap: 10 }}>
          {report.readiness.checks.map((check) => {
            const meta = stateMeta[check.state];
            return (
              <div
                key={check.name}
                className="card"
                style={{
                  padding: 12,
                  borderColor: meta.border,
                  background: check.state === "pass" ? undefined : meta.bg,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <div className="section-title">{check.name}</div>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "4px 8px",
                      borderRadius: 999,
                      fontSize: 12,
                      fontWeight: 700,
                      background: meta.bg,
                      color: meta.color,
                    }}
                  >
                    {check.state}
                  </span>
                </div>
                <div style={{ marginTop: 8, fontSize: 14, lineHeight: 1.8 }}>{check.message}</div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card title="发布前命令" tag="操作">
        <div className="grid" style={{ gap: 10 }}>
          <div className="card" style={{ padding: 12 }}>
            <div className="section-title">本地自检</div>
            <pre
              style={{
                marginTop: 8,
                padding: 12,
                borderRadius: 12,
                background: "var(--panel)",
                overflowX: "auto",
                fontSize: 12,
              }}
            >
{`corepack pnpm launch:readiness
corepack pnpm test:smoke:production-like:local
corepack pnpm verify`}
            </pre>
          </div>
          <div className="card" style={{ padding: 12 }}>
            <div className="section-title">发布后巡检</div>
            <pre
              style={{
                marginTop: 8,
                padding: 12,
                borderRadius: 12,
                background: "var(--panel)",
                overflowX: "auto",
                fontSize: 12,
              }}
            >
{`curl -fsS https://your-domain/api/health
curl -fsS -H "x-readiness-token: $READINESS_PROBE_TOKEN" https://your-domain/api/health/readiness`}
            </pre>
          </div>
        </div>
      </Card>
    </div>
  );
}

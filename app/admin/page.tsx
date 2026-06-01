import Link from "next/link";
import AnalyticsFunnelCard from "@/components/AnalyticsFunnelCard";
import Card from "@/components/Card";
import EduIcon from "@/components/EduIcon";
import LaunchReadinessOverviewCard from "@/components/LaunchReadinessOverviewCard";
import ObservabilityAlertsCard from "@/components/ObservabilityAlertsCard";
import ObservabilityMetricsCard from "@/components/ObservabilityMetricsCard";
import StatePanel from "@/components/StatePanel";
import WorkspacePage from "@/components/WorkspacePage";

const priorityActions = [
  {
    title: "发布风险",
    status: "阻断需先确认",
    consequence: "上线准备会检查登录、模型、存储和运行时配置，继续发布前必须先看阻断项。",
    primaryLabel: "处理发布阻断",
    primaryHref: "/admin/launch-readiness",
    secondaryLabel: "查看上线准备",
    secondaryHref: "/admin/launch-readiness"
  },
  {
    title: "账号恢复",
    status: "进入详情查看",
    consequence: "忘记密码、账号锁定和找回账号会直接影响学生、教师与家长重新进入平台。",
    primaryLabel: "处理恢复工单",
    primaryHref: "/admin/recovery-requests",
    secondaryLabel: "打开工单台",
    secondaryHref: "/admin/recovery-requests"
  },
  {
    title: "AI 模型链",
    status: "需例行巡检",
    consequence: "主备模型、任务策略、连通性与调用指标决定 AI 教学能力是否稳定可降级。",
    primaryLabel: "检查模型链",
    primaryHref: "/admin/ai-models",
    secondaryLabel: "查看调用指标",
    secondaryHref: "/admin/ai-models"
  }
];

const contentGovernanceCards = [
  {
    title: "教材课件管理",
    description: "导入教材、上传课件/教案、执行全学科批量导入。",
    icon: "book" as const,
    href: "/library",
    action: "进入资料库"
  },
  {
    title: "题库管理",
    description: "维护题库、解析、难度标签和质量复检。",
    icon: "pencil" as const,
    href: "/admin/questions",
    action: "进入题库"
  },
  {
    title: "知识点树",
    description: "维护 K12 学科、年级、单元与知识点结构。",
    icon: "book" as const,
    href: "/admin/knowledge-points",
    action: "管理知识点"
  }
];

export default function AdminPage() {
  return (
    <WorkspacePage
      title="管理运营工作台"
      subtitle="先处理发布阻断、账号恢复与模型异常，再进入内容治理和实验配置。"
      chips={[<span className="chip" key="admin-role">管理端</span>, <span className="chip" key="admin-mode">行动优先</span>]}
      actions={
        <>
          <Link className="button primary" href="/admin/launch-readiness">
            查看上线准备
          </Link>
          <Link className="button secondary" href="/admin/ai-models">
            查看模型链
          </Link>
        </>
      }
    >
      <StatePanel
        compact
        tone="info"
        title="今日优先：先确认发布阻断、恢复工单和模型链路"
        description="首屏只保留会影响发布、账号进入和 AI 教学稳定性的三条行动，其余治理能力放到下方分组。"
        action={
          <Link className="button secondary" href="/admin/launch-readiness">
            查看上线准备详情
          </Link>
        }
      />

      <section className="admin-ops-grid" aria-label="管理端首屏行动">
        <Card title="今天先处理什么" tag="优先行动" className="admin-priority-card">
          <ol className="admin-priority-list" aria-label="管理员今日优先行动">
            {priorityActions.map((item) => (
              <li key={item.title} className="admin-priority-item">
                <div className="admin-priority-item-head">
                  <div>
                    <div className="admin-priority-title">{item.title}</div>
                    <div className="admin-priority-consequence">{item.consequence}</div>
                  </div>
                  <span className="admin-status-pill">{item.status}</span>
                </div>
                <div className="cta-row admin-priority-actions">
                  <Link className="button secondary" href={item.primaryHref}>
                    {item.primaryLabel}
                  </Link>
                  <Link className="button ghost" href={item.secondaryHref}>
                    {item.secondaryLabel}
                  </Link>
                </div>
              </li>
            ))}
          </ol>
        </Card>

        <Card title="平台状态概览" tag="发布与稳定">
          <div className="admin-status-stack" aria-live="polite">
            <div className="admin-status-row">
              <span>上线准备</span>
              <strong>以 readiness 为准</strong>
            </div>
            <div className="admin-status-row">
              <span>恢复工单</span>
              <strong>进入详情查看</strong>
            </div>
            <div className="admin-status-row">
              <span>模型路由</span>
              <strong>主备链需巡检</strong>
            </div>
            <div className="admin-status-row">
              <span>审计日志</span>
              <strong>关键变更可追踪</strong>
            </div>
          </div>
        </Card>
      </section>

      <section className="grid" style={{ gap: 14 }} aria-labelledby="admin-content-governance-title">
        <div className="section-head compact">
          <div>
            <h3 id="admin-content-governance-title">内容治理</h3>
            <div className="section-sub">当首屏三类运营风险处理完，再维护教材、题库和知识点结构。</div>
          </div>
          <span className="chip">内容质量</span>
        </div>
        <div className="grid grid-3">
          {contentGovernanceCards.map((item) => (
            <Card key={item.title} title={item.title} tag="治理">
              <div className="feature-card">
                <EduIcon name={item.icon} />
                <p>{item.description}</p>
              </div>
              <Link className="button secondary" href={item.href} style={{ marginTop: 12 }}>
                {item.action}
              </Link>
            </Card>
          ))}
        </div>
      </section>

      <section className="grid grid-2" aria-label="发布、实验与审计">
        <LaunchReadinessOverviewCard />
        <Card title="实验与灰度发布" tag="发布治理">
          <div className="feature-card">
            <EduIcon name="rocket" />
            <p>管理实验分组、阈值调优与灰度发布开关；不作为每日首屏阻断项展示。</p>
          </div>
          <Link className="button secondary" href="/admin/experiments" style={{ marginTop: 12 }}>
            打开实验中心
          </Link>
        </Card>
        <Card title="操作日志" tag="审计运维">
          <div className="feature-card">
            <EduIcon name="board" />
            <p>查看管理员操作记录与关键变更，辅助恢复、发布和模型配置追踪。</p>
          </div>
          <Link className="button secondary" href="/admin/logs" style={{ marginTop: 12 }}>
            查看日志
          </Link>
        </Card>
        <Card title="接口可观测性" tag="审计运维">
          <div className="feature-card">
            <EduIcon name="chart" />
            <p>请求量、错误率与慢接口趋势。</p>
          </div>
          <div style={{ marginTop: 12 }}>
            <ObservabilityMetricsCard />
          </div>
        </Card>
        <Card title="观测告警" tag="异常处理">
          <div className="feature-card">
            <EduIcon name="rocket" />
            <p>按阈值汇总 API 与 AI 异常，方便管理员快速判断是否需要介入。</p>
          </div>
          <div style={{ marginTop: 12 }}>
            <ObservabilityAlertsCard />
          </div>
        </Card>
        <Card title="学生趋势观察" tag="趋势观察">
          <div className="feature-card">
            <EduIcon name="chart" />
            <p>学习漏斗用于观察登录、练习、提交与周报趋势，不抢占首屏运营决策。</p>
          </div>
          <div style={{ marginTop: 12 }}>
            <AnalyticsFunnelCard />
          </div>
        </Card>
      </section>
    </WorkspacePage>
  );
}

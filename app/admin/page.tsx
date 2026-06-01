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
    status: "阻断项优先",
    signal: "上线前检查发现登录、模型、存储或运行时配置有缺口。",
    consequence: "任何发布阻断都会直接影响今天能否安全上线，先清掉再安排其它运营动作。",
    primaryLabel: "处理发布阻断",
    primaryHref: "/admin/launch-readiness",
    secondaryLabel: "查看上线准备",
    secondaryHref: "/admin/launch-readiness"
  },
  {
    title: "账号恢复",
    status: "入口体验优先",
    signal: "学生、教师或家长出现忘记密码、账号锁定、无法找回等阻塞进入问题。",
    consequence: "恢复工单堆积会让真实用户进不了平台，影响教学准备、课堂进入和家校协同。",
    primaryLabel: "处理恢复工单",
    primaryHref: "/admin/recovery-requests",
    secondaryLabel: "打开工单台",
    secondaryHref: "/admin/recovery-requests"
  },
  {
    title: "AI 模型链",
    status: "教学稳定优先",
    signal: "主备模型、任务策略、连通性或成本指标出现波动，AI 教学结果可能不稳定。",
    consequence: "模型链异常会直接影响生成质量、降级策略和课堂可用性，需要先确认是否还能稳定服务。",
    primaryLabel: "检查模型链",
    primaryHref: "/admin/ai-models",
    secondaryLabel: "查看调用指标",
    secondaryHref: "/admin/ai-models"
  },
  {
    title: "内容治理",
    status: "质量安全优先",
    signal: "教材、题库或知识点结构需要修订，避免错误内容进入教学链路。",
    consequence: "当发布与恢复无阻断时，优先处理内容质量和治理安全，保证教师和学生看到的内容可信可教。",
    primaryLabel: "进入内容治理",
    primaryHref: "/library",
    secondaryLabel: "查看题库治理",
    secondaryHref: "/admin/questions"
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
      subtitle="先判断今天影响最大的是发布风险、恢复工单、模型链，还是内容治理，再进入对应处置入口。"
      chips={[<span className="chip" key="admin-role">管理端</span>, <span className="chip" key="admin-mode">行动优先</span>]}
      actions={
        <>
          <Link className="button primary" href="/admin/launch-readiness">
            查看上线准备
          </Link>
          <Link className="button secondary" href="/admin/recovery-requests">
            查看恢复工单台
          </Link>
        </>
      }
    >
      <StatePanel
        compact
        tone="info"
        title="今日优先：先选一类治理动作，再进入对应处置台"
        description="如果今天影响上线、账号进入、模型稳定性或内容安全，就先处理这四类动作。其余配置、趋势和实验能力放到下方辅助区。"
        action={
          <Link className="button secondary" href="/admin/launch-readiness">
            从发布阻断开始
          </Link>
        }
      />

      <section className="admin-ops-grid" aria-label="管理端首屏行动">
        <Card title="今天先处理哪一类动作" tag="优先行动" className="admin-priority-card">
          <ol className="admin-priority-list" aria-label="管理员今日优先行动">
            {priorityActions.map((item) => (
              <li key={item.title} className="admin-priority-item">
                <div className="admin-priority-item-head">
                  <div>
                    <div className="admin-priority-title">{item.title}</div>
                    <div className="admin-priority-consequence">
                      <strong>先看什么信号：</strong>
                      {item.signal}
                    </div>
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

        <Card title="如何判断先做哪件事" tag="首屏判断">
          <div className="admin-status-stack" aria-live="polite">
            <div className="admin-status-row">
              <span>先看发布风险</span>
              <strong>当 readiness 出现阻断或降级项</strong>
            </div>
            <div className="admin-status-row">
              <span>先看恢复工单</span>
              <strong>当用户无法进入平台或找回账号</strong>
            </div>
            <div className="admin-status-row">
              <span>先看模型链</span>
              <strong>当教学生成质量、延迟或降级不稳定</strong>
            </div>
            <div className="admin-status-row">
              <span>先看内容治理</span>
              <strong>当教材、题目或知识点需要纠偏</strong>
            </div>
          </div>
        </Card>
      </section>

      <section className="grid" style={{ gap: 14 }} aria-labelledby="admin-content-governance-title">
        <div className="section-head compact">
          <div>
            <h3 id="admin-content-governance-title">内容治理</h3>
            <div className="section-sub">当发布、恢复和模型链没有阻断时，在这里继续修教材、题库和知识点结构。</div>
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

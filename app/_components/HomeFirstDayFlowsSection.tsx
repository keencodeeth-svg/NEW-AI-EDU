import Link from "next/link";
import Card from "@/components/Card";
import type { FirstDayFlow } from "../home.types";

export function HomeFirstDayFlowsSection({ firstDayFlows }: { firstDayFlows: FirstDayFlow[] }) {
  return (
    <section className="home-section-stack">
      <div className="section-head">
        <div>
          <h2>首日上手路径</h2>
          <div className="section-sub">不讲空话，直接告诉新用户第一天如何把系统真正跑起来。</div>
        </div>
        <span className="chip">Onboarding</span>
      </div>
      <div className="home-flow-grid">
        {firstDayFlows.map((flow) => (
          <Card
            key={flow.id}
            title={flow.roleLabel}
            tag={flow.tag}
            className="home-flow-card"
            bodyClassName="home-flow-card-body"
          >
            <div className="home-flow-steps">
              {flow.steps.map((step, index) => (
                <div className="home-flow-step" key={`${flow.id}-${step.title}`}>
                  <span className="home-flow-step-index">{index + 1}</span>
                  <div className="home-flow-step-title">{step.title}</div>
                  <div className="home-flow-step-desc">{step.description}</div>
                </div>
              ))}
            </div>
            <Link className="button secondary" href={flow.href}>
              查看该角色页面
            </Link>
          </Card>
        ))}
      </div>
    </section>
  );
}

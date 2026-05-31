import Link from "next/link";
import Card from "@/components/Card";
import { CLASSROOM_PRODUCT_NAME } from "@/lib/classroom-integration";
import { HomeDifferentiatorsSection } from "./_components/HomeDifferentiatorsSection";
import { HomeFirstDayFlowsSection } from "./_components/HomeFirstDayFlowsSection";
import { HomeHeroSection } from "./_components/HomeHeroSection";
import { HomeRoleLaunchSection } from "./_components/HomeRoleLaunchSection";
import {
  CAPABILITY_BLOCKS,
  DIFFERENTIATORS,
  FIRST_DAY_FLOWS,
  FIRST_LOOK_ITEMS,
  HERO_PILLS,
  PRODUCT_STATUS_METRICS,
  ROLE_LAUNCH_CARDS
} from "./home.data";

export default function Home() {
  return (
    <div className="grid home-shell">
      <HomeHeroSection pills={HERO_PILLS} productStatusMetrics={PRODUCT_STATUS_METRICS} firstLookItems={FIRST_LOOK_ITEMS} />

      <HomeRoleLaunchSection roleLaunchCards={ROLE_LAUNCH_CARDS} />

      <section className="home-section-stack">
        <div className="section-head">
          <div>
            <h2>{CLASSROOM_PRODUCT_NAME}作为课堂次入口，承接课前、课中与课后闭环</h2>
            <div className="section-sub">当用户已经明确要备课、开课、整班观看或课后回看时，再进入课堂主线，避免首页第一屏把课堂与平台主入口并列成两个主目标。</div>
          </div>
          <span className="chip">课堂产品线</span>
        </div>
        <Card
          title={CLASSROOM_PRODUCT_NAME}
          tag="学习闭环"
          bodyClassName="home-classroom-callout"
        >
          <div className="home-classroom-callout-copy">
            <h3 className="home-classroom-callout-title">当目标是“上这一节课”，课堂入口会把准备、发布、观看与回看收束到同一条链路</h3>
            <p>
              教材解析、课堂大纲、场景编排、教师讲解形象、全班观看发布与导出都围绕同一条课堂主线组织，
              同时继续回流到教师教学台、学生自主学习和学校质量视图中。
            </p>
            <div className="badge-row">
              <span className="badge">讲义转课堂</span>
              <span className="badge">真实班级角色互动</span>
              <span className="badge">教师数字人</span>
              <span className="badge">整班观看与导出</span>
            </div>
            <div className="cta-row" style={{ flexWrap: "wrap" }}>
              <Link className="button primary" href="/ai-classroom">
                进入{CLASSROOM_PRODUCT_NAME}
              </Link>
              <Link className="button secondary" href="/student/interactive-classroom">
                学生自主学习模式
              </Link>
            </div>
          </div>
          <div className="home-classroom-callout-side">
            <div className="home-classroom-brief">
              <div className="home-classroom-brief-label">课堂来源</div>
              <div className="home-classroom-brief-value">教师授课、学生自学、兴趣探索、复习巩固和预习都能共用同一课堂引擎。</div>
            </div>
            <div className="home-classroom-brief">
              <div className="home-classroom-brief-label">课堂分发</div>
              <div className="home-classroom-brief-value">备课开课、整班观看、课堂回看、导出留存和学校质量视图全部打通。</div>
            </div>
            <div className="home-classroom-brief">
              <div className="home-classroom-brief-label">身份兼容</div>
              <div className="home-classroom-brief-value">教师、学生、家长和学校管理者看到各自最需要的学习与教学下一步。</div>
            </div>
          </div>
        </Card>
      </section>

      <details className="workflow-collapsible" open>
        <summary>
          <span>展开首日上手路径</span>
          <span className="chip">学生 / 教师 / 家长 / 学校四类快速上手</span>
        </summary>
        <div className="workflow-collapsible-body">
          <HomeFirstDayFlowsSection firstDayFlows={FIRST_DAY_FLOWS} />
        </div>
      </details>

      <details className="workflow-collapsible">
        <summary>
          <span>展开产品差异与完整能力图谱</span>
          <span className="chip">为什么不一样 · 能力全景</span>
        </summary>
        <div className="workflow-collapsible-body">
          <HomeDifferentiatorsSection differentiators={DIFFERENTIATORS} capabilityBlocks={CAPABILITY_BLOCKS} />
        </div>
      </details>
    </div>
  );
}

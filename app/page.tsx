import Link from "next/link";
import Card from "@/components/Card";
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
            <h2>航科互动课堂已经成为平台主能力</h2>
            <div className="section-sub">上传讲义、绑定班级、生成真实教师与学生参与的互动课堂，并继续回流到教学、学习与治理业务中。</div>
          </div>
          <span className="chip">航科原生融合</span>
        </div>
        <Card
          title="航科互动课堂引擎"
          tag="平台融合"
          bodyClassName="home-classroom-callout"
        >
          <div className="home-classroom-callout-copy">
            <h3 className="home-classroom-callout-title">从一节课的生成，到课堂交付、整班观看、回看与导出，全部走同一条真实教学链路</h3>
            <p>
              现在可以直接在统一项目里进入航科互动课堂，完成教材解析、课堂大纲生成、场景编排、数字人讲解、全班观看发布与导出，
              同时继续回流到教师工作台、学生自学和学校治理链路中。
            </p>
            <div className="badge-row">
              <span className="badge">讲义转课堂</span>
              <span className="badge">真实班级角色互动</span>
              <span className="badge">教师数字人</span>
              <span className="badge">整班观看与导出</span>
            </div>
            <div className="cta-row" style={{ flexWrap: "wrap" }}>
              <Link className="button primary" href="/ai-classroom">
                进入航科互动课堂
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
              <div className="home-classroom-brief-value">工作区开课、整班观看、课堂回看、导出留存和学校治理链路全部打通。</div>
            </div>
            <div className="home-classroom-brief">
              <div className="home-classroom-brief-label">身份兼容</div>
              <div className="home-classroom-brief-value">教师、学生、家长、学校后台与统一 API 配置由同一平台能力托底。</div>
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

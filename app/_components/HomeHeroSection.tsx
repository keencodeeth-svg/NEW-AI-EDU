import Link from "next/link";
import type { FirstLookItem, ProductStatusMetric } from "../home.types";

export function HomeHeroSection({
  pills,
  productStatusMetrics,
  firstLookItems
}: {
  pills: string[];
  productStatusMetrics: ProductStatusMetric[];
  firstLookItems: FirstLookItem[];
}) {
  return (
    <section className="hero hero-stage home-hero-grid">
      <div className="home-hero-copy">
        <div className="home-eyebrow">航科 AI 教育 · 全角色一体化教育工作台</div>
        <h1 className="home-hero-title">把学习、教学、陪伴与治理，组织成真正可执行的教育主线</h1>
        <p className="home-hero-description">
          不是再加一个 AI 功能入口，而是把学生、教师、家长和学校每天最关键的下一步，放进同一套产品节奏里。
          从互动课堂、数字人授课，到作业、回执、治理与排课，整套体验围绕真实教育场景设计。
        </p>
        <div className="home-hero-actions">
          <Link className="button primary" href="/login?role=student&entry=landing">
            立即进入平台
          </Link>
          <Link className="button secondary" href="/ai-classroom">
            体验航科互动课堂
          </Link>
        </div>
        <div className="pill-list home-trust-strip">
          {pills.map((pill) => (
            <span key={pill} className="pill">
              {pill}
            </span>
          ))}
        </div>
      </div>

      <div className="home-stage-panel">
        <div className="home-stage-head">
          <div>
            <p className="home-stage-kicker">从第一屏开始</p>
            <h2 className="home-stage-title">用户不是在找功能，而是被带到最对的主线入口</h2>
          </div>
          <span className="chip">World-class UX</span>
        </div>

        <div className="home-stage-grid">
          {productStatusMetrics.map((item) => (
            <div key={item.label} className="home-status-tile">
              <span className="home-status-label">{item.label}</span>
              <div className="home-status-value">{item.value}</div>
              <div className="home-status-helper">{item.helper}</div>
            </div>
          ))}
        </div>

        <div className="home-firstlook-list">
          {firstLookItems.map((item) => (
            <div key={item.title} className="home-firstlook-card">
              <div className="home-firstlook-card-title">{item.title}</div>
              <p>{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

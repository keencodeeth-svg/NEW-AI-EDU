import Link from "next/link";
import {
  CLASSROOM_PRODUCT_NAME,
  PLATFORM_BRAND_NAME,
  PLATFORM_BRAND_TAGLINE,
} from "@/lib/classroom-integration";
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
        <div className="home-eyebrow">{PLATFORM_BRAND_NAME} · 多角色学习与教学操作系统</div>
        <h1 className="home-hero-title">让学习、教学与陪伴，都有清晰下一步</h1>
        <p className="home-hero-description">
          {PLATFORM_BRAND_TAGLINE}
          先把学生今天该推进的动作讲清楚，再把教师、家长和学校带到各自的执行主线。
        </p>
        <div className="home-hero-actions">
          <Link className="button primary" href="/login?role=student&entry=landing">
            以学生身份开始
          </Link>
          <Link className="button secondary" href="/ai-classroom">
            课堂入口：进入{CLASSROOM_PRODUCT_NAME}
          </Link>
        </div>
        <div className="home-hero-support">
          <div className="home-hero-support-title">如果你是教师、家长或学校管理员</div>
          <p>先用学生主入口理解平台主线，再在下方按身份进入对应工作台，不需要在第一屏完成全部选择。</p>
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
            <p className="home-stage-kicker">第一屏优先级</p>
            <h2 className="home-stage-title">先让用户知道现在该做什么，再决定要不要进入课堂或角色工作台</h2>
          </div>
          <span className="chip">清晰下一步</span>
        </div>

        <div className="home-stage-summary">
          <div className="home-stage-priority">
            <span className="home-stage-priority-label">主目标</span>
            <div className="home-stage-priority-value">进入平台并开始今天的学习动作</div>
            <p>把第一步集中到一个主 CTA，避免用户在首页同时面对角色选择、课堂入口和全量功能概览。</p>
          </div>
          <div className="home-stage-priority">
            <span className="home-stage-priority-label">次入口</span>
            <div className="home-stage-priority-value">知序课堂作为明确的课堂入口</div>
            <p>当用户已经知道自己要开课、看课或发布课堂时，再进入课堂产品线，不在第一屏抢主目标。</p>
          </div>
        </div>

        <div className="home-stage-grid" aria-label="角色工作台概览">
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

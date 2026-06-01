import Link from "next/link";
import {
  CLASSROOM_PRODUCT_NAME,
  PLATFORM_BRAND_NAME,
  PLATFORM_BRAND_TAGLINE,
} from "@/lib/classroom-integration";
import type { FirstLookItem, ProductStatusMetric } from "../home.types";

const HERO_ROLE_ENTRY_LINKS = [
  {
    label: "学生登录",
    href: "/login?role=student&entry=landing",
    helper: "今日学习、练习、课堂与成长记录"
  },
  {
    label: "教师登录",
    href: "/login?role=teacher&entry=landing",
    helper: "备课、课堂发布、作业与学情"
  },
  {
    label: "家长登录",
    href: "/login?role=parent&entry=landing",
    helper: "今晚陪伴动作与家校回执"
  },
  {
    label: "学校登录",
    href: "/login?role=school_admin&entry=landing",
    helper: "课表预演、班级和课堂质量"
  }
];

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
        <h1 className="home-hero-title">学生、教师、家长与学校都从这里进入各自主线</h1>
        <p className="home-hero-description">
          {PLATFORM_BRAND_TAGLINE}
          这是面向学生、教师、家长与学校的可信入口：学生进入今日学习主线，教师进入教学执行面板，家长进入今晚陪伴动作，学校进入课堂质量与组织视图。
        </p>
        <div className="home-hero-actions">
          <Link className="button primary" href="/login?role=student&entry=landing">
            学生登录
          </Link>
          <Link className="button secondary" href="/login?role=teacher&entry=landing">
            教师登录
          </Link>
          <Link className="button secondary" href="/ai-classroom">
            课堂入口：进入{CLASSROOM_PRODUCT_NAME}
          </Link>
        </div>
        <div className="home-hero-support">
          <div>
            <div className="home-hero-support-title">按身份直接进入自己的工作台</div>
            <p>不需要先按学生路径理解平台，再切换到教师、家长或学校角色。</p>
          </div>
          <div className="home-hero-role-links" aria-label="学生、教师、家长和学校快速入口">
            {HERO_ROLE_ENTRY_LINKS.map((item) => (
              <Link key={item.label} className="home-hero-role-link" href={item.href}>
                <span>{item.label}</span>
                <small>{item.helper}</small>
              </Link>
            ))}
          </div>
          <Link className="home-hero-recovery-link" href="/recover?role=student&entry=landing">
            忘记密码或账号异常？提交恢复请求
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
            <p className="home-stage-kicker">第一屏优先级</p>
            <h2 className="home-stage-title">先按角色进入执行主线，再决定是否进入课堂或更深功能</h2>
          </div>
          <span className="chip">清晰下一步</span>
        </div>

        <div className="home-stage-summary">
          <div className="home-stage-priority">
            <span className="home-stage-priority-label">主目标</span>
            <div className="home-stage-priority-value">按身份进入今天的执行主线</div>
            <p>学生、教师、家长、学校和管理员都能从首屏直达自己的入口，不需要借用其他角色路径。</p>
          </div>
          <div className="home-stage-priority">
            <span className="home-stage-priority-label">次入口</span>
            <div className="home-stage-priority-value">航科互动课堂作为明确的课堂入口</div>
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

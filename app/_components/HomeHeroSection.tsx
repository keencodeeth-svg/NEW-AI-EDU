import Link from "next/link";
import {
  CLASSROOM_PRODUCT_NAME,
  PLATFORM_BRAND_NAME,
  PLATFORM_BRAND_TAGLINE,
} from "@/lib/classroom-integration";
import type { FirstLookItem, ProductStatusMetric } from "../home.types";

const HERO_ROLE_ENTRY_LINKS = [
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
  },
  {
    label: "管理登录",
    href: "/login?role=admin&entry=landing",
    helper: "内容、模型、发布与恢复工单"
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
        <h1 className="home-hero-title">让学习、教学与陪伴，都有清晰下一步</h1>
        <p className="home-hero-description">
          {PLATFORM_BRAND_TAGLINE}
          学生、教师、家长和学校都可以从这里直接进入自己的工作主线：学生开始今天的学习，教师进入备课与课堂，家长查看今晚陪伴动作，学校跟进课堂质量。
        </p>
        <div className="home-hero-actions">
          <Link className="button primary" href="/login?role=student&entry=landing">
            学生登录
          </Link>
          <Link className="button secondary" href="/register?role=student&entry=landing">
            学生注册
          </Link>
          <Link className="button secondary" href="/ai-classroom">
            课堂入口：进入{CLASSROOM_PRODUCT_NAME}
          </Link>
        </div>
        <div className="home-hero-support">
          <div>
            <div className="home-hero-support-title">按身份直接进入自己的工作台</div>
            <p>每个角色都有独立登录与注册路径，不需要先走学生入口理解平台。</p>
          </div>
          <div className="home-hero-role-links" aria-label="教师、家长、学校和管理员快速入口">
            {HERO_ROLE_ENTRY_LINKS.map((item) => (
              <Link key={item.label} className="home-hero-role-link" href={item.href}>
                <span>{item.label}</span>
                <small>{item.helper}</small>
              </Link>
            ))}
          </div>
          <Link className="home-hero-recovery-link" href="/recover?entry=landing">
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
            <h2 className="home-stage-title">先让用户知道现在该做什么，再决定要不要进入课堂或角色工作台</h2>
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

import Link from "next/link";
import type { RoleLaunchCard } from "../home.types";

export function HomeRoleLaunchSection({ roleLaunchCards }: { roleLaunchCards: RoleLaunchCard[] }) {
  return (
    <section className="home-section-stack">
      <div className="section-head">
        <div>
          <h2>按身份直接进入最合适的工作台</h2>
          <div className="section-sub">少做选择题，按角色直接进入最适合当前目标的产品路径。</div>
        </div>
        <span className="chip">Role-first</span>
      </div>
      <div className="home-role-grid">
        {roleLaunchCards.map((item, index) => (
          <article key={item.id} className={`home-role-card home-role-card--${item.id}`}>
            <div className="home-role-top">
              <span className="home-role-index">{String(index + 1).padStart(2, "0")}</span>
              <span className="card-tag">{item.tag}</span>
            </div>
            <div className="home-role-copy">
              <h3>{item.title}</h3>
              <p>{item.subtitle}</p>
            </div>
            <div className="badge-row home-role-highlights">
              {item.highlights.map((highlight) => (
                <span className="badge" key={`${item.id}-${highlight}`}>
                  {highlight}
                </span>
              ))}
            </div>
            <div className="home-role-actions">
              <Link className="button primary" href={item.primaryHref}>
                {item.primaryLabel}
              </Link>
              {item.secondaryHref && item.secondaryLabel ? (
                <Link className="button ghost" href={item.secondaryHref}>
                  {item.secondaryLabel}
                </Link>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

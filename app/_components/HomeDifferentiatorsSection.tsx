import Link from "next/link";
import Card from "@/components/Card";
import EduIcon from "@/components/EduIcon";
import type { CapabilityBlock, Differentiator } from "../home.types";

export function HomeDifferentiatorsSection({
  differentiators,
  capabilityBlocks
}: {
  differentiators: Differentiator[];
  capabilityBlocks: CapabilityBlock[];
}) {
  return (
    <section className="home-differ-grid">
      <Card title="为什么这套产品不一样" tag="教育闭环" className="home-differ-card">
        <div className="home-value-list">
          {differentiators.map((item) => (
            <div key={item.title} className="home-value-card">
              <div className="section-title">{item.title}</div>
              <p className="meta-text">{item.description}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card title="核心能力总览" tag="Capabilities" className="home-differ-card">
        <div className="home-capability-list">
          {capabilityBlocks.map((item) => (
            <Link key={item.title} href={item.href} className="home-capability-card">
              <div className="feature-card" style={{ alignItems: "flex-start" }}>
                <EduIcon name={item.icon} />
                <div>
                  <div className="section-title">{item.title}</div>
                  <div className="meta-text" style={{ marginTop: 6, lineHeight: 1.7 }}>
                    {item.description}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </Card>
    </section>
  );
}

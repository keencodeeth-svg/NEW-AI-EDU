"use client";

import Link from "next/link";
import Card from "@/components/Card";
import EduIcon from "@/components/EduIcon";

export default function WritingPage() {
  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="section-head">
        <div>
          <h2>写作批改已合并</h2>
          <div className="section-sub">作文/主观题已并入作业批改流程。</div>
        </div>
        <span className="chip">更新</span>
      </div>

      <Card title="新的作业批改入口" tag="作业">
        <div className="feature-card">
          <EduIcon name="pencil" />
          <p>请在作业中心提交作文或上传作业图片，老师与 AI 将统一批改。</p>
        </div>
        <Link className="button primary" href="/student/assignments" style={{ marginTop: 12 }}>
          前往作业中心
        </Link>
      </Card>
    </div>
  );
}

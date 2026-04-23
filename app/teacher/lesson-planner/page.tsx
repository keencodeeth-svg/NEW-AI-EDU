"use client";

import Card from "@/components/Card";
import { useLessonPlannerPage } from "./useLessonPlannerPage";

export default function TeacherLessonPlannerPage() {
  const page = useLessonPlannerPage();

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="section-head">
        <div>
          <h2>AI 备课助手</h2>
          <div className="section-sub">围绕真实班级学情，生成错误预测、互动设计、分层作业和课后反思提示。</div>
        </div>
        <span className="chip">教师工具</span>
      </div>

      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <Card title="输入本节课主题" tag="Plan">
          <div style={{ display: "grid", gap: 12 }}>
            <label style={{ display: "grid", gap: 8 }}>
              <div className="section-title">班级</div>
              <select
                value={page.classId}
                onChange={(event) => page.setClassId(event.target.value)}
                style={{ width: "100%", padding: 12, borderRadius: 14, border: "1px solid var(--stroke)" }}
              >
                <option value="">不绑定班级，生成通用方案</option>
                {page.classes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} · {item.subject} · {item.grade} 年级
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-2">
              <label style={{ display: "grid", gap: 8 }}>
                <div className="section-title">学科</div>
                <input
                  value={page.subject}
                  onChange={(event) => page.setSubject(event.target.value)}
                  style={{ width: "100%", padding: 12, borderRadius: 14, border: "1px solid var(--stroke)" }}
                />
              </label>
              <label style={{ display: "grid", gap: 8 }}>
                <div className="section-title">年级</div>
                <input
                  value={page.grade}
                  onChange={(event) => page.setGrade(event.target.value)}
                  style={{ width: "100%", padding: 12, borderRadius: 14, border: "1px solid var(--stroke)" }}
                />
              </label>
            </div>
            <label style={{ display: "grid", gap: 8 }}>
              <div className="section-title">主题</div>
              <input
                value={page.topic}
                onChange={(event) => page.setTopic(event.target.value)}
                placeholder="例如：分数加减法中的异分母通分"
                style={{ width: "100%", padding: 12, borderRadius: 14, border: "1px solid var(--stroke)" }}
              />
            </label>
            <div className="cta-row">
              <button
                className="button primary"
                type="button"
                disabled={!page.topic.trim() || page.loading}
                onClick={() => {
                  void page.generatePlan();
                }}
              >
                {page.loading ? "生成中..." : "生成备课方案"}
              </button>
            </div>
            {page.error ? <div className="status-note error">{page.error}</div> : null}
          </div>
        </Card>

        <Card title="如何使用这份方案" tag="Flow">
          <div style={{ display: "grid", gap: 10, color: "var(--ink-1)" }}>
            <div>1. 先看错误预测，预先准备提问或板书提醒。</div>
            <div>2. 课堂中直接拿互动设计去用，不必再临场想活动。</div>
            <div>3. 下课前把分层作业一键转成差异化作业发布。</div>
            <div>4. 课后用教学反思提示快速复盘这一节课是否真正打中了问题。</div>
          </div>
        </Card>
      </div>

      {page.result ? (
        <div className="grid grid-2" style={{ alignItems: "start" }}>
          <Card title="常见错误预测" tag="Misconception">
            <div style={{ display: "grid", gap: 10 }}>
              {page.result.commonMistakes.map((item) => (
                <div key={item} className="status-note info">
                  {item}
                </div>
              ))}
            </div>
          </Card>
          <Card title="课堂互动设计" tag="Interaction">
            <div style={{ display: "grid", gap: 10 }}>
              {page.result.interactionIdeas.map((item) => (
                <div key={item} className="status-note success">
                  {item}
                </div>
              ))}
            </div>
          </Card>
          <Card title="班级学情摘要" tag="Data">
            <div style={{ display: "grid", gap: 10 }}>
              {page.result.classMasteryStats?.length ? (
                page.result.classMasteryStats.map((item) => (
                  <div key={item} className="status-note info">
                    {item}
                  </div>
                ))
              ) : (
                <div className="status-note info">当前未绑定班级或学情样本不足，已生成稳健的通用策略。</div>
              )}
            </div>
          </Card>
          <Card title="分层作业建议" tag="Tiered">
            <div style={{ display: "grid", gap: 10 }}>
              <div>
                <div className="badge">基础巩固</div>
                {page.result.tieredAssignments.easy.map((item) => (
                  <div key={item} style={{ marginTop: 6, color: "var(--ink-1)" }}>
                    {item}
                  </div>
                ))}
              </div>
              <div>
                <div className="badge">常规提升</div>
                {page.result.tieredAssignments.medium.map((item) => (
                  <div key={item} style={{ marginTop: 6, color: "var(--ink-1)" }}>
                    {item}
                  </div>
                ))}
              </div>
              <div>
                <div className="badge">迁移挑战</div>
                {page.result.tieredAssignments.hard.map((item) => (
                  <div key={item} style={{ marginTop: 6, color: "var(--ink-1)" }}>
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </Card>
          <Card title="教学反思提示" tag="Reflect">
            <div className="status-note info">{page.result.reflectionReport}</div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

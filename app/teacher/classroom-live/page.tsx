"use client";

import Card from "@/components/Card";
import { useClassroomLivePage } from "./useClassroomLivePage";

export default function TeacherClassroomLivePage() {
  const page = useClassroomLivePage();

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="section-head">
        <div>
          <h2>课堂实时仪表盘</h2>
          <div className="section-sub">发起课堂练习后，实时查看作答人数、正确率与响应节奏，并一键推进下一题。</div>
        </div>
        <span className="chip">10 秒轮询</span>
      </div>

      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <Card title="发起课堂练习" tag="Live">
          <div style={{ display: "grid", gap: 12 }}>
            <label style={{ display: "grid", gap: 8 }}>
              <div className="section-title">班级</div>
              <select
                value={page.classId}
                onChange={(event) => page.setClassId(event.target.value)}
                style={{ width: "100%", padding: 12, borderRadius: 14, border: "1px solid var(--stroke)" }}
              >
                {page.classes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} · {item.subject} · {item.grade} 年级
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: "grid", gap: 8 }}>
              <div className="section-title">会话标题</div>
              <input
                value={page.title}
                onChange={(event) => page.setTitle(event.target.value)}
                style={{ width: "100%", padding: 12, borderRadius: 14, border: "1px solid var(--stroke)" }}
              />
            </label>
            <div className="cta-row">
              <button className="button primary" type="button" disabled={!page.classId || page.loading} onClick={() => void page.createSession()}>
                {page.loading ? "处理中..." : "发起课堂练习"}
              </button>
            </div>
          </div>
        </Card>

        <Card title="当前会话" tag="Session">
          <div style={{ display: "grid", gap: 12 }}>
            <label style={{ display: "grid", gap: 8 }}>
              <div className="section-title">选择会话</div>
              <select
                value={page.selectedSessionId}
                onChange={(event) => page.setSelectedSessionId(event.target.value)}
                style={{ width: "100%", padding: 12, borderRadius: 14, border: "1px solid var(--stroke)" }}
              >
                <option value="">请选择</option>
                {page.sessions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title} · {item.status === "active" ? "进行中" : "已结束"}
                  </option>
                ))}
              </select>
            </label>
            {page.selectedSession ? (
              <>
                <div className="status-note info">{page.selectedSession.currentPrompt}</div>
                <div className="cta-row">
                  <button className="button secondary" type="button" disabled={page.loading} onClick={() => void page.pushNextPrompt()}>
                    推进到下一题
                  </button>
                </div>
              </>
            ) : (
              <div className="status-note info">先创建一个课堂练习会话，实时数据就会在这里开始刷新。</div>
            )}
          </div>
        </Card>
      </div>

      {page.error ? <div className="status-note error">{page.error}</div> : null}

      {page.snapshot ? (
        <div className="grid grid-2" style={{ alignItems: "start" }}>
          <Card title="实时概览" tag="Snapshot">
            <div className="workflow-summary-grid">
              <div className="workflow-summary-card">
                <div className="workflow-summary-label">已作答 / 总人数</div>
                <div className="workflow-summary-value">
                  {page.snapshot.totalAnswered}/{page.snapshot.totalStudents}
                </div>
              </div>
              <div className="workflow-summary-card">
                <div className="workflow-summary-label">当前正确率</div>
                <div className="workflow-summary-value">{page.snapshot.accuracy}%</div>
              </div>
            </div>
          </Card>
          <Card title="最快完成" tag="Fast">
            <div style={{ display: "grid", gap: 8 }}>
              {page.snapshot.fastestStudents.length ? (
                page.snapshot.fastestStudents.map((item) => (
                  <div key={item.studentId} className="status-note success">
                    {item.studentName} · 已完成 {item.total} 次作答
                  </div>
                ))
              ) : (
                <div className="status-note info">还没有学生开始作答。</div>
              )}
            </div>
          </Card>
          <Card title="需要关注" tag="Slow">
            <div style={{ display: "grid", gap: 8 }}>
              {page.snapshot.slowestStudents.length ? (
                page.snapshot.slowestStudents.map((item) => (
                  <div key={item.studentId} className="status-note info">
                    {item.studentName} · 当前记录 {item.total} 次
                  </div>
                ))
              ) : (
                <div className="status-note info">当前暂无需要重点提醒的学生。</div>
              )}
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

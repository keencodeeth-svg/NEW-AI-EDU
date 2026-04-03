"use client";

import Link from "next/link";
import StatePanel from "@/components/StatePanel";
import StudentExamArchiveCard from "./_components/StudentExamArchiveCard";
import StudentExamKpiGrid from "./_components/StudentExamKpiGrid";
import StudentExamSectionCard from "./_components/StudentExamSectionCard";
import StudentSelfAssessmentIntroCard from "./_components/StudentSelfAssessmentIntroCard";
import StudentSelfAssessmentTasksCard from "./_components/StudentSelfAssessmentTasksCard";
import { useStudentExamsPage } from "./useStudentExamsPage";

export default function StudentExamsPage() {
  const {
    loading,
    refreshing,
    pageError,
    examError,
    todayTasksError,
    authRequired,
    moduleTab,
    showPastExams,
    shouldPromoteExamArchive,
    grouped,
    visibleSelfAssessmentTasks,
    selfAssessmentTasks,
    selfAssessmentSummary,
    examCount,
    hasAnyData,
    hasFatalError,
    lastLoadedAtLabel,
    loadPage,
    setModuleTab,
    setShowPastExams
  } = useStudentExamsPage();
  const summaryItems = [
    {
      label: "考试总数",
      value: String(examCount),
      helper: "老师发布的全部考试",
    },
    {
      label: "当前开放",
      value: String(grouped.ongoing.length),
      helper: `${grouped.upcoming.length} 场即将开始`,
    },
    {
      label: "已完成",
      value: String(grouped.finished.length),
      helper: `${grouped.locked.length} 场已截止或关闭`,
    },
    {
      label: "自主测评",
      value: String(selfAssessmentSummary.total),
      helper: `必须完成 ${selfAssessmentSummary.mustDo} 项`,
    },
  ];
  const teacherExamSummary = [
    grouped.ongoing.length ? `进行中 ${grouped.ongoing.length}` : null,
    grouped.upcoming.length ? `待开始 ${grouped.upcoming.length}` : null,
    grouped.finished.length + grouped.locked.length
      ? `历史 ${grouped.finished.length + grouped.locked.length}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const selfAssessmentLabel = [
    selfAssessmentSummary.total ? `任务 ${selfAssessmentSummary.total}` : null,
    selfAssessmentSummary.mustDo ? `必做 ${selfAssessmentSummary.mustDo}` : null,
    selfAssessmentSummary.highPriority ? `高优先 ${selfAssessmentSummary.highPriority}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  if (loading && !hasAnyData && !authRequired) {
    return (
      <StatePanel title="在线考试加载中" description="正在同步考试安排与今日自主测评任务。" tone="loading" />
    );
  }

  if (authRequired) {
    return (
      <StatePanel
        title="请先登录学生账号"
        description="登录后即可查看老师发布考试和今日自主测评任务。"
        tone="info"
        action={
          <Link className="button secondary" href="/login">
            前往登录
          </Link>
        }
      />
    );
  }

  if (hasFatalError) {
    return (
      <StatePanel
        title="在线考试加载失败"
        description={pageError ?? "当前无法同步考试与自主测评任务，请稍后重试。"}
        tone="error"
        action={
          <button className="button secondary" type="button" onClick={() => void loadPage()}>
            重新加载
          </button>
        }
      />
    );
  }

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="section-head">
        <div>
          <h2>在线考试</h2>
          <div className="section-sub">老师发布考试与学生自主测评分模块管理，避免混淆。</div>
        </div>
        <div className="cta-row no-margin" style={{ justifyContent: "flex-end", flexWrap: "wrap" }}>
          <span className="chip">共 {examCount} 场考试</span>
          <span className="chip">开放中 {grouped.ongoing.length}</span>
          {lastLoadedAtLabel ? <span className="chip">更新于 {lastLoadedAtLabel}</span> : null}
          <button className="button secondary" type="button" onClick={() => void loadPage("refresh")} disabled={loading || refreshing}>
            {refreshing ? "刷新中..." : "刷新"}
          </button>
        </div>
      </div>

      {pageError ? (
        <StatePanel
          title="已展示最近一次成功数据"
          description={`最新刷新失败：${pageError}`}
          tone="error"
          compact
          action={
            <button className="button secondary" type="button" onClick={() => void loadPage("refresh")} disabled={refreshing}>
              再试一次
            </button>
          }
        />
      ) : null}

      <div className="workflow-summary-grid">
        {summaryItems.map((item) => (
          <div key={item.label} className="workflow-summary-card">
            <div className="workflow-summary-label">{item.label}</div>
            <div className="workflow-summary-value">{item.value}</div>
            <div className="workflow-summary-helper">{item.helper}</div>
          </div>
        ))}
      </div>

      <div className="cta-row exams-module-switch" style={{ marginTop: 0 }}>
        <button
          className={moduleTab === "teacher_exam" ? "button secondary" : "button ghost"}
          type="button"
          onClick={() => setModuleTab("teacher_exam")}
        >
          老师发布考试
        </button>
        <button
          className={moduleTab === "self_assessment" ? "button secondary" : "button ghost"}
          type="button"
          onClick={() => setModuleTab("self_assessment")}
        >
          学生自主测评
        </button>
      </div>

      {moduleTab === "teacher_exam" ? (
        examError && !examCount ? (
          <StatePanel
            title="考试列表暂时不可用"
            description={examError}
            tone="error"
            action={
              <button className="button secondary" type="button" onClick={() => void loadPage("refresh")} disabled={refreshing}>
                重试考试加载
              </button>
            }
          />
        ) : (
          <>
            <StudentExamKpiGrid
              ongoingCount={grouped.ongoing.length}
              upcomingCount={grouped.upcoming.length}
              finishedCount={grouped.finished.length}
            />
            <StudentExamSectionCard
              title="待进行"
              tag="考试"
              items={grouped.ongoing}
              emptyText="当前没有正在开放的考试。"
            />
            {shouldPromoteExamArchive ? (
              <div className="grid" style={{ gap: 16 }}>
                <div className="section-head" style={{ marginBottom: 0 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 18 }}>近期完成情况</h3>
                    <div className="section-sub">当前没有待开始考试，已将历史记录直接展开，方便快速回看成绩与复盘。</div>
                  </div>
                  <span className="chip">{teacherExamSummary || "历史归档"}</span>
                </div>
                <StudentExamArchiveCard
                  finished={grouped.finished}
                  locked={grouped.locked}
                  showPastExams={showPastExams}
                  onToggle={() => setShowPastExams((prev) => !prev)}
                />
              </div>
            ) : (
              <details className="workflow-collapsible">
                <summary>
                  <span>展开待开始与历史考试</span>
                  <span className="chip">{teacherExamSummary || "待开始 / 历史归档"}</span>
                </summary>
                <div className="workflow-collapsible-body">
                  <StudentExamSectionCard
                    title="即将开始"
                    tag="待开始"
                    items={grouped.upcoming}
                    emptyText="暂无即将开始的考试。"
                  />
                  <StudentExamArchiveCard
                    finished={grouped.finished}
                    locked={grouped.locked}
                    showPastExams={showPastExams}
                    onToggle={() => setShowPastExams((prev) => !prev)}
                  />
                </div>
              </details>
            )}
          </>
        )
      ) : null}

      {moduleTab === "self_assessment" ? (
        todayTasksError && !selfAssessmentTasks.length ? (
          <>
            <StudentSelfAssessmentIntroCard />
            <StatePanel
              title="自主测评任务暂时不可用"
              description={todayTasksError}
              tone="error"
              action={
                <button className="button secondary" type="button" onClick={() => void loadPage("refresh")} disabled={refreshing}>
                  重试任务加载
                </button>
              }
            />
          </>
        ) : (
          <>
            <StudentSelfAssessmentIntroCard />
            <details className="workflow-collapsible" open>
              <summary>
                <span>展开今日自主测评任务</span>
                <span className="chip">{selfAssessmentLabel || "诊断 / 练习 / 错题复练"}</span>
              </summary>
              <div className="workflow-collapsible-body">
                <StudentSelfAssessmentTasksCard tasks={visibleSelfAssessmentTasks} summary={selfAssessmentSummary} />
              </div>
            </details>
          </>
        )
      ) : null}
    </div>
  );
}

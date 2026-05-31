"use client";

import Link from "next/link";
import Card from "@/components/Card";
import StatePanel from "@/components/StatePanel";
import { buildLearningModeLabel } from "@/lib/classroom-integration";
import { SUBJECT_LABELS } from "@/lib/constants";
import { useStudentSelfStudyArtifacts } from "@/lib/hooks/use-student-self-study-artifacts";
import {
  buildStudentSelfStudyArtifactDetail,
  formatStudentSelfStudyArtifactTime
} from "@/lib/student-self-study-artifacts";
import StudentAssignmentsKpiGrid from "./_components/StudentAssignmentsKpiGrid";
import StudentAssignmentsListCard from "./_components/StudentAssignmentsListCard";
import { useStudentAssignmentsPageView } from "./useStudentAssignmentsPageView";

export default function StudentAssignmentsPage() {
  const assignmentsPage = useStudentAssignmentsPageView();
  const classroomArtifacts = useStudentSelfStudyArtifacts();
  const followUpArtifacts = classroomArtifacts.artifacts.filter(
    (artifact) =>
      artifact.learningMode === "subject-reinforcement" ||
      artifact.learningMode === "classroom-review"
  );
  const linkedArtifacts = (followUpArtifacts.length ? followUpArtifacts : classroomArtifacts.artifacts).slice(0, 2);

  if (assignmentsPage.authRequired) {
    return (
      <StatePanel
        tone="info"
        title="请先登录后查看作业"
        description="登录后即可查看老师布置的作业、截止日期和完成进度。"
        action={
          <Link className="button secondary" href="/login">
            去登录
          </Link>
        }
      />
    );
  }

  if (assignmentsPage.loading && assignmentsPage.assignments.length === 0) {
    return (
      <StatePanel
        tone="loading"
        title="作业中心加载中"
        description="正在同步老师布置的作业、截止日期和完成进度。"
      />
    );
  }

  if (assignmentsPage.error && assignmentsPage.assignments.length === 0) {
    return (
      <StatePanel
        tone="error"
        title="作业中心暂时不可用"
        description={assignmentsPage.error ?? undefined}
        action={
          <button className="button secondary" type="button" onClick={assignmentsPage.reload}>
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
          <h2>作业中心</h2>
          <div className="section-sub">查看作业进度、优先级与得分反馈，支持精细筛选与快速定位。</div>
        </div>
        <div className="workflow-toolbar">
          <span className="chip">{assignmentsPage.priorityAssignmentChipLabel}</span>
          <span className="chip">2 天内到期 {assignmentsPage.dueSoonCount} 份</span>
          {assignmentsPage.lastLoadedAtLabel ? <span className="chip">更新于 {assignmentsPage.lastLoadedAtLabel}</span> : null}
          <button
            className="button secondary"
            type="button"
            onClick={assignmentsPage.reload}
            disabled={assignmentsPage.loading || assignmentsPage.refreshing}
          >
            {assignmentsPage.refreshing ? "刷新中..." : "刷新"}
          </button>
        </div>
      </div>

      {assignmentsPage.error ? (
        <StatePanel
          compact
          tone="error"
          title="已展示最近一次成功数据"
          description={`最新刷新失败：${assignmentsPage.error}`}
          action={
            <button className="button secondary" type="button" onClick={assignmentsPage.reload}>
              再试一次
            </button>
          }
        />
      ) : null}

      <div className="workflow-card-meta">
        <span className="chip">总计 {assignmentsPage.assignments.length} 份</span>
        <span className="chip">{assignmentsPage.activeFilterSummary}</span>
      </div>

      <Card title="互动课堂作业闭环" tag="知序课堂">
        {linkedArtifacts.length ? (
          <div className="grid" style={{ gap: 12 }}>
            <p>
              最近 {linkedArtifacts.length} 节互动课堂已经可以直接服务作业消化。建议先回看讲解，再进入作业、错题复练或下一模式继续收口。
            </p>
            {linkedArtifacts.map((artifact) => {
              const subjectLabel = artifact.subject
                ? SUBJECT_LABELS[artifact.subject] ?? artifact.subject
                : "综合";

              return (
                <div className="card" key={artifact.stageId}>
                  <div className="cta-row no-margin" style={{ justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                    <div>
                      <div className="section-title">{artifact.topic || artifact.stageName}</div>
                      <p>{buildStudentSelfStudyArtifactDetail(artifact)}</p>
                    </div>
                    <div className="cta-row no-margin" style={{ gap: 8, flexWrap: "wrap" }}>
                      <span className="chip">{buildLearningModeLabel(artifact.learningMode)}</span>
                      <span className="chip">{subjectLabel}</span>
                    </div>
                  </div>
                  <p style={{ marginTop: 10 }}>
                    已生成 {artifact.sceneCount} 个课堂场景，最近更新于 {formatStudentSelfStudyArtifactTime(artifact.updatedAt)}。
                  </p>
                  <div className="cta-row" style={{ marginTop: 12, flexWrap: "wrap" }}>
                    <Link className="button secondary" href={artifact.stageHref}>
                      回到互动课堂
                    </Link>
                    <Link className="button secondary" href="/wrong-book">
                      进入错题复练
                    </Link>
                    <Link
                      className="button secondary"
                      href={artifact.followUpHref || "/student/interactive-classroom"}
                    >
                      {artifact.followUpMode
                        ? `切到${buildLearningModeLabel(artifact.followUpMode)}`
                        : "继续下一模式"}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid" style={{ gap: 12 }}>
            <p>先生成一节学科巩固或课堂回看互动课堂，再回来处理作业，会更容易把“听懂了”转成“做出来”。</p>
            <div className="cta-row no-margin" style={{ flexWrap: "wrap" }}>
              <Link className="button secondary" href="/student/interactive-classroom?mode=subject-reinforcement">
                去生成巩固课堂
              </Link>
            </div>
          </div>
        )}
      </Card>

      <StudentAssignmentsKpiGrid {...assignmentsPage.kpiGridProps} />

      <StudentAssignmentsListCard {...assignmentsPage.listCardProps} />
    </div>
  );
}

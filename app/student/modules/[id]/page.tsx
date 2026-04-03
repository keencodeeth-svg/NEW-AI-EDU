"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import StatePanel from "@/components/StatePanel";
import StudentModuleAssignmentsCard from "./_components/StudentModuleAssignmentsCard";
import StudentModuleOverviewCard from "./_components/StudentModuleOverviewCard";
import StudentModuleResourcesCard from "./_components/StudentModuleResourcesCard";
import StudentModuleStageBanner from "./_components/StudentModuleStageBanner";
import { useStudentModuleDetailPageView } from "./useStudentModuleDetailPageView";

export default function StudentModuleDetailPage() {
  const params = useParams<{ id: string }>();
  const modulePage = useStudentModuleDetailPageView(params.id);

  if (modulePage.loading && !modulePage.authRequired) {
    return (
      <StatePanel
        tone="loading"
        title="正在加载模块详情"
        description="正在同步模块资料、任务和进度信息，请稍等。"
      />
    );
  }

  if (modulePage.authRequired) {
    return (
      <StatePanel
        tone="info"
        title="请先登录再查看模块详情"
        description="登录学生账号后，才能进入对应模块查看资料与作业。"
        action={
          <Link className="button secondary" href="/login">
            去登录
          </Link>
        }
      />
    );
  }

  if (modulePage.pageError && !modulePage.data) {
    return (
      <StatePanel
        tone="error"
        title="模块详情加载失败"
        description={modulePage.pageError ?? undefined}
        action={
          <button className="button secondary" type="button" onClick={modulePage.reload}>
            重新加载
          </button>
        }
      />
    );
  }

  if (!modulePage.data || !modulePage.stageBannerProps || !modulePage.overviewCardProps || !modulePage.resourcesCardProps || !modulePage.assignmentsCardProps) {
    return (
      <StatePanel
        tone="empty"
        title="模块详情暂不可用"
        description="当前没有可展示的模块数据。"
      />
    );
  }

  const data = modulePage.data;
  const assignments = data.assignments;
  const resources = data.resources;
  const nextPendingAssignment = assignments.find((assignment) => assignment.status !== "completed") ?? null;
  const leadAssignment = nextPendingAssignment ?? assignments[0] ?? null;
  const leadResource = resources[0] ?? null;
  const hasAssignments = assignments.length > 0;
  const hasResources = resources.length > 0;

  const focusTitle = nextPendingAssignment
    ? `优先完成《${nextPendingAssignment.title}》`
    : leadResource
      ? `先看《${leadResource.title}》`
      : "当前模块已经完成";
  const focusDescription = nextPendingAssignment
    ? `当前还有 ${modulePage.pendingCount} 项任务待完成，建议先消化资料，再进入这项作业完成本模块闭环。`
    : leadResource
      ? "老师已经把资料收拢到当前模块，先完成一轮阅读或下载，再决定是否进入后续任务会更轻松。"
      : "这个模块的资料和任务都已处理完成，你可以回看关键资料，或者直接进入下一单元。";
  const primaryAction = nextPendingAssignment
    ? {
        href: `/student/assignments/${nextPendingAssignment.id}`,
        label: "继续当前任务"
      }
    : leadResource
      ? {
          href: "#student-module-resources-panel",
          label: "展开模块资料"
        }
      : {
          href: "/student/modules",
          label: "返回模块列表"
      };
  const secondaryAction = hasAssignments
    ? {
        href: "#student-module-assignments",
        label: leadAssignment?.status === "completed" ? "查看最近作业" : "查看全部作业"
      }
    : hasResources
      ? {
          href: "#student-module-resources-panel",
          label: "查看全部资料"
        }
      : {
          href: "/student/modules",
          label: "查看其他模块"
        };

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="section-head">
        <div>
          <h2>{data.module.title}</h2>
          <div className="section-sub">{data.module.description || "模块详情"}</div>
        </div>
        <div className="workflow-toolbar">
          <span className="chip">模块学习</span>
          <span className="chip">{data.classroom.name}</span>
          <span className="chip">进度 {modulePage.overviewCardProps.progressPercent}%</span>
          {modulePage.lastLoadedAtLabel ? <span className="chip">更新于 {modulePage.lastLoadedAtLabel}</span> : null}
          <button className="button secondary" type="button" onClick={modulePage.reload} disabled={modulePage.refreshing}>
            {modulePage.refreshing ? "刷新中..." : "刷新"}
          </button>
        </div>
      </div>

      {modulePage.pageError ? (
        <StatePanel
          compact
          tone="error"
          title="已展示最近一次成功数据"
          description={`最新操作失败：${modulePage.pageError}`}
          action={
            <button className="button secondary" type="button" onClick={modulePage.reload}>
              再试一次
            </button>
          }
        />
      ) : null}

      <div className="student-learning-detail-top-grid">
        <StudentModuleStageBanner {...modulePage.stageBannerProps} />
        <div className="workflow-spotlight-card student-learning-detail-focus-card">
          <div className="student-learning-detail-focus-kicker">现在直接开始</div>
          <div className="student-learning-detail-focus-title">{focusTitle}</div>
          <p className="student-learning-detail-focus-description">{focusDescription}</p>
          <div className="workflow-summary-grid">
            <div className="workflow-summary-card">
              <div className="workflow-summary-label">模块进度</div>
              <div className="workflow-summary-value">{modulePage.overviewCardProps.progressPercent}%</div>
              <div className="workflow-summary-helper">
                已完成 {modulePage.completedCount} 项 · 待完成 {modulePage.pendingCount} 项
              </div>
            </div>
            <div className="workflow-summary-card">
              <div className="workflow-summary-label">学习资产</div>
              <div className="workflow-summary-value">{resources.length}</div>
              <div className="workflow-summary-helper">
                文件 {modulePage.fileResourceCount} 份 · 链接 {modulePage.linkResourceCount} 条
              </div>
            </div>
            <div className="workflow-summary-card">
              <div className="workflow-summary-label">当前建议</div>
              <div className="workflow-summary-value">{nextPendingAssignment ? "作业优先" : hasResources ? "资料优先" : "已完成"}</div>
              <div className="workflow-summary-helper">
                {nextPendingAssignment
                  ? `最近截止 ${new Date(nextPendingAssignment.dueDate).toLocaleDateString("zh-CN")}`
                  : leadResource
                    ? "先完成一轮阅读，再决定是否进入任务"
                    : "可返回列表继续下一单元"}
              </div>
            </div>
          </div>
          <div className="cta-row student-module-next-actions" style={{ marginTop: 14 }}>
            {primaryAction.href.startsWith("/") ? (
              <Link className="button primary" href={primaryAction.href}>
                {primaryAction.label}
              </Link>
            ) : (
              <a className="button primary" href={primaryAction.href}>
                {primaryAction.label}
              </a>
            )}
            {secondaryAction.href.startsWith("/") ? (
              <Link className="button ghost" href={secondaryAction.href}>
                {secondaryAction.label}
              </Link>
            ) : (
              <a className="button ghost" href={secondaryAction.href}>
                {secondaryAction.label}
              </a>
            )}
            <Link className="button secondary" href="/student/modules">
              返回模块列表
            </Link>
          </div>
        </div>
      </div>

      {hasAssignments ? <StudentModuleAssignmentsCard {...modulePage.assignmentsCardProps} /> : null}

      <details className="workflow-collapsible" id="student-module-resources-panel" open={!hasAssignments && hasResources}>
        <summary>
          <span>模块资料与课件</span>
          <span className="chip">{resources.length} 份资源</span>
        </summary>
        <div className="workflow-collapsible-body">
          <StudentModuleResourcesCard {...modulePage.resourcesCardProps} />
        </div>
      </details>

      {!hasAssignments ? <StudentModuleAssignmentsCard {...modulePage.assignmentsCardProps} /> : null}

      <details className="workflow-collapsible">
        <summary>
          <span>模块概览与学习说明</span>
          <span className="chip">完整信息</span>
        </summary>
        <div className="workflow-collapsible-body">
          <div className="workflow-step-line">
            建议顺序：先看模块资料，再完成模块作业，最后回看老师补充的重点资料，形成一轮完整闭环。
          </div>
          <StudentModuleOverviewCard {...modulePage.overviewCardProps} />
        </div>
      </details>
    </div>
  );
}

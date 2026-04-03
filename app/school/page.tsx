"use client";

import WorkspaceHero from "@/components/WorkspaceHero";
import WorkspacePage, { WorkspaceAuthState, WorkspaceEmptyState, WorkspaceErrorState, WorkspaceLoadingState } from "@/components/WorkspacePage";
import { SchoolAttentionClassesCard } from "./_components/SchoolAttentionClassesCard";
import { SchoolClassSnapshotCard } from "./_components/SchoolClassSnapshotCard";
import { SchoolDashboardOverviewCard } from "./_components/SchoolDashboardOverviewCard";
import { SchoolHealthMetricsCard } from "./_components/SchoolHealthMetricsCard";
import { SchoolInteractiveClassroomDeliveryCard } from "./_components/SchoolInteractiveClassroomDeliveryCard";
import { SchoolMemberSnapshotCard } from "./_components/SchoolMemberSnapshotCard";
import { SchoolPriorityActionsCard } from "./_components/SchoolPriorityActionsCard";
import { useSchoolPageView } from "./useSchoolPageView";

export default function SchoolPage() {
  const {
    loading,
    authRequired,
    hasOverview,
    pageError,
    reload,
    workspacePageProps,
    overviewCardProps,
    healthMetricsCardProps,
    priorityActionsCardProps,
    attentionClassesCardProps,
    classSnapshotCardProps,
    memberSnapshotCardProps,
    classroomDeliveryCardProps
  } = useSchoolPageView();

  if (loading && !hasOverview && !authRequired) {
    return <WorkspaceLoadingState title="学校控制台加载中" description="正在汇总学校组织、班级和成员数据。" />;
  }

  if (authRequired) {
    return <WorkspaceAuthState title="需要学校管理员权限" description="请使用学校管理员或平台主管账号登录后查看学校控制台。" />;
  }

  if (pageError && !hasOverview) {
    return <WorkspaceErrorState title="学校控制台加载失败" description={pageError} onRetry={reload} />;
  }

  if (!hasOverview) {
    return <WorkspaceEmptyState title="暂无学校数据" description="当前租户还没有生成学校概览数据，请稍后再试。" />;
  }

  const schoolOverview = overviewCardProps.overview;
  const deliverySummary = classroomDeliveryCardProps.summary;
  const schoolCoverageSummary = [
    `教师覆盖 ${schoolOverview.teacherCoverageRate}%`,
    `作业覆盖 ${schoolOverview.assignmentCoverageRate}%`,
    `课程表覆盖 ${schoolOverview.scheduleCoverageRate}%`,
  ].join(" · ");

  return (
    <WorkspacePage
      {...workspacePageProps}
      hideHeader
      lead={
        <WorkspaceHero
          eyebrow="School Governance"
          title="先看覆盖风险，再把互动课堂、课程表和班级治理推进到真实执行"
          description="学校首屏不再只是堆指标，而是把组织覆盖、互动课堂传播和需要优先整改的班级收敛成一条治理路径。这样学校管理员可以先处理最影响教学运行的问题，再展开资产台账。"
          badges={[
            `学校班级 ${schoolOverview.classCount}`,
            `教师 ${schoolOverview.teacherCount} / 学生 ${schoolOverview.studentCount}`,
            deliverySummary ? `互动课堂交付 ${deliverySummary.totalDeliveries}` : "互动课堂治理已接入",
          ]}
          actions={
            <>
              <a className="button primary" href="/school/interactive-classrooms">
                进入互动课堂治理
              </a>
              <a className="button secondary" href="/school/schedules">
                查看课程表管理
              </a>
              <a className="button ghost" href="#school-assets-center">
                展开组织资产
              </a>
            </>
          }
          sideLabel="学校管理建议"
          sideTitle="先管覆盖，再管扩散和沉淀"
          sideDescription="学校真正需要先看的是哪里还没覆盖、哪里已经扩散、哪些班级需要立即跟进，而不是在首页阅读所有列表。"
          notes={[
            {
              title: "先看覆盖缺口",
              description: "先处理没有教师、没有学生、没有作业或没有课表的班级，最能直接修复运行断点。",
              tone: "sky",
            },
            {
              title: "再看互动课堂传播",
              description: "把教师发布、学生自主学习和导出沉淀放到同一面板里，直接看学校级覆盖与复用情况。",
              tone: "emerald",
            },
            {
              title: "最后看资产台账",
              description: "组织成员和班级清单放到后面展开，避免学校首页同时并列太多长列表。",
              tone: "amber",
            },
          ]}
          stats={[
            {
              label: "组织覆盖",
              value: `${schoolOverview.classCount} 个班级 / ${schoolOverview.teacherCount} 位教师`,
              description: "先确认学校班级和教师配置是否到位，治理动作才有明确落点。",
              tone: "sky",
            },
            {
              label: "教学运行",
              value: schoolCoverageSummary,
              description: "课程表、作业和教师覆盖一起看，能更快定位真实教学链路的缺口。",
              tone: "emerald",
            },
            {
              label: "互动课堂交付",
              value: deliverySummary ? `${deliverySummary.deliveredClassroomCount} 节已交付课堂` : "等待交付数据",
              description: deliverySummary
                ? `累计 ${deliverySummary.totalDeliveries} 次发布、导出或学生自主使用，已经形成学校级交付台账。`
                : "教师发布、导出或学生自主使用后，会自动沉淀到学校级治理面板。",
              tone: "amber",
            },
          ]}
        />
      }
    >
      <div className="section-head">
        <div>
          <h2>全局治理与课堂分发</h2>
          <div className="section-sub">先看学校整体覆盖、互动课堂传播和需要立即处理的班级，避免首页被长台账淹没。</div>
        </div>
        <span className="chip">治理总览</span>
      </div>

      <SchoolDashboardOverviewCard {...overviewCardProps} />

      <SchoolHealthMetricsCard {...healthMetricsCardProps} />

      <SchoolInteractiveClassroomDeliveryCard {...classroomDeliveryCardProps} />

      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <SchoolPriorityActionsCard {...priorityActionsCardProps} />

        <SchoolAttentionClassesCard {...attentionClassesCardProps} />
      </div>

      <details className="workflow-collapsible" id="school-assets-center">
        <summary>
          <span>展开组织资产与成员台账</span>
          <span className="chip">{`班级 ${classSnapshotCardProps.classPreview.length} · 成员预览 ${memberSnapshotCardProps.teacherPreview.length + memberSnapshotCardProps.studentPreview.length}`}</span>
        </summary>
        <div className="workflow-collapsible-body">
          <div className="section-head">
            <div>
              <h2>组织资产与成员视图</h2>
              <div className="section-sub">当你需要看学校班级、教师和学生台账时，再展开完整资产视图，减少首页的信息噪音。</div>
            </div>
            <span className="chip">资产台账</span>
          </div>

          <div className="grid grid-2" style={{ alignItems: "start" }}>
            <SchoolClassSnapshotCard {...classSnapshotCardProps} />

            <SchoolMemberSnapshotCard {...memberSnapshotCardProps} />
          </div>
        </div>
      </details>
    </WorkspacePage>
  );
}

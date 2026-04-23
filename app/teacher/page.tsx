"use client";

import { useEffect, useMemo, useState } from "react";
import GuidedTour from "@/components/GuidedTour";
import RoleScheduleFocusCard from "@/components/RoleScheduleFocusCard";
import WorkspaceHero from "@/components/WorkspaceHero";
import WorkspacePage, {
  WorkspaceAuthState,
  WorkspaceErrorState,
  WorkspaceLoadingState
} from "@/components/WorkspacePage";
import { requestJson } from "@/lib/client-request";
import TeacherDashboardSectionHeader from "./_components/TeacherDashboardSectionHeader";
import { TeacherAssignmentsCard, TeacherClassListCard, TeacherJoinRequestsCard } from "./_components/TeacherCollectionPanels";
import { TeacherAddStudentCard, TeacherAssignmentComposerCard, TeacherCreateClassCard } from "./_components/TeacherFormPanels";
import { TeacherExamModuleCard, TeacherInsightsCard, TeacherOverviewCard, TeacherQuickAccessCards } from "./_components/TeacherSummaryPanels";
import TeacherMoodTrendCard from "./_components/TeacherMoodTrendCard";
import { TeacherExecutionSummaryCard, TeacherNextStepCard } from "./_components/TeacherPrimaryFlowPanels";
import TeacherTeachingLoopCard from "./_components/TeacherTeachingLoopCard";
import { useTeacherDashboardPageView } from "./useTeacherDashboardPageView";

export default function TeacherPage() {
  const [showTour, setShowTour] = useState(false);
  const {
    loading,
    pageError,
    pageReady,
    unauthorized,
    refreshDashboard,
    workspacePageProps,
    nextStepProps,
    assignmentComposerProps,
    joinRequestsProps,
    executionSummaryProps,
    teachingLoopProps,
    insightsProps,
    overviewProps,
    createClassProps,
    addStudentProps,
    classListProps,
    assignmentsProps,
    scheduleFocusProps
  } = useTeacherDashboardPageView();
  const teacherClassCount = executionSummaryProps.classes.length;
  const teacherAssignmentCount = executionSummaryProps.assignments.length;
  const teacherJoinCount = joinRequestsProps.joinRequests.length;
  const teacherAlertCount = insightsProps.insights?.summary.activeAlerts ?? 0;
  const teacherContextSummary = [
    executionSummaryProps.classes.length ? `班级 ${executionSummaryProps.classes.length}` : null,
    executionSummaryProps.assignments.length ? `作业 ${executionSummaryProps.assignments.length}` : null,
    joinRequestsProps.joinRequests.length ? `待审 ${joinRequestsProps.joinRequests.length}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const teacherAssetSummary = [
    classListProps.classes.length ? `班级资产 ${classListProps.classes.length}` : null,
    assignmentsProps.assignments.length ? `作业台账 ${assignmentsProps.assignments.length}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  useEffect(() => {
    let mounted = true;
    void requestJson<{ data?: { completedAt?: string | null } }>("/api/user/onboarding")
      .then((payload) => {
        if (mounted && !payload.data?.completedAt) {
          setShowTour(true);
        }
      })
      .catch(() => {
        // Ignore onboarding load failures and keep the dashboard interactive.
      });
    return () => {
      mounted = false;
    };
  }, []);

  const teacherTourSteps = useMemo(
    () => [
      {
        targetSelector: "#teacher-class-list",
        title: "先看班级资产",
        content: "这里集中展示你当前管理的班级，后续的作业、课堂和学情动作都会围绕这些真实班级展开。",
        placement: "top" as const
      },
      {
        targetSelector: "#teacher-compose-assignment",
        title: "从这里布置第一份作业",
        content: "现在支持普通发布和差异化 A/B/C 分层发布，两种模式都从同一个入口发起。",
        placement: "bottom" as const
      },
      {
        targetSelector: "#teacher-context-layers",
        title: "最后再看风险与整体盘面",
        content: "风险预警、教学闭环和课表背景被收纳在这里，先执行，再回看整体数据。",
        placement: "top" as const
      }
    ],
    []
  );

  if (loading && !pageReady && !unauthorized) {
    return <WorkspaceLoadingState title="教师工作台加载中" description="正在同步班级、作业、预警和教学执行数据。" />;
  }

  if (unauthorized) {
    return <WorkspaceAuthState title="需要教师账号登录" description="请先使用教师账号登录后，再查看教学工作台和班级执行动作。" />;
  }

  if (pageError && !pageReady) {
    return (
      <WorkspaceErrorState
        title="教师工作台加载失败"
        description={pageError}
        onRetry={() => void refreshDashboard()}
      />
    );
  }

  return (
    <WorkspacePage
      {...workspacePageProps}
      hideHeader
      lead={
        <WorkspaceHero
          eyebrow="Teacher Launchpad"
          title="把教学执行、审批动作与课堂主线压缩成今天能真正完成的路径"
          description="先稳住阻塞项和课堂风险，再推进作业、班级与互动课堂动作，最后回到盘面做复盘。教师不用先读完所有数据，首屏直接进入最应该先做的事。"
          badges={[
            teacherClassCount ? `当前班级 ${teacherClassCount}` : "先建立班级结构",
            teacherJoinCount ? `待审申请 ${teacherJoinCount}` : "班级申请已收口",
            teacherAlertCount ? `活跃预警 ${teacherAlertCount}` : "当前无活跃预警",
          ]}
          actions={
            <>
              <a className="button primary" href="#teacher-action-center">
                去今日第一步
              </a>
              <a className="button secondary" href="#teacher-compose-assignment">
                去发布作业
              </a>
              <a className="button ghost" href="/ai-classroom">
                打开互动课堂
              </a>
            </>
          }
          sideLabel="今天建议这样推进"
          sideTitle="先处理阻塞，再进入教学执行"
          sideDescription="把真正影响课堂节奏的审批、预警和执行动作放在前面，班级台账和长期盘面放到后面展开，避免教师首屏并列太多总览。"
          notes={[
            {
              title: "先清阻塞项",
              description: "入班申请、待补作业和高风险预警优先处理，最能直接恢复课堂节奏。",
              tone: "sky",
            },
            {
              title: "再推进教学动作",
              description: "作业发布、互动课堂和班级执行入口放在第二层，便于老师直接开工。",
              tone: "emerald",
            },
            {
              title: "最后回到盘面",
              description: "学情、成绩和教学闭环适合在执行后回看，不和第一步动作抢注意力。",
              tone: "amber",
            },
          ]}
          stats={[
            {
              label: "教学对象",
              value: teacherClassCount ? `${teacherClassCount} 个班级` : "等待建立班级",
              description: "班级是教师所有执行动作的入口，首页会围绕真实班级节奏组织。",
              tone: "sky",
            },
            {
              label: "执行动作",
              value: teacherAssignmentCount ? `${teacherAssignmentCount} 项作业在管` : "准备发布首个动作",
              description: "作业、互动课堂和 AI 教学动作会围绕同一条教学主线联动。",
              tone: "emerald",
            },
            {
              label: "风险与审批",
              value: `${teacherJoinCount} 条申请 / ${teacherAlertCount} 条预警`,
              description: "把影响课堂推进的申请和风险放到首屏，老师可以先处理真正会卡住教学的地方。",
              tone: "amber",
            },
          ]}
        />
      }
    >
      <TeacherDashboardSectionHeader
        title="现在先开工"
        description="首屏先只看阻塞项、风险和今天第一步，不在首页重新排一次教学优先级。"
        chip="即时开工"
      />

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
        <button className="button ghost" type="button" onClick={() => setShowTour(true)}>
          ? 重新引导
        </button>
      </div>

      <div id="teacher-action-center">
        <TeacherNextStepCard {...nextStepProps} />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
          alignItems: "stretch"
        }}
      >
        <a className="card" href="/teacher/lesson-planner" style={{ display: "grid", gap: 8, textDecoration: "none", color: "inherit" }}>
          <div className="badge">AI 备课助手</div>
          <div className="section-title" style={{ margin: 0 }}>按真实班级学情生成备课方案</div>
          <div style={{ color: "var(--ink-1)" }}>快速拿到错误预测、互动设计、分层作业建议和教学反思提示。</div>
        </a>
        <a className="card" href="/teacher/classroom-live" style={{ display: "grid", gap: 8, textDecoration: "none", color: "inherit" }}>
          <div className="badge">课堂实时仪表盘</div>
          <div className="section-title" style={{ margin: 0 }}>发起课堂练习后实时看全班响应</div>
          <div style={{ color: "var(--ink-1)" }}>查看作答人数、正确率、快慢学生列表，并一键推进下一题。</div>
        </a>
        <a className="card" href="/teacher/projects" style={{ display: "grid", gap: 8, textDecoration: "none", color: "inherit" }}>
          <div className="badge">项目式学习</div>
          <div className="section-title" style={{ margin: 0 }}>生成跨学科项目骨架并持续点评</div>
          <div style={{ color: "var(--ink-1)" }}>把综合任务拆成阶段提交，让学生在过程中持续获得反馈。</div>
        </a>
      </div>

      <TeacherDashboardSectionHeader
        title="今天要执行的动作"
        description="先把最常见的教学执行入口放在前面，再回头看盘面说明和课表上下文。"
        chip="教学执行"
      />

      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <div id="teacher-compose-assignment">
          <TeacherAssignmentComposerCard {...assignmentComposerProps} />
        </div>

        <div id="teacher-join-requests">
          <TeacherJoinRequestsCard {...joinRequestsProps} />
        </div>
      </div>

      <TeacherDashboardSectionHeader
        title="盘面与上下文"
        description="执行入口明确后，再看风险覆盖、教学闭环和课表背景，避免首屏并列太多总览卡片。"
        chip="盘面与背景"
      />

      <TeacherMoodTrendCard classes={executionSummaryProps.classes.map((item) => ({ id: item.id, name: item.name }))} />

      <details className="workflow-collapsible" id="teacher-context-layers">
        <summary>
          <span>展开教学盘面与上下文</span>
          <span className="chip">{teacherContextSummary || "风险 / 课表 / 闭环 / 考试"}</span>
        </summary>
        <div className="workflow-collapsible-body">
          <div className="grid grid-2" style={{ alignItems: "start" }}>
            <TeacherExecutionSummaryCard {...executionSummaryProps} />
            <RoleScheduleFocusCard {...scheduleFocusProps} />
          </div>

          <TeacherTeachingLoopCard {...teachingLoopProps} />

          <TeacherInsightsCard {...insightsProps} />

          <div className="grid grid-2" style={{ alignItems: "start" }}>
            <TeacherOverviewCard {...overviewProps} />
            <TeacherExamModuleCard />
          </div>

          <TeacherQuickAccessCards />
        </div>
      </details>

      <details className="workflow-collapsible" id="teacher-assets-center">
        <summary>
          <span>展开班级、学生与作业台账</span>
          <span className="chip">{teacherAssetSummary || "班级 / 学生 / 作业"}</span>
        </summary>
        <div className="workflow-collapsible-body">
          <div className="grid grid-2">
            <div id="teacher-create-class">
              <TeacherCreateClassCard {...createClassProps} />
            </div>
            <div id="teacher-add-student">
              <TeacherAddStudentCard {...addStudentProps} />
            </div>
          </div>

          <div id="teacher-class-list">
            <TeacherClassListCard {...classListProps} />
          </div>

          <div id="teacher-assignment-list">
            <TeacherAssignmentsCard {...assignmentsProps} />
          </div>
        </div>
      </details>
      <GuidedTour
        open={showTour}
        steps={teacherTourSteps}
        onSkip={() => setShowTour(false)}
        onComplete={() => {
          setShowTour(false);
          void requestJson("/api/user/onboarding", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              completedSteps: ["tour", "teacher-class-list", "teacher-compose-assignment", "teacher-context-layers"]
            })
          }).catch(() => {
            // Ignore persistence failures and keep the dashboard usable.
          });
        }}
      />
    </WorkspacePage>
  );
}

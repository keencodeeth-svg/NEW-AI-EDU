"use client";

import { useEffect, useMemo, useState } from "react";
import GuidedTour from "@/components/GuidedTour";
import WorkspacePage, { WorkspaceAuthState, WorkspaceErrorState, WorkspaceLoadingState } from "@/components/WorkspacePage";
import WorkspaceHero from "@/components/WorkspaceHero";
import { requestJson } from "@/lib/client-request";
import StudentDashboardSectionHeader from "./_components/StudentDashboardSectionHeader";
import StudentDashboardGuideCard from "./_components/StudentDashboardGuideCard";
import StudentEncouragementBanner from "./_components/StudentEncouragementBanner";
import StudentEntryCollection from "./_components/StudentEntryCollection";
import StudentExecutionSummaryCard from "./_components/StudentExecutionSummaryCard";
import StudentInteractiveClassroomEntryCard from "./_components/StudentInteractiveClassroomEntryCard";
import StudentLearningLoopCard from "./_components/StudentLearningLoopCard";
import StudentLiveClassroomBanner from "./_components/StudentLiveClassroomBanner";
import StudentMotivationCard from "./_components/StudentMotivationCard";
import StudentNextActionCard from "./_components/StudentNextActionCard";
import StudentPriorityTasksCard from "./_components/StudentPriorityTasksCard";
import StudentQuickTutorCard from "./_components/StudentQuickTutorCard";
import StudentScheduleCard from "./_components/StudentScheduleCard";
import StudentTaskOverviewCard from "./_components/StudentTaskOverviewCard";
import StudentUnifiedTaskQueueCard from "./_components/StudentUnifiedTaskQueueCard";
import StudentDailyChallengeCard from "./_components/StudentDailyChallengeCard";
import { CATEGORY_META } from "./utils";
import { useStudentDashboardPageView } from "./useStudentDashboardPageView";

export default function StudentPage() {
  const dashboardPage = useStudentDashboardPageView();
  const [showTour, setShowTour] = useState(false);
  const mustDoCount = dashboardPage.nextActionCardProps.mustDoCount ?? 0;
  const totalTaskCount = dashboardPage.unifiedTaskQueueCardProps.todayTasks?.summary?.total ?? 0;
  const todayLessonCount = dashboardPage.executionSummaryCardProps.schedule?.todayLessons?.length ?? 0;
  const weakPlanCount = dashboardPage.interactiveClassroomEntryCardProps.weakPlanCount ?? 0;
  const studentQueueSummary = [
    dashboardPage.priorityTasksCardProps.visiblePriorityTasks.length
      ? `优先任务 ${dashboardPage.priorityTasksCardProps.visiblePriorityTasks.length}`
      : null,
    dashboardPage.unifiedTaskQueueCardProps.todayTasks?.summary?.total
      ? `总任务 ${dashboardPage.unifiedTaskQueueCardProps.todayTasks.summary.total}`
      : null,
    dashboardPage.executionSummaryCardProps.schedule?.todayLessons?.length
      ? `今日日程 ${dashboardPage.executionSummaryCardProps.schedule.todayLessons.length}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const studentExpansionSummary = [
    dashboardPage.entryCollectionProps.entriesByCategoryCount
      ? `学习入口 ${dashboardPage.entryCollectionProps.entriesByCategoryCount}`
      : null,
    dashboardPage.interactiveClassroomEntryCardProps.weakPlanCount
      ? `互动课堂建议 ${dashboardPage.interactiveClassroomEntryCardProps.weakPlanCount}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const startFlowItems = [
    {
      id: "action",
      title: "先做第一项",
      description: mustDoCount
        ? `系统已经排好开始顺序，先处理这 ${mustDoCount} 项里的第一项。`
        : "当前没有明显必做项时，先从推荐动作开始保持节奏。",
      href: "#student-action-center",
      chip: "01",
    },
    {
      id: "classroom",
      title: "需要陪学就开课",
      description: weakPlanCount
        ? `自主互动课堂已经准备了 ${weakPlanCount} 个建议主题。`
        : "预习、巩固、兴趣探索都可以直接发起一节互动课堂。",
      href: "#student-self-study-entry",
      chip: "02",
    },
    {
      id: "fallback",
      title: "卡住别退出",
      description: "遇到不会做、时间紧或只想先核对关键步骤时，直接快问快答。",
      href: "#student-next-action",
      chip: "03",
    },
    {
      id: "queue",
      title: "最后再展开全部",
      description: "完整队列、时间预算、学习入口和激励都放在后面，不抢现在的开始动作。",
      href: "#student-task-queue",
      chip: "04",
    },
  ];

  useEffect(() => {
    let mounted = true;
    void requestJson<{ data?: { completedAt?: string | null } }>("/api/user/onboarding")
      .then((payload) => {
        if (mounted && !payload.data?.completedAt) {
          setShowTour(true);
        }
      })
      .catch(() => {
        // Ignore onboarding fetch failures and keep the dashboard usable.
      });
    return () => {
      mounted = false;
    };
  }, []);

  const studentTourSteps = useMemo(
    () => [
      {
        targetSelector: "#student-action-center",
        title: "先看今天第一项",
        content: "这里是系统已经帮你排好的开始动作，先推进当前第一项，再决定是否展开完整队列。",
        placement: "bottom" as const
      },
      {
        targetSelector: "#student-self-study-entry",
        title: "需要完整陪学就直接开互动课堂",
        content: "预习、巩固、兴趣探索都可以从这里继续，不需要在首页反复重新判断入口。",
        placement: "bottom" as const
      },
      {
        targetSelector: "#student-growth-center",
        title: "做完以后再回看成长闭环",
        content: "每日挑战、学习入口、激励和成长追踪都收纳在这里，先开工，再补充上下文。",
        placement: "top" as const
      }
    ],
    []
  );

  if (dashboardPage.loading && !dashboardPage.hasDashboardData && !dashboardPage.authRequired) {
    return <WorkspaceLoadingState title="今日学习加载中" description="正在汇总课表、学习计划、今日任务和成长激励。" />;
  }

  if (dashboardPage.authRequired) {
    return <WorkspaceAuthState title="需要学生账号登录" description="请先登录学生账号，再查看今日学习和任务。" />;
  }

  if (dashboardPage.pageError && !dashboardPage.hasDashboardData) {
    return <WorkspaceErrorState title="今日学习加载失败" description={dashboardPage.pageError} onRetry={dashboardPage.retryDashboard} />;
  }

  return (
    <WorkspacePage
      {...dashboardPage.workspacePageProps}
      hideHeader
      lead={
        <WorkspaceHero
          eyebrow="学生今日学习"
          title="先推进今天最值得开始的动作，再决定要不要展开全部上下文"
          description="把任务、互动课堂、自主学习、课表和补救链路压成一条更容易进入的开始路径。学生不需要在首页重新判断优先级，直接从当前最合适的入口起步。"
          badges={[
            mustDoCount ? `必做任务 ${mustDoCount}` : "先从推荐任务开始",
            weakPlanCount ? `互动课堂建议 ${weakPlanCount}` : "支持自主互动课堂",
            todayLessonCount ? `今日课程 ${todayLessonCount} 节` : "按任务节奏推进",
          ]}
          actions={
            <>
              <a className="button primary" href="#student-action-center">
                去第一项任务
              </a>
              <a className="button secondary" href="#student-task-queue">
                展开完整队列
              </a>
              <a className="button ghost" href="#student-growth-center">
                查看完整学习入口
              </a>
            </>
          }
          sideLabel="今天建议这样用"
          sideTitle="先开工，再补充上下文"
          sideDescription="把真正影响开始动作的内容放在前面，把完整队列、激励和全部学习入口收纳到后面，减少学生首屏认知负担。"
          notes={[
            {
              title: "先做第一项",
              description: "系统已经把当前最值得先做的任务放到首屏，先开始，不在首页反复判断。",
              tone: "sky",
            },
            {
              title: "卡住直接求助",
              description: "遇到不会做、没把握或想快速确认思路时，直接用快问快答兜底。",
              tone: "emerald",
            },
            {
              title: "做完再展开",
              description: "完整队列、学习闭环和全部入口放在后面，不抢开始动作的注意力。",
              tone: "amber",
            },
          ]}
          stats={[
            {
              label: "优先任务",
              value: mustDoCount ? `${mustDoCount} 项` : "已排好开始顺序",
              description: "首屏保留当前最值得先做的动作，避免学生在首页反复重新排序。",
              tone: "sky",
            },
            {
              label: "自主互动课堂",
              value: weakPlanCount ? `${weakPlanCount} 个建议主题` : "支持预习 / 巩固 / 兴趣探索",
              description: "学生可以自己发起可观看、可回看、可导出的互动课堂，形成连续学习主线。",
              tone: "emerald",
            },
            {
              label: "今日节奏",
              value: todayLessonCount ? `${todayLessonCount} 节课 + ${totalTaskCount || 0} 项任务` : `${totalTaskCount || 0} 项任务待推进`,
              description: "课表、作业与练习被统一成一个开始路径，减少来回切换页面的成本。",
              tone: "amber",
            },
          ]}
        />
      }
    >
      <div style={{ display: "grid", gap: 10, marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button className="button ghost" type="button" onClick={() => setShowTour(true)}>
            重新引导
          </button>
        </div>
        <StudentEncouragementBanner />
        <StudentLiveClassroomBanner />
      </div>

      <div className="student-start-strip" aria-label="学生开始路径">
        {startFlowItems.map((item) => (
          <a key={item.id} className="student-start-strip-item" href={item.href}>
            <span className="student-start-strip-chip">{item.chip}</span>
            <span className="student-start-strip-copy">
              <span className="student-start-strip-title">{item.title}</span>
              <span className="student-start-strip-description">{item.description}</span>
            </span>
          </a>
        ))}
      </div>

      <div className="student-primary-flow-shell" id="student-primary-start">
        <StudentDashboardSectionHeader
          title="今天直接开始"
          description="首屏只保留一条主路径：先看现在最值得开始的动作，需要完整陪学就开互动课堂，卡住时再用快问和高优先队列兜底。"
          chip="首屏主路径"
        />

        <div id="student-action-center">
          <StudentNextActionCard {...dashboardPage.nextActionCardProps} />
        </div>

        {dashboardPage.radarError ? <div className="status-note info">{dashboardPage.radarError}。首页仍会展示任务与课表，但画像相关建议可能不是最新。</div> : null}

        <div className="student-primary-flow-rail" aria-label="首屏连续开始路径">
          <a className="student-primary-flow-link" href="#student-self-study-entry">
            <span className="student-primary-flow-kicker">继续学</span>
            <span className="student-primary-flow-title">需要完整陪学时，直接开互动课堂</span>
            <span className="student-primary-flow-description">
              预习、巩固、兴趣探索和课堂回看都从这里接续，不需要重新找入口。
            </span>
          </a>
          <a className="student-primary-flow-link" href="#student-next-action">
            <span className="student-primary-flow-kicker">先解卡点</span>
            <span className="student-primary-flow-title">不会做时先快问，不中断节奏</span>
            <span className="student-primary-flow-description">
              拍题、分步讲解和高优先任务放在同一区，先把当前阻塞拿掉。
            </span>
          </a>
          <a className="student-primary-flow-link" href="#student-task-queue">
            <span className="student-primary-flow-kicker">再展开</span>
            <span className="student-primary-flow-title">做完当前动作，再看完整队列</span>
            <span className="student-primary-flow-description">
              时间预算、课表联动、全部任务和学习入口都保留在后面，不抢首屏注意力。
            </span>
          </a>
        </div>

        <div id="student-self-study-entry">
          <StudentInteractiveClassroomEntryCard
            {...dashboardPage.interactiveClassroomEntryCardProps}
          />
        </div>

        <div id="student-next-action" className="student-context-grid">
          <StudentQuickTutorCard {...dashboardPage.quickTutorCardProps} />

          <div className="grid" style={{ gap: 10 }}>
            <div id="student-priority-tasks">
              <StudentPriorityTasksCard {...dashboardPage.priorityTasksCardProps} />
            </div>
            <StudentTaskOverviewCard {...dashboardPage.taskOverviewCardProps} />
          </div>
        </div>
      </div>

      <StudentDashboardSectionHeader
        title="时间与上下文"
        description="先明确第一步和兜底动作，再看时间预算、课表联动和完整任务上下文。"
        chip="节奏与上下文"
      />

      <details className="workflow-collapsible" id="student-task-queue">
        <summary>
          <span>展开时间预算与完整任务队列</span>
          <span className="chip">{studentQueueSummary || "时间 / 课表 / 完整任务"}</span>
        </summary>
        <div className="workflow-collapsible-body">
          <div className="grid grid-2" style={{ alignItems: "start" }}>
            <StudentExecutionSummaryCard {...dashboardPage.executionSummaryCardProps} />

            <StudentScheduleCard {...dashboardPage.scheduleCardProps} />
          </div>

          <StudentDashboardSectionHeader
            title="完整任务队列"
            description="当你需要看全部任务来源和完整顺序时，再展开完整队列。"
            chip="完整队列"
          />

          <StudentUnifiedTaskQueueCard {...dashboardPage.unifiedTaskQueueCardProps} />
        </div>
      </details>

      <details className="workflow-collapsible" id="student-growth-center">
        <summary>
          <span>展开学习闭环、激励与完整学习入口</span>
          <span className="chip">{studentExpansionSummary || "闭环 / 激励 / 学习入口"}</span>
        </summary>
        <div className="workflow-collapsible-body">
          <StudentDashboardSectionHeader
            title="做完后再回看"
            description="这里放学习闭环说明、激励和新手引导，不抢你开工前的注意力。"
            chip="做完再看"
          />

          <StudentLearningLoopCard {...dashboardPage.learningLoopCardProps} />

          <div className="student-overview-grid">
            <StudentMotivationCard {...dashboardPage.motivationCardProps} />
            <StudentDailyChallengeCard />
            <StudentDashboardGuideCard {...dashboardPage.dashboardGuideCardProps} />
          </div>

          <StudentDashboardSectionHeader
            title="学习入口"
            description={CATEGORY_META[dashboardPage.entryCollectionProps.activeCategory].description}
            chip={CATEGORY_META[dashboardPage.entryCollectionProps.activeCategory].label}
          />

          <StudentEntryCollection {...dashboardPage.entryCollectionProps} />
        </div>
      </details>
      <GuidedTour
        open={showTour}
        steps={studentTourSteps}
        onSkip={() => setShowTour(false)}
        onComplete={() => {
          setShowTour(false);
          void requestJson("/api/user/onboarding", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              completedSteps: ["tour", "student-action-center", "student-self-study-entry", "student-growth-center"]
            })
          }).catch(() => {
            // Ignore persistence failures and keep the UI responsive.
          });
        }}
      />
    </WorkspacePage>
  );
}

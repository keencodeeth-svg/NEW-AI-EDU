"use client";

import Link from "next/link";
import StatePanel from "@/components/StatePanel";
import { SchoolSchedulesAiPanel } from "./_components/SchoolSchedulesAiPanel";
import { SchoolSchedulesCoverageCard } from "./_components/SchoolSchedulesCoverageCard";
import { SchoolSchedulesFiltersCard } from "./_components/SchoolSchedulesFiltersCard";
import { SchoolSchedulesHeader } from "./_components/SchoolSchedulesHeader";
import { SchoolSchedulesManualEditorCard } from "./_components/SchoolSchedulesManualEditorCard";
import { SchoolSchedulesOverviewCard } from "./_components/SchoolSchedulesOverviewCard";
import { SchoolScheduleTeacherRulesCard } from "./_components/SchoolScheduleTeacherRulesCard";
import { SchoolScheduleTeacherUnavailableCard } from "./_components/SchoolScheduleTeacherUnavailableCard";
import { SchoolScheduleTemplatesCard } from "./_components/SchoolScheduleTemplatesCard";
import { SchoolSchedulesWeekViewCard } from "./_components/SchoolSchedulesWeekViewCard";
import { useSchoolSchedulesPageView } from "./useSchoolSchedulesPageView";

function buildTeacherManagementHref(input: { teacherId?: string | null; teacherName?: string | null; className?: string | null }) {
  const params = new URLSearchParams({
    source: "interactive_classrooms",
    filter: "assigned"
  });

  if (input.teacherId) {
    params.set("teacherId", input.teacherId);
  }
  if (input.teacherName) {
    params.set("teacherName", input.teacherName);
    params.set("keyword", input.teacherName);
  }
  if (input.className) {
    params.set("className", input.className);
  }

  return `/school/teachers?${params.toString()}`;
}

function buildClassManagementHref(input: {
  classId?: string | null;
  className?: string | null;
  teacherId?: string | null;
  teacherName?: string | null;
}) {
  const params = new URLSearchParams({
    source: "interactive_classrooms"
  });

  if (input.classId) {
    params.set("classId", input.classId);
  }
  if (input.className) {
    params.set("className", input.className);
    params.set("keyword", input.className);
  }
  if (input.teacherId) {
    params.set("teacherId", input.teacherId);
  }
  if (input.teacherName) {
    params.set("teacherName", input.teacherName);
  }

  return `/school/classes?${params.toString()}`;
}

export default function SchoolSchedulesPage() {
  const {
    loading,
    authRequired,
    hasClasses,
    hasSessions,
    sourceContext,
    pageError,
    reload,
    headerProps,
    overviewProps,
    aiPanelProps,
    templateCardProps,
    teacherUnavailableCardProps,
    teacherRulesCardProps,
    filtersCardProps,
    manualEditorCardProps,
    weekViewCardProps,
    coverageCardProps
  } = useSchoolSchedulesPageView();

  if (loading && !hasClasses && !hasSessions && !authRequired) {
    return <StatePanel title="课程表管理加载中" description="正在汇总学校班级排课和课时覆盖情况。" tone="loading" />;
  }

  if (authRequired) {
    return (
      <StatePanel
        title="需要学校管理员权限"
        description="请使用学校管理员账号登录后查看课程表管理。"
        tone="info"
        action={
          <Link className="button secondary" href="/login">
            前往登录
          </Link>
        }
      />
    );
  }

  if (pageError && !hasClasses && !hasSessions && !loading) {
    return (
      <StatePanel
        title="课程表管理加载失败"
        description={pageError}
        tone="error"
        action={
          <button className="button secondary" type="button" onClick={reload}>
            重新加载
          </button>
        }
      />
    );
  }

  if (!hasClasses && !loading) {
    return (
      <StatePanel
        title="当前学校还没有班级"
        description="请先完成班级建档，再为班级配置课程表。"
        tone="empty"
        action={
          <Link className="button secondary" href="/school/classes">
            去看班级管理
          </Link>
        }
      />
    );
  }

  return (
    <div className="grid" style={{ gap: 18 }}>
      <SchoolSchedulesHeader {...headerProps} />

      {pageError ? (
        <StatePanel
          title="已展示最近一次成功数据"
          description={`最新刷新失败：${pageError}`}
          tone="error"
          compact
          action={
            <button className="button secondary" type="button" onClick={reload}>
              再试一次
            </button>
          }
        />
      ) : null}

      {sourceContext ? (
        <StatePanel
          compact
          tone="info"
          title="已从互动课堂治理中心进入"
          description={`当前已自动定位${
            sourceContext.className ? `班级“${sourceContext.className}”` : "排课上下文"
          }${sourceContext.teacherName ? `，并关联教师“${sourceContext.teacherName}”` : ""}。你可以直接检查当前班级是否缺课、补排课时，或切回治理中心继续查看扩散情况。`}
          action={
            <div className="cta-row">
              <Link className="button secondary" href="/school/interactive-classrooms">
                返回治理中心
              </Link>
              {sourceContext.classId || sourceContext.className ? (
                <Link
                  className="button ghost"
                  href={buildClassManagementHref({
                    classId: sourceContext.classId ?? null,
                    className: sourceContext.className ?? null,
                    teacherId: sourceContext.teacherId ?? null,
                    teacherName: sourceContext.teacherName ?? null
                  })}
                >
                  查看班级治理
                </Link>
              ) : null}
              {sourceContext.teacherId || sourceContext.teacherName ? (
                <Link
                  className="button ghost"
                  href={buildTeacherManagementHref({
                    teacherId: sourceContext.teacherId ?? null,
                    teacherName: sourceContext.teacherName ?? null,
                    className: sourceContext.className ?? null
                  })}
                >
                  查看教师治理
                </Link>
              ) : null}
              <Link className="button ghost" href="/school/schedules">
                退出定位
              </Link>
            </div>
          }
        />
      ) : null}

      <SchoolSchedulesOverviewCard {...overviewProps} />

      <SchoolSchedulesAiPanel {...aiPanelProps} />

      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <SchoolScheduleTemplatesCard {...templateCardProps} />

        <SchoolScheduleTeacherUnavailableCard {...teacherUnavailableCardProps} />
      </div>

      <SchoolScheduleTeacherRulesCard {...teacherRulesCardProps} />

      <SchoolSchedulesFiltersCard {...filtersCardProps} />

      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <SchoolSchedulesManualEditorCard {...manualEditorCardProps} />

        <SchoolSchedulesWeekViewCard {...weekViewCardProps} />
      </div>

      <SchoolSchedulesCoverageCard {...coverageCardProps} />
    </div>
  );
}

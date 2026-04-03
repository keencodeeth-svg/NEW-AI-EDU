"use client";

import Link from "next/link";
import Card from "@/components/Card";
import EduIcon from "@/components/EduIcon";
import { trackEvent } from "@/lib/analytics-client";
import type { ScheduleResponse } from "@/lib/class-schedules";
import { buildTutorLaunchHref, type TutorLaunchIntent } from "@/lib/tutor-launch";
import { getStudentLessonWindow } from "../utils";

type StudentQuickTutorCardProps = {
  schedule: ScheduleResponse["data"] | null;
  mustDoCount: number;
  weakPlanCount: number;
};


export default function StudentQuickTutorCard({ schedule, mustDoCount, weakPlanCount }: StudentQuickTutorCardProps) {
  const { nextLesson, minutesUntilNextLesson, lessonWindowActive } = getStudentLessonWindow(schedule);
  const recommendation = lessonWindowActive
    ? nextLesson?.status === "in_progress"
      ? "当前已经进入上课时段，遇到课堂题目卡住时适合快速拍题核对，但先以课堂任务为主。"
      : `距离下节 ${nextLesson?.subjectLabel ?? "课"} 还有 ${minutesUntilNextLesson ?? 0} 分钟，适合快问快答，不适合再开长练习。`
    : weakPlanCount > 0
      ? `你当前有 ${weakPlanCount} 个薄弱计划项，遇到不会的题直接拍照提问更省时间。`
        : mustDoCount > 0
          ? `今天还有 ${mustDoCount} 项必做任务，卡题时直接拍题能减少来回切换。`
        : "遇到不会的题别退出当前节奏，直接拍照识题最快。";
  const primaryCapabilities = lessonWindowActive
    ? ["课前快问", "拍照识题", "分步讲解"]
    : ["拍照识题", "分步讲解", "历史回放"];
  const allCapabilities = ["多图识题", "拖拽裁题", "分步讲解", "编辑重算", "历史回放", "收藏追问"];
  const usageScenarios = lessonWindowActive
    ? [
        "课前最后几分钟核对一道题",
        "课堂中被题目卡住时快速确认",
        "作业临上课前先把关键问题问清",
      ]
    : [
        "作业卡题时先别退出当前节奏",
        "图形题、长题干和错题复盘更适合先拍题",
        "想快速核对答案或看分步讲解时优先使用",
      ];

  function handleLaunch(intent: TutorLaunchIntent | "favorites") {
    trackEvent({
      eventName: "student_tutor_entry_clicked",
      page: "/student",
      props: {
        intent,
        mustDoCount,
        weakPlanCount,
        source: "student-console",
        nextLessonId: nextLesson?.id ?? null,
        nextLessonStatus: nextLesson?.status ?? null
      }
    });
  }

  return (
    <Card title="拍题即问" tag={lessonWindowActive ? "快问优先" : "高优先级"} bodyClassName="student-quick-tutor-body">
      <div className="student-quick-tutor-grid">
        <div className="student-quick-tutor-main">
          <div className="feature-card" style={{ alignItems: "flex-start" }}>
            <EduIcon name="brain" />
            <div>
              <div className="section-title">{lessonWindowActive ? "临近上课，适合快问快答" : "卡住的题，不要退出，直接拍下来问"}</div>
              <p style={{ marginTop: 6 }}>{recommendation}</p>
            </div>
          </div>

          <div className="pill-list">
            {primaryCapabilities.map((item) => (
              <span key={item} className="pill">
                {item}
              </span>
            ))}
          </div>

          <div className="student-quick-tutor-scenario-list">
            {usageScenarios.map((item) => (
              <div key={item} className="student-quick-tutor-scenario-card">
                <div className="workflow-summary-label">现在更适合用在</div>
                <div className="student-quick-tutor-scenario-value">{item}</div>
              </div>
            ))}
          </div>

          <div className="cta-row">
            <Link
              className="button primary"
              href={buildTutorLaunchHref({ intent: "image", source: lessonWindowActive ? "student-console-lesson-window" : "student-console" })}
              onClick={() => handleLaunch("image")}
            >
              拍照识题
            </Link>
            <Link
              className="button secondary"
              href={buildTutorLaunchHref({ intent: "text", source: lessonWindowActive ? "student-console-lesson-window" : "student-console" })}
              onClick={() => handleLaunch("text")}
            >
              文字提问
            </Link>
            <Link
              className="button ghost"
              href={buildTutorLaunchHref({ panel: "history", favorites: true, source: lessonWindowActive ? "student-console-lesson-window" : "student-console" })}
              onClick={() => handleLaunch("favorites")}
            >
              看历史收藏
            </Link>
          </div>

          <details className="workflow-collapsible student-quick-tutor-disclosure">
            <summary>
              <span>展开全部快问能力</span>
              <span className="chip">{`${allCapabilities.length} 项能力`}</span>
            </summary>
            <div className="workflow-collapsible-body">
              <div className="pill-list">
                {allCapabilities.map((item) => (
                  <span key={item} className="pill">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </details>
        </div>

        <div className="student-quick-tutor-side">
          <div className="workflow-summary-card">
            <div className="workflow-summary-label">当前建议</div>
            <div className="student-quick-tutor-side-title">
              {lessonWindowActive ? "优先快问，不再开长练习" : "先把问题问清，再决定要不要展开大任务"}
            </div>
            <div className="workflow-summary-helper" style={{ marginTop: 6 }}>
              {lessonWindowActive
                ? "当前时间窗口更适合快问快答、核对关键步骤和快速识题。"
                : "拍题即问更像一个兜底入口，用最短时间把卡点拿掉，别在首页反复犹豫。"}
            </div>
          </div>

          <div className="student-quick-tutor-metric-grid">
            <div className="student-quick-tutor-metric-card">
              <div className="workflow-summary-label">今日必做</div>
              <div className="student-quick-tutor-metric-value">{mustDoCount}</div>
              <div className="student-quick-tutor-metric-helper">先别被所有任务压住，卡住就先问清一题。</div>
            </div>
            <div className="student-quick-tutor-metric-card">
              <div className="workflow-summary-label">薄弱项</div>
              <div className="student-quick-tutor-metric-value">{weakPlanCount}</div>
              <div className="student-quick-tutor-metric-helper">薄弱点越多，越适合直接拍题减少硬耗时间。</div>
            </div>
          </div>

          {lessonWindowActive ? (
            <div className="student-quick-tutor-lesson-card">
              <div className="workflow-summary-label">距离下节课</div>
              <div className="student-quick-tutor-side-title">
                {nextLesson?.status === "in_progress" ? "进行中" : `${minutesUntilNextLesson ?? 0} 分钟`}
              </div>
              <div className="meta-text" style={{ marginTop: 6 }}>
                {nextLesson?.subjectLabel ?? "课程提醒"}
                {nextLesson?.room ? ` · ${nextLesson.room}` : ""}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";
import WorkspacePage, {
  WorkspaceAuthState,
  WorkspaceEmptyState,
  WorkspaceErrorState,
  WorkspaceLoadingState,
  buildStaleDataNotice,
} from "@/components/WorkspacePage";
import Card from "@/components/Card";
import StatePanel from "@/components/StatePanel";
import { formatLoadedTime } from "@/lib/client-request";
import {
  buildAudienceModeLabel,
  buildDeliveryFormatLabel,
  buildLearningModeLabel,
} from "@/lib/classroom-integration";
import {
  useSchoolInteractiveClassroomsPage,
  type DeliveryActorFilter,
  type DeliveryAudienceFilter,
  type DeliveryKindFilter,
  type DeliveryLearningModeFilter,
} from "./useSchoolInteractiveClassroomsPage";

const fieldStyle = {
  width: "100%",
  padding: 10,
  borderRadius: 10,
  border: "1px solid var(--stroke)",
  background: "var(--card)",
  color: "var(--ink)",
} as const;

type LeaderboardTab = "teachers" | "students" | "resources";

function toTimeLabel(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function actorRoleLabel(value: DeliveryActorFilter) {
  if (value === "student") return "学生自主使用";
  if (value === "school_admin") return "学校管理员发起";
  if (value === "admin") return "平台管理员发起";
  if (value === "teacher") return "教师发起";
  return "全部角色";
}

function buildTeacherManagementHref(input: {
  teacherId?: string | null;
  teacherName?: string | null;
  className?: string | null;
}) {
  const params = new URLSearchParams({
    source: "interactive_classrooms",
    filter: "assigned",
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
  grade?: string | null;
  subject?: string | null;
}) {
  const params = new URLSearchParams({
    source: "interactive_classrooms",
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
  if (input.grade) {
    params.set("grade", input.grade);
  }
  if (input.subject) {
    params.set("subject", input.subject);
  }

  return `/school/classes?${params.toString()}`;
}

function buildScheduleManagementHref(input: {
  classId?: string | null;
  className?: string | null;
  teacherId?: string | null;
  teacherName?: string | null;
}) {
  const params = new URLSearchParams({
    source: "interactive_classrooms",
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

  return `/school/schedules?${params.toString()}`;
}

export default function SchoolInteractiveClassroomsPage() {
  const page = useSchoolInteractiveClassroomsPage();
  const payload = page.payload;
  const [leaderboardTab, setLeaderboardTab] = useState<LeaderboardTab>("teachers");
  const [showAllRecords, setShowAllRecords] = useState(false);

  if (page.loading && !payload && !page.authRequired) {
    return (
      <WorkspaceLoadingState
        title="互动课堂治理中心加载中"
        description="正在汇总学校范围内的发布、导出与学生自主使用记录。"
      />
    );
  }

  if (page.authRequired) {
    return (
      <WorkspaceAuthState
        title="需要学校管理员权限"
        description="请使用学校管理员或平台主管账号登录后查看互动课堂治理中心。"
      />
    );
  }

  if (page.error && !payload) {
    return (
      <WorkspaceErrorState
        title="互动课堂治理中心加载失败"
        description={page.error}
        onRetry={() => {
          void page.loadData("refresh");
        }}
      />
    );
  }

  if (!payload) {
    return (
      <WorkspaceEmptyState
        title="暂无互动课堂治理数据"
        description="当前学校还没有沉淀互动课堂交付记录，后续发布和导出后会自动出现。"
      />
    );
  }

  const topClass = page.topFilteredClasses[0] ?? null;
  const visibleRecords = showAllRecords ? page.filteredRecords : page.filteredRecords.slice(0, 6);
  const remainingRecordCount = Math.max(page.filteredRecords.length - visibleRecords.length, 0);
  const governanceSummaryItems = [
    {
      label: "累计交付",
      value: String(payload.summary.totalDeliveries),
      helper: `${payload.summary.deliveredClassroomCount} 节课堂已形成交付闭环`,
    },
    {
      label: "整班覆盖",
      value: String(payload.summary.wholeClassDeliveryCount),
      helper: `${payload.summary.publishCount} 次全班观看发布`,
    },
    {
      label: "资源沉淀",
      value: String(payload.summary.exportCount),
      helper: `${payload.summary.pptxExportCount} 次 PPTX / ${payload.summary.resourcePackExportCount} 次资源包`,
    },
    {
      label: "学生自学带动",
      value: String(payload.summary.studentInitiatedCount),
      helper: `${payload.summary.teacherInitiatedCount} 次教师发起作为前链路`,
    },
  ];
  const currentViewItems = [
    {
      label: "当前记录",
      value: String(page.filteredSummary.deliveries),
      helper: page.activeFilterLabels.length ? `已启用 ${page.activeFilterLabels.length} 个筛选条件` : "当前查看学校全量视图",
    },
    {
      label: "活跃教师",
      value: String(page.filteredSummary.activeTeachers),
      helper: "按教师维度去重",
    },
    {
      label: "覆盖班级",
      value: String(page.filteredSummary.classes),
      helper: "按班级 / 课堂去重",
    },
    {
      label: "学生自主使用",
      value: String(page.filteredSummary.studentInitiated),
      helper: `当前视图内 ${page.filteredSummary.publishes} 次发布 / ${page.filteredSummary.exports} 次导出`,
    },
  ];

  return (
    <WorkspacePage
      title="互动课堂治理中心"
      subtitle="把课堂发布、课件导出、资源包沉淀与学生自主使用放到同一套学校治理视图里，帮助学校判断真实覆盖、复用效率与产品渗透。"
      lastLoadedAt={page.lastLoadedAt}
      chips={[
        <span key="brand" className="chip">
          航科互动课堂
        </span>,
        <span key="records" className="chip">
          累计 {payload.summary.totalDeliveries} 次交付
        </span>,
      ]}
      actions={
        <>
          <Link className="button ghost" href="/school">
            返回学校控制台
          </Link>
          <button
            className="button secondary"
            type="button"
            onClick={page.exportGovernanceReport}
            disabled={page.loading}
          >
            导出治理报告
          </button>
          <button
            className="button ghost"
            type="button"
            onClick={page.exportFilteredRecordsCsv}
            disabled={page.loading}
          >
            导出筛选明细
          </button>
          <button
            className="button secondary"
            type="button"
            onClick={() => void page.loadData("refresh")}
            disabled={page.loading || page.refreshing}
          >
            {page.refreshing ? "刷新中..." : "刷新"}
          </button>
        </>
      }
      notices={
        page.error
          ? [
              buildStaleDataNotice(
                page.error,
                <button className="button secondary" type="button" onClick={() => void page.loadData("refresh")}>
                  再试一次
                </button>,
              ),
            ]
          : undefined
      }
    >
      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <Card title="学校治理摘要" tag="运营">
          <div className="grid" style={{ gap: 14 }}>
            <div className="workflow-summary-grid">
              {governanceSummaryItems.map((item) => (
                <div key={item.label} className="workflow-summary-card">
                  <div className="workflow-summary-label">{item.label}</div>
                  <div className="workflow-summary-value">{item.value}</div>
                  <div className="workflow-summary-helper">{item.helper}</div>
                </div>
              ))}
            </div>
            <div className="workflow-card-meta">
              <span className="pill">覆盖课堂教学、课前预习、学科巩固与兴趣培养</span>
              <span className="pill">全班观看发布与导出归档统一治理</span>
              <span className="pill">支持按当前视图导出报告与明细</span>
            </div>
          </div>
        </Card>

        <Card title="当前视图摘要" tag="视图">
          <div className="grid" style={{ gap: 14 }}>
            <div className="workflow-summary-grid">
              {currentViewItems.map((item) => (
                <div key={item.label} className="workflow-summary-card">
                  <div className="workflow-summary-label">{item.label}</div>
                  <div className="workflow-summary-value">{item.value}</div>
                  <div className="workflow-summary-helper">{item.helper}</div>
                </div>
              ))}
            </div>
            <div className="card" style={{ padding: 14 }}>
              <div className="section-title">
                {page.activeFilterLabels.length ? "当前已锁定的观察范围" : "当前正在查看学校范围内的全部互动课堂交付记录"}
              </div>
              <div style={{ marginTop: 8, fontSize: 13, color: "var(--ink-1)", lineHeight: 1.8 }}>
                {topClass
                  ? `当前最热班级为 ${topClass.className}，累计 ${topClass.count} 次互动课堂交付，最近一次发生在 ${toTimeLabel(topClass.lastDeliveredAt)}。`
                  : "暂时还没有可识别的热点班级，可先让老师完成发布或导出后再观察学校扩散速度。"}
              </div>
              <div className="workflow-card-meta" style={{ marginTop: 10 }}>
                {(page.activeFilterLabels.length ? page.activeFilterLabels : ["全校全量视图"]).slice(0, 4).map((label) => (
                  <span key={label} className="pill">
                    {label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </Card>
      </div>

      <Card title="快速筛选" tag="治理">
        <div className="grid" style={{ gap: 14 }}>
          <div className="grid grid-2" style={{ alignItems: "end" }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span className="section-sub">搜索课堂 / 班级 / 发起人 / 标签</span>
              <input
                value={page.keyword}
                onChange={(event) => page.setKeyword(event.target.value)}
                placeholder="搜索班级、课堂、教师、学习者或交付标签"
                aria-label="搜索互动课堂交付记录"
                style={fieldStyle}
              />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span className="section-sub">发起角色</span>
              <select
                value={page.actorFilter}
                onChange={(event) => page.setActorFilter(event.target.value as DeliveryActorFilter)}
                style={fieldStyle}
              >
                <option value="all">全部角色</option>
                {payload.filterOptions.actorRoles.map((item) => (
                  <option key={item} value={item}>
                    {actorRoleLabel(item)}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span className="section-sub">交付动作</span>
              <select
                value={page.kindFilter}
                onChange={(event) => page.setKindFilter(event.target.value as DeliveryKindFilter)}
                style={fieldStyle}
              >
                <option value="all">全部动作</option>
                <option value="publish">全班观看发布</option>
                <option value="export">导出归档</option>
              </select>
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span className="section-sub">观看方式</span>
              <select
                value={page.audienceFilter}
                onChange={(event) => page.setAudienceFilter(event.target.value as DeliveryAudienceFilter)}
                style={fieldStyle}
              >
                <option value="all">全部方式</option>
                <option value="whole-class">全班观看</option>
                <option value="teacher-private">私享启动</option>
              </select>
            </label>
          </div>

          <div className="cta-row">
            <button className="button ghost" type="button" onClick={page.clearFilters}>
              清空筛选
            </button>
            <button className="button secondary" type="button" onClick={page.exportFilteredRecordsCsv} disabled={page.loading}>
              导出当前明细
            </button>
            <span className="chip">筛选后 {page.filteredRecords.length} 条记录</span>
            <span className="chip">高级条件可按需展开</span>
          </div>

          {page.activeFilterLabels.length ? (
            <div className="workflow-card-meta">
              {page.activeFilterLabels.map((label) => (
                <span key={label} className="pill">
                  {label}
                </span>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: "var(--ink-1)" }}>当前未启用额外筛选，正在查看学校范围内的全量数据。</div>
          )}

          <details className="workflow-collapsible">
            <summary>
              <span>展开高级筛选</span>
              <span className="chip">课堂模式 / 学科 / 年级 / 班级</span>
            </summary>
            <div className="workflow-collapsible-body">
              <div className="grid grid-2" style={{ alignItems: "end" }}>
                <label style={{ display: "grid", gap: 6 }}>
                  <span className="section-sub">课堂模式</span>
                  <select
                    value={page.learningModeFilter}
                    onChange={(event) => page.setLearningModeFilter(event.target.value as DeliveryLearningModeFilter)}
                    style={fieldStyle}
                  >
                    <option value="all">全部模式</option>
                    <option value="teacher-led">课堂教学</option>
                    <option value="preview-preparation">课前预习</option>
                    <option value="subject-reinforcement">学科巩固</option>
                    <option value="interest-cultivation">兴趣培养</option>
                    <option value="classroom-review">课堂回看</option>
                  </select>
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <span className="section-sub">学科</span>
                  <select
                    value={page.subjectFilter}
                    onChange={(event) => page.setSubjectFilter(event.target.value)}
                    style={fieldStyle}
                  >
                    <option value="all">全部学科</option>
                    {payload.filterOptions.subjects.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <span className="section-sub">年级</span>
                  <select
                    value={page.gradeFilter}
                    onChange={(event) => page.setGradeFilter(event.target.value)}
                    style={fieldStyle}
                  >
                    <option value="all">全部年级</option>
                    {payload.filterOptions.grades.map((item) => (
                      <option key={item} value={item}>
                        {item} 年级
                      </option>
                    ))}
                  </select>
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <span className="section-sub">班级</span>
                  <select
                    value={page.classNameFilter}
                    onChange={(event) => page.setClassNameFilter(event.target.value)}
                    style={fieldStyle}
                  >
                    <option value="all">全部班级</option>
                    {payload.filterOptions.classNames.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          </details>
        </div>
      </Card>

      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <Card title="治理建议" tag="优化">
          <div className="grid" style={{ gap: 10 }}>
            {page.governanceTips.map((tip) => (
              <div
                key={tip}
                style={{
                  border: "1px solid var(--stroke)",
                  borderRadius: 12,
                  padding: "12px 14px",
                  background: "rgba(2, 132, 199, 0.04)",
                  lineHeight: 1.7,
                  fontSize: 14,
                }}
              >
                {tip}
              </div>
            ))}
            <div className="cta-row">
              <Link className="button secondary" href="/teacher/ai-tools">
                进入教师互动工具台
              </Link>
              <Link className="button ghost" href="/school/teachers?source=interactive_classrooms&filter=assigned">
                查看教师治理
              </Link>
              <Link className="button ghost" href="/school/classes?source=interactive_classrooms">
                查看班级治理
              </Link>
              <Link className="button ghost" href="/ai-classroom">
                打开互动课堂工作区
              </Link>
            </div>
          </div>
        </Card>

        <Card title="热点班级" tag="热点">
          {page.topFilteredClasses.length ? (
            <div className="grid" style={{ gap: 10 }}>
              {page.topFilteredClasses.slice(0, 4).map((item) => (
                <div
                  key={item.key}
                  style={{
                    border: "1px solid var(--stroke)",
                    borderRadius: 12,
                    padding: "10px 12px",
                    background: "rgba(15, 23, 42, 0.02)",
                  }}
                >
                  <div className="section-title">{item.className}</div>
                  <div style={{ fontSize: 12, color: "var(--ink-1)", marginTop: 4 }}>
                    {item.subject || "未标注学科"}
                    {item.grade ? ` · ${item.grade} 年级` : ""}
                  </div>
                  <div className="cta-row cta-row-tight" style={{ marginTop: 8, flexWrap: "wrap" }}>
                    <span className="pill">累计 {item.count} 次</span>
                    <span className="pill">最近 {toTimeLabel(item.lastDeliveredAt)}</span>
                  </div>
                  <div className="cta-row" style={{ marginTop: 10 }}>
                    <Link
                      className="button ghost"
                      href={buildClassManagementHref({
                        classId: item.classId,
                        className: item.className,
                        grade: item.grade,
                        subject: item.subject,
                      })}
                    >
                      查看班级治理
                    </Link>
                    <Link
                      className="button ghost"
                      href={buildScheduleManagementHref({
                        classId: item.classId,
                        className: item.className,
                      })}
                    >
                      查看排课执行
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <StatePanel
              compact
              tone="empty"
              title="当前筛选下还没有热点班级"
              description="试试放宽筛选条件，或让老师先发布/导出更多互动课堂。"
            />
          )}
        </Card>
      </div>

      <Card title="采用与沉淀榜" tag="榜单">
        <div className="grid" style={{ gap: 14 }}>
          <div className="workflow-tab-list">
            <button
              className={`workflow-tab-button${leaderboardTab === "teachers" ? " is-active" : ""}`}
              type="button"
              onClick={() => setLeaderboardTab("teachers")}
            >
              教师采用榜
            </button>
            <button
              className={`workflow-tab-button${leaderboardTab === "students" ? " is-active" : ""}`}
              type="button"
              onClick={() => setLeaderboardTab("students")}
            >
              学生自主带动榜
            </button>
            <button
              className={`workflow-tab-button${leaderboardTab === "resources" ? " is-active" : ""}`}
              type="button"
              onClick={() => setLeaderboardTab("resources")}
            >
              资源沉淀榜
            </button>
          </div>

          {leaderboardTab === "teachers" ? (
            page.teacherAdoptionLeaders.length ? (
              <div className="grid grid-2" style={{ alignItems: "start" }}>
                {page.teacherAdoptionLeaders.map((item, index) => (
                  <div
                    key={item.key}
                    className="workflow-spotlight-card"
                    style={{ background: "rgba(2, 132, 199, 0.04)" }}
                  >
                    <div className="cta-row" style={{ justifyContent: "space-between", gap: 10 }}>
                      <div className="section-title">{`${index + 1}. ${item.teacherName}`}</div>
                      <span className="pill">交付 {item.deliveryCount}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--ink-1)", marginTop: 4 }}>
                      {item.subject || "未标注学科"}
                      {item.grade ? ` · ${item.grade} 年级` : ""}
                    </div>
                    <div className="cta-row cta-row-tight" style={{ marginTop: 8, flexWrap: "wrap" }}>
                      <span className="pill">全班观看 {item.wholeClassCount}</span>
                      <span className="pill">导出 {item.exportCount}</span>
                      <span className="pill">学生自主 {item.studentInitiatedCount}</span>
                    </div>
                    <div className="cta-row" style={{ marginTop: 10 }}>
                      <Link
                        className="button ghost"
                        href={buildTeacherManagementHref({
                          teacherId: item.teacherId,
                          teacherName: item.teacherName,
                        })}
                      >
                        查看教师治理
                      </Link>
                      <Link
                        className="button ghost"
                        href={buildClassManagementHref({
                          teacherId: item.teacherId,
                          teacherName: item.teacherName,
                          grade: item.grade,
                          subject: item.subject,
                        })}
                      >
                        查看关联班级
                      </Link>
                      <Link
                        className="button ghost"
                        href={buildScheduleManagementHref({
                          teacherId: item.teacherId,
                          teacherName: item.teacherName,
                        })}
                      >
                        查看排课执行
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <StatePanel
                compact
                tone="empty"
                title="暂无教师采用榜数据"
                description="当前筛选下还没有形成可识别的教师采用画像。"
              />
            )
          ) : null}

          {leaderboardTab === "students" ? (
            page.studentMomentumLeaders.length ? (
              <div className="grid grid-2" style={{ alignItems: "start" }}>
                {page.studentMomentumLeaders.map((item, index) => (
                  <div
                    key={item.key}
                    className="workflow-spotlight-card"
                    style={{ background: "rgba(16, 185, 129, 0.05)" }}
                  >
                    <div className="cta-row" style={{ justifyContent: "space-between", gap: 10 }}>
                      <div className="section-title">{`${index + 1}. ${item.teacherName}`}</div>
                      <span className="pill">自主 {item.studentInitiatedCount}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--ink-1)", marginTop: 4, lineHeight: 1.7 }}>
                      学生从该教师关联课堂中自主进入或导出的次数，可用于判断课后巩固和兴趣培养的真实带动效果。
                    </div>
                    <div className="cta-row cta-row-tight" style={{ marginTop: 8, flexWrap: "wrap" }}>
                      <span className="pill">累计交付 {item.deliveryCount}</span>
                      <span className="pill">全班观看 {item.publishCount}</span>
                      <span className="pill">资源包 {item.resourcePackCount}</span>
                    </div>
                    <div className="cta-row" style={{ marginTop: 10 }}>
                      <Link
                        className="button ghost"
                        href={buildTeacherManagementHref({
                          teacherId: item.teacherId,
                          teacherName: item.teacherName,
                        })}
                      >
                        查看教师治理
                      </Link>
                      <Link
                        className="button ghost"
                        href={buildScheduleManagementHref({
                          teacherId: item.teacherId,
                          teacherName: item.teacherName,
                        })}
                      >
                        查看排课执行
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <StatePanel
                compact
                tone="empty"
                title="暂无学生自主带动数据"
                description="可以继续把互动课堂开放到学生侧，用于学科巩固和兴趣培养。"
              />
            )
          ) : null}

          {leaderboardTab === "resources" ? (
            page.resourcePackLeaders.length ? (
              <div className="grid grid-2" style={{ alignItems: "start" }}>
                {page.resourcePackLeaders.map((item, index) => (
                  <div
                    key={item.key}
                    className="workflow-spotlight-card"
                    style={{ background: "rgba(249, 115, 22, 0.05)" }}
                  >
                    <div className="cta-row" style={{ justifyContent: "space-between", gap: 10 }}>
                      <div className="section-title">{`${index + 1}. ${item.classroomName}`}</div>
                      <span className="pill">资源包 {item.resourcePackCount}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--ink-1)", marginTop: 4 }}>
                      {item.teacherName ? `教师：${item.teacherName}` : "未标注教师"}
                      {item.subject ? ` · ${item.subject}` : ""}
                      {item.grade ? ` · ${item.grade} 年级` : ""}
                    </div>
                    <div className="cta-row cta-row-tight" style={{ marginTop: 8, flexWrap: "wrap" }}>
                      <span className="pill">PPTX {item.pptxExportCount}</span>
                      <span className="pill">总导出 {item.totalExports}</span>
                      <span className="pill">全班观看 {item.wholeClassCount}</span>
                    </div>
                    <div className="cta-row" style={{ marginTop: 10 }}>
                      <Link
                        className="button ghost"
                        href={buildClassManagementHref({
                          classId: item.classId,
                          className: item.className || item.classroomName,
                          teacherId: item.teacherId,
                          teacherName: item.teacherName,
                          grade: item.grade,
                          subject: item.subject,
                        })}
                      >
                        查看班级治理
                      </Link>
                      <Link
                        className="button ghost"
                        href={buildScheduleManagementHref({
                          classId: item.classId,
                          className: item.className || item.classroomName,
                          teacherId: item.teacherId,
                          teacherName: item.teacherName,
                        })}
                      >
                        查看排课执行
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <StatePanel
                compact
                tone="empty"
                title="暂无资源沉淀榜数据"
                description="还没有检测到资源包或有效导出沉淀，可先推动优质课堂归档。"
              />
            )
          ) : null}
        </div>
      </Card>

      <Card title={`交付台账（${page.filteredRecords.length}）`} tag="明细">
        {page.filteredRecords.length ? (
          <div className="grid" style={{ gap: 12 }}>
            <div className="cta-row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 13, color: "var(--ink-1)", lineHeight: 1.7 }}>
                默认先展示最近的重点记录，避免台账首屏过长；需要时可以一键展开全部明细。
              </div>
              {page.filteredRecords.length > 6 ? (
                <button
                  className="button ghost"
                  type="button"
                  onClick={() => setShowAllRecords((value) => !value)}
                >
                  {showAllRecords ? "收起长列表" : `展开全部 ${page.filteredRecords.length} 条`}
                </button>
              ) : null}
            </div>

            {visibleRecords.map((record) => (
              <div className="card" key={record.id}>
                <div
                  className="cta-row"
                  style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div className="section-title">{record.className || record.stageName}</div>
                    <div style={{ fontSize: 13, color: "var(--ink-1)", marginTop: 4, lineHeight: 1.7 }}>
                      {record.label} · {buildDeliveryFormatLabel(record.format)} · {toTimeLabel(record.createdAt)}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--ink-1)", marginTop: 4, lineHeight: 1.7 }}>
                      发起人：{record.actorName || record.actorUserId}
                      {record.teacherName ? ` · 教师：${record.teacherName}` : ""}
                      {record.learnerName ? ` · 学习者：${record.learnerName}` : ""}
                      {record.fileName ? ` · 文件：${record.fileName}` : ""}
                    </div>
                  </div>
                  <span className="pill">{actorRoleLabel(record.actorRole)}</span>
                </div>

                <div className="cta-row" style={{ marginTop: 10, gap: 8, flexWrap: "wrap" }}>
                  {record.subject ? <span className="pill">{record.subject}</span> : null}
                  {record.grade ? <span className="pill">{record.grade} 年级</span> : null}
                  {record.audienceMode ? <span className="pill">{buildAudienceModeLabel(record.audienceMode)}</span> : null}
                  {record.learningMode ? <span className="pill">{buildLearningModeLabel(record.learningMode)}</span> : null}
                  {record.studentCount ? <span className="pill">覆盖 {record.studentCount} 人</span> : null}
                </div>

                <div className="cta-row" style={{ marginTop: 10, gap: 8, flexWrap: "wrap" }}>
                  <Link
                    className="button ghost"
                    href={buildClassManagementHref({
                      classId: record.classId,
                      className: record.className || record.stageName,
                      teacherId: record.teacherId,
                      teacherName: record.teacherName,
                      grade: record.grade,
                      subject: record.subject,
                    })}
                  >
                    查看班级治理
                  </Link>
                  <Link
                    className="button ghost"
                    href={buildScheduleManagementHref({
                      classId: record.classId,
                      className: record.className || record.stageName,
                      teacherId: record.teacherId,
                      teacherName: record.teacherName,
                    })}
                  >
                    查看排课执行
                  </Link>
                  {record.teacherName || record.teacherId ? (
                    <Link
                      className="button ghost"
                      href={buildTeacherManagementHref({
                        teacherId: record.teacherId,
                        teacherName: record.teacherName,
                        className: record.className || record.stageName,
                      })}
                    >
                      查看教师治理
                    </Link>
                  ) : null}
                  {record.publishedUrl ? (
                    <a className="button ghost" href={record.publishedUrl} target="_blank" rel="noreferrer">
                      打开观看页
                    </a>
                  ) : null}
                </div>
              </div>
            ))}
            {remainingRecordCount > 0 ? (
              <div className="card" style={{ padding: 14 }}>
                <div className="section-title">还有 {remainingRecordCount} 条记录暂未展开</div>
                <div style={{ marginTop: 6, fontSize: 13, color: "var(--ink-1)", lineHeight: 1.7 }}>
                  点击“展开全部”可以查看完整台账，或继续使用筛选把视图聚焦到某个年级、学科或课堂模式。
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <StatePanel
            title="当前筛选下没有交付记录"
            description="可以清空筛选，或先让教师/学生继续使用互动课堂以沉淀更多数据。"
            tone="empty"
            action={
              <button className="button secondary" type="button" onClick={page.clearFilters}>
                清空筛选
              </button>
            }
          />
        )}
      </Card>

      <Card title="数据口径说明" tag="说明">
        <details className="workflow-collapsible">
          <summary>
            <span>展开数据口径说明</span>
            <span className="chip">记录来源 / 更新时间</span>
          </summary>
          <div className="workflow-collapsible-body">
            <div className="grid grid-2" style={{ alignItems: "start" }}>
              <div className="card">
                <div className="section-title">记录来源</div>
                <div style={{ fontSize: 13, color: "var(--ink-1)", marginTop: 6, lineHeight: 1.8 }}>
                  当前口径覆盖互动课堂发布全班观看地址、PPTX 导出、资源包导出，以及学生自主使用触发的课堂交付动作。所有数据来自服务端台账而非浏览器本地缓存。
                </div>
              </div>
              <div className="card">
                <div className="section-title">更新时间</div>
                <div style={{ fontSize: 13, color: "var(--ink-1)", marginTop: 6, lineHeight: 1.8 }}>
                  {page.lastLoadedAt
                    ? `最近一次刷新时间：${formatLoadedTime(page.lastLoadedAt)}。如果学校首页已操作但这里未更新，可手动刷新，或直接导出当前筛选视图用于汇报。`
                    : "当前还没有拉取到治理时间戳。"}
                </div>
              </div>
            </div>
          </div>
        </details>
      </Card>
    </WorkspacePage>
  );
}

import Link from "next/link";
import Card from "@/components/Card";
import type { SchoolClassRecord } from "@/lib/school-admin-types";
import type { SchoolScheduleTemplate } from "@/lib/school-schedule-templates";
import type { TeacherScheduleRule } from "@/lib/teacher-schedule-rules";

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

type SchoolSchedulesCoverageCardProps = {
  classes: SchoolClassRecord[];
  scheduleCountByClass: Map<string, number>;
  lockedCountByClass: Map<string, number>;
  templateByKey: Map<string, SchoolScheduleTemplate>;
  teacherRuleByTeacherId: Map<string, TeacherScheduleRule>;
  startCreateForClass: (classId: string) => void;
  focusClassInWeekView: (classId: string) => void;
  formatTeacherRuleSummary: (rule: TeacherScheduleRule) => string;
};

export function SchoolSchedulesCoverageCard({
  classes,
  scheduleCountByClass,
  lockedCountByClass,
  templateByKey,
  teacherRuleByTeacherId,
  startCreateForClass,
  focusClassInWeekView,
  formatTeacherRuleSummary
}: SchoolSchedulesCoverageCardProps) {
  return (
    <Card title="班级排课状态" tag="覆盖">
      <div className="grid" style={{ gap: 10 }}>
        {classes.map((item) => {
          const scheduleCount = scheduleCountByClass.get(item.id) ?? 0;
          const hasSchedule = scheduleCount > 0;
          return (
            <div className="card" key={item.id}>
              <div className="cta-row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                <div>
                  <div className="section-title">{item.name}</div>
                  <div className="section-sub" style={{ marginTop: 4 }}>
                    {item.subject} · {item.grade} 年级 · 教师 {item.teacherName ?? item.teacherId ?? "未绑定"}
                  </div>
                  <div className="meta-text" style={{ marginTop: 6 }}>
                    当前已排 {scheduleCount} 节/周
                    {(lockedCountByClass.get(item.id) ?? 0) ? `（锁定 ${lockedCountByClass.get(item.id) ?? 0} 节）` : ""} · 作业 {item.assignmentCount} 份 · 学生 {item.studentCount} 人
                  </div>
                  {item.teacherId && teacherRuleByTeacherId.get(item.teacherId) ? (
                    <div className="meta-text" style={{ marginTop: 6 }}>
                      教师规则：{formatTeacherRuleSummary(teacherRuleByTeacherId.get(item.teacherId)!)}
                    </div>
                  ) : null}
                  <div className="badge-row" style={{ marginTop: 8 }}>
                    <span className="badge">{templateByKey.has(`${item.grade}:${item.subject}`) ? "已配模板" : "缺模板"}</span>
                    <span className="badge">
                      {item.teacherId ? (teacherRuleByTeacherId.get(item.teacherId) ? "已配规则" : "缺规则") : "未绑教师"}
                    </span>
                  </div>
                </div>
                <span className="pill">{hasSchedule ? `${scheduleCount} 节/周` : "待排课"}</span>
              </div>
              <div className="cta-row" style={{ marginTop: 10, flexWrap: "wrap" }}>
                <Link
                  className="button ghost"
                  href={buildClassManagementHref({
                    classId: item.id,
                    className: item.name,
                    teacherId: item.teacherId,
                    teacherName: item.teacherName ?? null
                  })}
                >
                  查看班级治理
                </Link>
                {item.teacherId ? (
                  <Link
                    className="button ghost"
                    href={buildTeacherManagementHref({
                      teacherId: item.teacherId,
                      teacherName: item.teacherName ?? null,
                      className: item.name
                    })}
                  >
                    查看教师治理
                  </Link>
                ) : null}
                <button className="button secondary" type="button" onClick={() => startCreateForClass(item.id)}>
                  为该班排课
                </button>
                <button className="button ghost" type="button" onClick={() => focusClassInWeekView(item.id)}>
                  查看该班周视图
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

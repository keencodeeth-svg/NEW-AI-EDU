"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildAudienceModeLabel,
  buildDeliveryFormatLabel,
  buildLearningModeLabel,
  PRODUCT_BRAND_NAME,
  type ClassroomDeliveryActorRole,
  type ClassroomDeliveryAuditRecord,
  type ClassroomDeliveryKind,
  type SchoolClassroomDeliveryDetailPayload,
} from "@/lib/classroom-integration";
import { requestJson } from "@/lib/client-request";
import type { SchoolClassroomDeliveryDetailResponse } from "../types";
import { getSchoolAdminRequestMessage, isSchoolAdminAuthRequiredError } from "../utils";

export type DeliveryActorFilter = "all" | ClassroomDeliveryActorRole;
export type DeliveryKindFilter = "all" | ClassroomDeliveryKind;
export type DeliveryAudienceFilter = "all" | "teacher-private" | "whole-class";
export type DeliveryLearningModeFilter =
  | "all"
  | "teacher-led"
  | "preview-preparation"
  | "subject-reinforcement"
  | "interest-cultivation"
  | "classroom-review";

type TeacherGovernanceLeader = {
  key: string;
  teacherId?: string;
  teacherName: string;
  subject?: string;
  grade?: string;
  deliveryCount: number;
  publishCount: number;
  exportCount: number;
  wholeClassCount: number;
  studentInitiatedCount: number;
  resourcePackCount: number;
  lastDeliveredAt: string;
};

type ResourceGovernanceLeader = {
  key: string;
  classId?: string;
  classroomName: string;
  className?: string;
  stageName?: string;
  subject?: string;
  grade?: string;
  teacherId?: string;
  teacherName?: string;
  resourcePackCount: number;
  pptxExportCount: number;
  totalExports: number;
  wholeClassCount: number;
  lastDeliveredAt: string;
};

function normalizeKeyword(value: string) {
  return value.trim().toLowerCase();
}

function toTimestamp(value?: string | null) {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function formatExportTimestamp(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function buildDownloadName(prefix: string, extension: string) {
  const now = new Date();
  const parts = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    "-",
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
  ];
  return `${prefix}-${parts.join("")}.${extension}`;
}

function downloadTextFile(fileName: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function escapeCsvCell(value: unknown) {
  const text = String(value ?? "");
  if (!text) return "";
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, "\"\"")}"`;
  }
  return text;
}

function buildCsvContent(header: string[], rows: string[][]) {
  return [header, ...rows].map((row) => row.map((cell) => escapeCsvCell(cell)).join(",")).join("\n");
}

function buildDeliverySearchText(record: ClassroomDeliveryAuditRecord) {
  return [
    record.className,
    record.stageName,
    record.subject,
    record.grade,
    record.actorName,
    record.teacherName,
    record.learnerName,
    record.label,
    buildAudienceModeLabel(record.audienceMode),
    buildLearningModeLabel(record.learningMode),
    buildDeliveryFormatLabel(record.format),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function buildActorFilterLabel(value: DeliveryActorFilter) {
  if (value === "student") return "学生自主使用";
  if (value === "school_admin") return "学校管理员发起";
  if (value === "admin") return "平台管理员发起";
  if (value === "teacher") return "教师发起";
  return "全部角色";
}

function buildDeliveryKindLabel(value: DeliveryKindFilter | ClassroomDeliveryKind) {
  if (value === "publish") return "全班观看发布";
  return "导出归档";
}

function buildAudienceFilterLabel(value: DeliveryAudienceFilter) {
  if (value === "teacher-private") return "私享启动";
  if (value === "whole-class") return "全班观看";
  return "全部方式";
}

function buildLearningModeFilterLabel(value: DeliveryLearningModeFilter) {
  if (value === "preview-preparation") return "课前预习";
  if (value === "subject-reinforcement") return "学科巩固";
  if (value === "interest-cultivation") return "兴趣培养";
  if (value === "classroom-review") return "课堂回看";
  if (value === "teacher-led") return "课堂教学";
  return "全部模式";
}

function resolveTeacherIdentity(record: ClassroomDeliveryAuditRecord) {
  const teacherId = record.teacherId?.trim() || (record.actorRole === "teacher" ? record.actorUserId : undefined);
  const teacherName =
    record.teacherName?.trim() ||
    (record.actorRole === "teacher" ? record.actorName?.trim() : undefined) ||
    (teacherId && record.className ? `${record.className}任课教师` : undefined) ||
    (teacherId ? `教师 ${teacherId.slice(-4)}` : undefined);

  if (!teacherId && !teacherName) {
    return null;
  }

  return {
    key: teacherId || teacherName || record.actorUserId,
    teacherId,
    teacherName: teacherName || "未命名教师",
  };
}

function buildTeacherLeaders(records: ClassroomDeliveryAuditRecord[]) {
  const grouped = new Map<string, TeacherGovernanceLeader>();

  records.forEach((record) => {
    const identity = resolveTeacherIdentity(record);
    if (!identity) return;

    const current = grouped.get(identity.key);
    if (current) {
      current.deliveryCount += 1;
      current.publishCount += record.kind === "publish" ? 1 : 0;
      current.exportCount += record.kind === "export" ? 1 : 0;
      current.wholeClassCount += record.audienceMode === "whole-class" ? 1 : 0;
      current.studentInitiatedCount += record.actorRole === "student" ? 1 : 0;
      current.resourcePackCount += record.format === "resource-pack" ? 1 : 0;
      if (!current.subject && record.subject) {
        current.subject = record.subject;
      }
      if (!current.grade && record.grade) {
        current.grade = record.grade;
      }
      if (toTimestamp(record.createdAt) > toTimestamp(current.lastDeliveredAt)) {
        current.lastDeliveredAt = record.createdAt;
      }
      return;
    }

    grouped.set(identity.key, {
      key: identity.key,
      teacherId: identity.teacherId,
      teacherName: identity.teacherName,
      subject: record.subject,
      grade: record.grade,
      deliveryCount: 1,
      publishCount: record.kind === "publish" ? 1 : 0,
      exportCount: record.kind === "export" ? 1 : 0,
      wholeClassCount: record.audienceMode === "whole-class" ? 1 : 0,
      studentInitiatedCount: record.actorRole === "student" ? 1 : 0,
      resourcePackCount: record.format === "resource-pack" ? 1 : 0,
      lastDeliveredAt: record.createdAt,
    });
  });

  return Array.from(grouped.values());
}

function buildResourceLeaders(records: ClassroomDeliveryAuditRecord[]) {
  const grouped = new Map<string, ResourceGovernanceLeader>();

  records.forEach((record) => {
    const key = record.stageId || record.classId || record.className || record.id;
    const classroomName = record.className || record.stageName || "未命名互动课堂";
    const current = grouped.get(key);

    if (current) {
      current.totalExports += record.kind === "export" ? 1 : 0;
      current.resourcePackCount += record.kind === "export" && record.format === "resource-pack" ? 1 : 0;
      current.pptxExportCount += record.kind === "export" && record.format === "pptx" ? 1 : 0;
      current.wholeClassCount += record.kind === "publish" && record.audienceMode === "whole-class" ? 1 : 0;
      if (!current.classId && record.classId) {
        current.classId = record.classId;
      }
      if (!current.teacherId && record.teacherId) {
        current.teacherId = record.teacherId;
      }
      if (!current.teacherName && record.teacherName) {
        current.teacherName = record.teacherName;
      }
      if (!current.subject && record.subject) {
        current.subject = record.subject;
      }
      if (!current.grade && record.grade) {
        current.grade = record.grade;
      }
      if (toTimestamp(record.createdAt) > toTimestamp(current.lastDeliveredAt)) {
        current.lastDeliveredAt = record.createdAt;
      }
      return;
    }

    grouped.set(key, {
      key,
      classId: record.classId,
      classroomName,
      className: record.className,
      stageName: record.stageName,
      subject: record.subject,
      grade: record.grade,
      teacherId: record.teacherId,
      teacherName: record.teacherName,
      resourcePackCount: record.kind === "export" && record.format === "resource-pack" ? 1 : 0,
      pptxExportCount: record.kind === "export" && record.format === "pptx" ? 1 : 0,
      totalExports: record.kind === "export" ? 1 : 0,
      wholeClassCount: record.kind === "publish" && record.audienceMode === "whole-class" ? 1 : 0,
      lastDeliveredAt: record.createdAt,
    });
  });

  return Array.from(grouped.values());
}

function buildMarkdownBulletLines(items: string[]) {
  if (!items.length) {
    return "- 暂无";
  }
  return items.map((item) => `- ${item}`).join("\n");
}

type AuthMeResponse = {
  user?: {
    role?: string | null;
  } | null;
};

export function useSchoolInteractiveClassroomsPage() {
  const loadRequestIdRef = useRef(0);
  const [payload, setPayload] = useState<SchoolClassroomDeliveryDetailPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);
  const [keyword, setKeyword] = useState("");
  const [actorFilter, setActorFilter] = useState<DeliveryActorFilter>("all");
  const [kindFilter, setKindFilter] = useState<DeliveryKindFilter>("all");
  const [audienceFilter, setAudienceFilter] = useState<DeliveryAudienceFilter>("all");
  const [learningModeFilter, setLearningModeFilter] = useState<DeliveryLearningModeFilter>("all");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [classNameFilter, setClassNameFilter] = useState("all");

  const loadData = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    const requestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = requestId;

    if (mode === "refresh") {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const authPayload = await requestJson<AuthMeResponse>("/api/auth/me");
      const currentRole = authPayload.user?.role ?? null;

      if (!authPayload.user || (currentRole !== "school_admin" && currentRole !== "admin")) {
        setAuthRequired(true);
        setPayload(null);
        return;
      }

      const response = await requestJson<SchoolClassroomDeliveryDetailResponse>(
        "/api/school/classroom-deliveries/detail",
      );
      if (loadRequestIdRef.current !== requestId) {
        return;
      }
      setPayload(response.data ?? null);
      setAuthRequired(false);
      setLastLoadedAt(new Date().toISOString());
    } catch (nextError) {
      if (loadRequestIdRef.current !== requestId) {
        return;
      }
      if (isSchoolAdminAuthRequiredError(nextError)) {
        setAuthRequired(true);
        setPayload(null);
      } else {
        setError(getSchoolAdminRequestMessage(nextError, "加载课堂质量中心失败"));
      }
    } finally {
      if (loadRequestIdRef.current === requestId) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredRecords = useMemo(() => {
    const records = payload?.records ?? [];
    const keywordText = normalizeKeyword(keyword);

    return records.filter((record) => {
      if (actorFilter !== "all" && record.actorRole !== actorFilter) return false;
      if (kindFilter !== "all" && record.kind !== kindFilter) return false;
      if (audienceFilter !== "all" && record.audienceMode !== audienceFilter) return false;
      if (learningModeFilter !== "all" && record.learningMode !== learningModeFilter) return false;
      if (subjectFilter !== "all" && record.subject !== subjectFilter) return false;
      if (gradeFilter !== "all" && record.grade !== gradeFilter) return false;
      if (classNameFilter !== "all" && (record.className || record.stageName) !== classNameFilter) return false;
      if (!keywordText) return true;
      return buildDeliverySearchText(record).includes(keywordText);
    });
  }, [
    actorFilter,
    audienceFilter,
    classNameFilter,
    gradeFilter,
    kindFilter,
    keyword,
    learningModeFilter,
    payload?.records,
    subjectFilter,
  ]);

  const filteredSummary = useMemo(() => {
    const records = filteredRecords;
    const teacherKeys = new Set(
      records
        .map((item) => resolveTeacherIdentity(item)?.key)
        .filter((value): value is string => Boolean(value)),
    );
    return {
      deliveries: records.length,
      publishes: records.filter((item) => item.kind === "publish").length,
      exports: records.filter((item) => item.kind === "export").length,
      studentInitiated: records.filter((item) => item.actorRole === "student").length,
      wholeClass: records.filter((item) => item.audienceMode === "whole-class").length,
      classes: new Set(records.map((item) => item.classId || item.className || item.stageId)).size,
      subjects: new Set(records.map((item) => item.subject).filter(Boolean)).size,
      activeTeachers: teacherKeys.size,
      resourcePackExports: records.filter((item) => item.kind === "export" && item.format === "resource-pack").length,
      pptxExports: records.filter((item) => item.kind === "export" && item.format === "pptx").length,
    };
  }, [filteredRecords]);

  const topFilteredClasses = useMemo(() => {
    const grouped = new Map<
      string,
      {
        key: string;
        classId?: string;
        className: string;
        subject?: string;
        grade?: string;
        count: number;
        lastDeliveredAt: string;
      }
    >();

    filteredRecords.forEach((record) => {
      const key = record.classId || record.className || record.stageId;
      const current = grouped.get(key);
      if (current) {
        current.count += 1;
        if (!current.classId && record.classId) {
          current.classId = record.classId;
        }
        if (toTimestamp(record.createdAt) > toTimestamp(current.lastDeliveredAt)) {
          current.lastDeliveredAt = record.createdAt;
        }
        return;
      }
      grouped.set(key, {
        key,
        classId: record.classId,
        className: record.className || record.stageName,
        subject: record.subject,
        grade: record.grade,
        count: 1,
        lastDeliveredAt: record.createdAt,
      });
    });

    return Array.from(grouped.values())
      .sort((left, right) => {
        if (right.count !== left.count) return right.count - left.count;
        return toTimestamp(right.lastDeliveredAt) - toTimestamp(left.lastDeliveredAt);
      })
      .slice(0, 6);
  }, [filteredRecords]);

  const teacherLeaders = useMemo(() => buildTeacherLeaders(filteredRecords), [filteredRecords]);

  const teacherAdoptionLeaders = useMemo(() => {
    return [...teacherLeaders]
      .sort((left, right) => {
        if (right.deliveryCount !== left.deliveryCount) {
          return right.deliveryCount - left.deliveryCount;
        }
        if (right.wholeClassCount !== left.wholeClassCount) {
          return right.wholeClassCount - left.wholeClassCount;
        }
        return toTimestamp(right.lastDeliveredAt) - toTimestamp(left.lastDeliveredAt);
      })
      .slice(0, 6);
  }, [teacherLeaders]);

  const studentMomentumLeaders = useMemo(() => {
    return teacherLeaders
      .filter((item) => item.studentInitiatedCount > 0)
      .sort((left, right) => {
        if (right.studentInitiatedCount !== left.studentInitiatedCount) {
          return right.studentInitiatedCount - left.studentInitiatedCount;
        }
        if (right.deliveryCount !== left.deliveryCount) {
          return right.deliveryCount - left.deliveryCount;
        }
        return toTimestamp(right.lastDeliveredAt) - toTimestamp(left.lastDeliveredAt);
      })
      .slice(0, 6);
  }, [teacherLeaders]);

  const resourcePackLeaders = useMemo(() => {
    return buildResourceLeaders(filteredRecords)
      .filter((item) => item.resourcePackCount > 0 || item.totalExports > 0 || item.wholeClassCount > 0)
      .sort((left, right) => {
        if (right.resourcePackCount !== left.resourcePackCount) {
          return right.resourcePackCount - left.resourcePackCount;
        }
        if (right.totalExports !== left.totalExports) {
          return right.totalExports - left.totalExports;
        }
        return toTimestamp(right.lastDeliveredAt) - toTimestamp(left.lastDeliveredAt);
      })
      .slice(0, 6);
  }, [filteredRecords]);

  const activeFilterLabels = useMemo(() => {
    const labels: string[] = [];
    const keywordText = keyword.trim();

    if (keywordText) labels.push(`关键词：${keywordText}`);
    if (actorFilter !== "all") labels.push(`角色：${buildActorFilterLabel(actorFilter)}`);
    if (kindFilter !== "all") labels.push(`动作：${buildDeliveryKindLabel(kindFilter)}`);
    if (audienceFilter !== "all") labels.push(`观看：${buildAudienceFilterLabel(audienceFilter)}`);
    if (learningModeFilter !== "all") labels.push(`模式：${buildLearningModeFilterLabel(learningModeFilter)}`);
    if (subjectFilter !== "all") labels.push(`学科：${subjectFilter}`);
    if (gradeFilter !== "all") labels.push(`年级：${gradeFilter}`);
    if (classNameFilter !== "all") labels.push(`班级：${classNameFilter}`);

    return labels;
  }, [
    actorFilter,
    audienceFilter,
    classNameFilter,
    gradeFilter,
    kindFilter,
    keyword,
    learningModeFilter,
    subjectFilter,
  ]);

  const governanceTips = useMemo(() => {
    const tips: string[] = [];

    if (!filteredRecords.length) {
      return ["当前筛选下暂无记录，建议先清空筛选或扩大班级与学科范围，再判断学校侧课堂质量结论。"];
    }

    if (filteredSummary.activeTeachers <= 1 && filteredSummary.deliveries >= 2) {
      tips.push("当前主要由少数教师在使用，建议把高质量互动课堂模板下发到同学科备课组，提升跨教师采用率。");
    }
    if (filteredSummary.studentInitiated === 0) {
      tips.push("当前范围内还没有学生自主使用记录，建议把互动课堂同步到学生入口，用于学科巩固和兴趣培养。");
    }
    if (filteredSummary.wholeClass === 0) {
      tips.push("当前范围内仍以私享或导出行为为主，建议至少补一次整班观看发布，验证真实课堂落地效果。");
    }
    if (filteredSummary.exports > 0 && filteredSummary.resourcePackExports === 0) {
      tips.push("当前已经有导出行为，但资源包沉淀仍为空，建议把优质课堂打包进校本资源库，方便跨班复用。");
    }
    if (
      subjectFilter === "all" &&
      filteredSummary.subjects === 1 &&
      (payload?.filterOptions.subjects.length ?? 0) > 1
    ) {
      const focusedSubject = filteredRecords.find((item) => item.subject)?.subject || "单一学科";
      tips.push(`当前课堂数据主要集中在 ${focusedSubject}，建议向更多学科复制航科互动课堂工作流，避免只在单点学科起量。`);
    }
    if (!tips.length) {
      tips.push("当前范围内已经形成教师发布、学生自学和资源沉淀的基础闭环，下一步建议对比不同班级和教研组的扩散速度。");
    }
    return tips.slice(0, 4);
  }, [
    filteredRecords,
    filteredSummary.activeTeachers,
    filteredSummary.deliveries,
    filteredSummary.exports,
    filteredSummary.resourcePackExports,
    filteredSummary.studentInitiated,
    filteredSummary.subjects,
    filteredSummary.wholeClass,
    payload?.filterOptions.subjects.length,
    subjectFilter,
  ]);

  const exportGovernanceReport = useCallback(() => {
    const exportedAt = new Date().toISOString();
    const filterText = activeFilterLabels.length ? activeFilterLabels.join(" / ") : "全部互动课堂交付记录";
    const recentRecordLines = filteredRecords.slice(0, 12).map((record) => {
      const tags = [
        record.subject,
        record.grade ? `${record.grade} 年级` : undefined,
        record.audienceMode ? buildAudienceModeLabel(record.audienceMode) : undefined,
        record.learningMode ? buildLearningModeLabel(record.learningMode) : undefined,
      ]
        .filter(Boolean)
        .join(" · ");

      return `${record.className || record.stageName}｜${buildDeliveryKindLabel(record.kind)}｜${buildDeliveryFormatLabel(record.format)}｜${record.actorName || record.actorUserId}｜${formatExportTimestamp(record.createdAt)}${tags ? `｜${tags}` : ""}`;
    });

    const report = [
      `# ${PRODUCT_BRAND_NAME}质量报告`,
      "",
      `- 导出时间：${formatExportTimestamp(exportedAt)}`,
      `- 学校：${payload?.summary.schoolId ?? "未标注学校"}`,
      `- 数据范围：${filterText}`,
      `- 当前记录数：${filteredSummary.deliveries}`,
      "",
      "## 核心指标",
      buildMarkdownBulletLines([
        `累计交付动作 ${filteredSummary.deliveries} 次`,
        `全班观看发布 ${filteredSummary.publishes} 次`,
        `导出归档 ${filteredSummary.exports} 次（PPTX ${filteredSummary.pptxExports} / 资源包 ${filteredSummary.resourcePackExports}）`,
        `学生自主使用 ${filteredSummary.studentInitiated} 次`,
        `活跃教师 ${filteredSummary.activeTeachers} 位`,
        `覆盖班级 ${filteredSummary.classes} 个`,
      ]),
      "",
      "## 教师采用榜",
      buildMarkdownBulletLines(
        teacherAdoptionLeaders.map(
          (item, index) =>
            `${index + 1}. ${item.teacherName}：${item.deliveryCount} 次交付，${item.publishCount} 次全班观看，${item.exportCount} 次导出，${item.studentInitiatedCount} 次学生自主使用`,
        ),
      ),
      "",
      "## 学生自主带动榜",
      buildMarkdownBulletLines(
        studentMomentumLeaders.map(
          (item, index) =>
            `${index + 1}. ${item.teacherName}：带动 ${item.studentInitiatedCount} 次学生自主使用，累计 ${item.deliveryCount} 次交付`,
        ),
      ),
      "",
      "## 资源沉淀榜",
      buildMarkdownBulletLines(
        resourcePackLeaders.map(
          (item, index) =>
            `${index + 1}. ${item.classroomName}：资源包 ${item.resourcePackCount} 次，PPTX ${item.pptxExportCount} 次，全班观看 ${item.wholeClassCount} 次`,
        ),
      ),
      "",
      "## 班级热点",
      buildMarkdownBulletLines(
        topFilteredClasses.map(
          (item, index) =>
            `${index + 1}. ${item.className}：累计 ${item.count} 次，最近一次 ${formatExportTimestamp(item.lastDeliveredAt)}`,
        ),
      ),
      "",
      "## 质量建议",
      buildMarkdownBulletLines(governanceTips),
      "",
      "## 最近交付快照",
      buildMarkdownBulletLines(recentRecordLines),
      "",
    ].join("\n");

    downloadTextFile(
      buildDownloadName("hangke-classroom-quality-report", "md"),
      report,
      "text/markdown;charset=utf-8",
    );
  }, [
    activeFilterLabels,
    filteredRecords,
    filteredSummary.activeTeachers,
    filteredSummary.classes,
    filteredSummary.deliveries,
    filteredSummary.exports,
    filteredSummary.pptxExports,
    filteredSummary.publishes,
    filteredSummary.resourcePackExports,
    filteredSummary.studentInitiated,
    governanceTips,
    payload?.summary.schoolId,
    resourcePackLeaders,
    studentMomentumLeaders,
    teacherAdoptionLeaders,
    topFilteredClasses,
  ]);

  const exportFilteredRecordsCsv = useCallback(() => {
    const header = [
      "交付时间",
      "班级/课堂",
      "学科",
      "年级",
      "发起角色",
      "发起人",
      "关联教师",
      "学习者",
      "交付动作",
      "交付形式",
      "观看方式",
      "课堂模式",
      "覆盖人数",
      "文件名",
      "观看链接",
      "记录标签",
    ];

    const rows = filteredRecords.map((record) => [
      formatExportTimestamp(record.createdAt),
      record.className || record.stageName || "",
      record.subject || "",
      record.grade || "",
      buildActorFilterLabel(record.actorRole),
      record.actorName || record.actorUserId,
      record.teacherName || resolveTeacherIdentity(record)?.teacherName || "",
      record.learnerName || "",
      buildDeliveryKindLabel(record.kind),
      buildDeliveryFormatLabel(record.format),
      record.audienceMode ? buildAudienceModeLabel(record.audienceMode) : "",
      record.learningMode ? buildLearningModeLabel(record.learningMode) : "",
      record.studentCount ? String(record.studentCount) : "",
      record.fileName || "",
      record.publishedUrl || "",
      record.label,
    ]);

    downloadTextFile(
      buildDownloadName("hangke-classroom-quality-records", "csv"),
      `\uFEFF${buildCsvContent(header, rows)}`,
      "text/csv;charset=utf-8",
    );
  }, [filteredRecords]);

  const clearFilters = useCallback(() => {
    setKeyword("");
    setActorFilter("all");
    setKindFilter("all");
    setAudienceFilter("all");
    setLearningModeFilter("all");
    setSubjectFilter("all");
    setGradeFilter("all");
    setClassNameFilter("all");
  }, []);

  return {
    payload,
    loading,
    refreshing,
    error,
    authRequired,
    lastLoadedAt,
    keyword,
    actorFilter,
    kindFilter,
    audienceFilter,
    learningModeFilter,
    subjectFilter,
    gradeFilter,
    classNameFilter,
    filteredRecords,
    filteredSummary,
    topFilteredClasses,
    teacherAdoptionLeaders,
    studentMomentumLeaders,
    resourcePackLeaders,
    governanceTips,
    activeFilterLabels,
    setKeyword,
    setActorFilter,
    setKindFilter,
    setAudienceFilter,
    setLearningModeFilter,
    setSubjectFilter,
    setGradeFilter,
    setClassNameFilter,
    clearFilters,
    exportGovernanceReport,
    exportFilteredRecordsCsv,
    loadData,
  };
}

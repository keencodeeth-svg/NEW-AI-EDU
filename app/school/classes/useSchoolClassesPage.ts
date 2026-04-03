"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { requestJson } from "@/lib/client-request";
import type { SchoolClassRecord } from "@/lib/school-admin-types";
import type { SchoolClassesResponse } from "../types";
import { getSchoolAdminRequestMessage, isSchoolAdminAuthRequiredError } from "../utils";

export type ClassStatusFilter =
  | "all"
  | "teacher_gap"
  | "empty"
  | "no_assignments"
  | "no_schedule"
  | "overloaded"
  | "healthy";

type SchoolClassListItem = {
  record: SchoolClassRecord;
  issueTags: string[];
  isFocused: boolean;
};

type ClassSourceContext = {
  source: "interactive_classrooms";
  classId?: string;
  className?: string;
  teacherId?: string;
  teacherName?: string;
};

function getClassIssueTags(item: SchoolClassRecord) {
  const tags: string[] = [];
  if (!item.teacherId) tags.push("待绑定教师");
  if (item.studentCount === 0) tags.push("暂无学生");
  if (item.scheduleCount === 0) tags.push("未排课程表");
  if (item.assignmentCount === 0) tags.push("未布置作业");
  if (item.studentCount >= 45) tags.push("人数偏高");
  return tags;
}

function normalizeTextParam(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : "";
}

function normalizeClassStatusFilter(value?: string | null): ClassStatusFilter {
  if (
    value === "teacher_gap" ||
    value === "empty" ||
    value === "no_assignments" ||
    value === "no_schedule" ||
    value === "overloaded" ||
    value === "healthy"
  ) {
    return value;
  }
  return "all";
}

export function useSchoolClassesPage() {
  const searchParams = useSearchParams();
  const loadRequestIdRef = useRef(0);
  const [classes, setClasses] = useState<SchoolClassRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);
  const [keyword, setKeyword] = useState("");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<ClassStatusFilter>("all");

  const focusClassId = normalizeTextParam(searchParams.get("classId"));
  const focusClassName = normalizeTextParam(searchParams.get("className"));
  const focusTeacherId = normalizeTextParam(searchParams.get("teacherId"));
  const focusTeacherName = normalizeTextParam(searchParams.get("teacherName"));

  const sourceContext = useMemo<ClassSourceContext | null>(() => {
    if (searchParams.get("source") !== "interactive_classrooms") {
      return null;
    }
    return {
      source: "interactive_classrooms",
      classId: focusClassId || undefined,
      className: focusClassName || undefined,
      teacherId: focusTeacherId || undefined,
      teacherName: focusTeacherName || undefined,
    };
  }, [focusClassId, focusClassName, focusTeacherId, focusTeacherName, searchParams]);

  useEffect(() => {
    setKeyword(normalizeTextParam(searchParams.get("keyword")));
    setGradeFilter(normalizeTextParam(searchParams.get("grade")) || "all");
    setSubjectFilter(normalizeTextParam(searchParams.get("subject")) || "all");
    setStatusFilter(normalizeClassStatusFilter(searchParams.get("status")));
  }, [searchParams]);

  const loadClasses = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    const requestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = requestId;

    if (mode === "refresh") {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const payload = await requestJson<SchoolClassesResponse>("/api/school/classes");
      if (loadRequestIdRef.current !== requestId) {
        return;
      }
      setClasses(payload.data ?? []);
      setAuthRequired(false);
      setLastLoadedAt(new Date().toISOString());
    } catch (nextError) {
      if (loadRequestIdRef.current !== requestId) {
        return;
      }
      if (isSchoolAdminAuthRequiredError(nextError)) {
        setAuthRequired(true);
        setClasses([]);
      } else {
        setError(getSchoolAdminRequestMessage(nextError, "加载学校班级失败"));
      }
    } finally {
      if (loadRequestIdRef.current === requestId) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadClasses();
  }, [loadClasses]);

  const gradeOptions = useMemo(
    () => Array.from(new Set(classes.map((item) => item.grade))).sort((left, right) => left.localeCompare(right, "zh-CN")),
    [classes],
  );

  const subjectOptions = useMemo(
    () =>
      Array.from(new Set(classes.map((item) => item.subject))).sort((left, right) => left.localeCompare(right, "zh-CN")),
    [classes],
  );

  const filteredClasses = useMemo<SchoolClassListItem[]>(() => {
    const keywordLower = keyword.trim().toLowerCase();
    const focusClassNameLower = focusClassName.toLowerCase();
    const focusTeacherNameLower = focusTeacherName.toLowerCase();

    return classes
      .map((record) => {
        const issueTags = getClassIssueTags(record);
        const isFocused =
          (focusClassId && record.id === focusClassId) ||
          (!focusClassId && focusClassName ? record.name.toLowerCase() === focusClassNameLower : false);

        return {
          record,
          issueTags,
          isFocused,
        };
      })
      .filter(({ record, issueTags }) => {
        if (focusClassId && record.id !== focusClassId) return false;
        if (!focusClassId && focusClassName && record.name.toLowerCase() !== focusClassNameLower) return false;
        if (focusTeacherId && record.teacherId !== focusTeacherId) return false;
        if (!focusTeacherId && focusTeacherName && (record.teacherName ?? "").toLowerCase() !== focusTeacherNameLower) {
          return false;
        }
        if (gradeFilter !== "all" && record.grade !== gradeFilter) return false;
        if (subjectFilter !== "all" && record.subject !== subjectFilter) return false;
        if (statusFilter === "teacher_gap" && record.teacherId) return false;
        if (statusFilter === "empty" && record.studentCount > 0) return false;
        if (statusFilter === "no_assignments" && record.assignmentCount > 0) return false;
        if (statusFilter === "no_schedule" && record.scheduleCount > 0) return false;
        if (statusFilter === "overloaded" && record.studentCount < 45) return false;
        if (statusFilter === "healthy" && issueTags.length > 0) return false;
        if (!keywordLower) return true;
        return [record.name, record.subject, record.grade, record.teacherName ?? record.teacherId ?? "", ...issueTags]
          .join(" ")
          .toLowerCase()
          .includes(keywordLower);
      });
  }, [classes, focusClassId, focusClassName, focusTeacherId, focusTeacherName, gradeFilter, keyword, statusFilter, subjectFilter]);

  const teacherGapCount = useMemo(() => classes.filter((item) => !item.teacherId).length, [classes]);
  const emptyCount = useMemo(() => classes.filter((item) => item.studentCount === 0).length, [classes]);
  const noAssignmentCount = useMemo(() => classes.filter((item) => item.assignmentCount === 0).length, [classes]);
  const noScheduleCount = useMemo(() => classes.filter((item) => item.scheduleCount === 0).length, [classes]);
  const overloadedCount = useMemo(() => classes.filter((item) => item.studentCount >= 45).length, [classes]);

  const clearFilters = useCallback(() => {
    setKeyword("");
    setGradeFilter("all");
    setSubjectFilter("all");
    setStatusFilter("all");
  }, []);

  return {
    classes,
    filteredClasses,
    loading,
    refreshing,
    error,
    authRequired,
    lastLoadedAt,
    keyword,
    gradeFilter,
    subjectFilter,
    statusFilter,
    gradeOptions,
    subjectOptions,
    sourceContext,
    teacherGapCount,
    emptyCount,
    noAssignmentCount,
    noScheduleCount,
    overloadedCount,
    setKeyword,
    setGradeFilter,
    setSubjectFilter,
    setStatusFilter,
    clearFilters,
    loadClasses,
  };
}

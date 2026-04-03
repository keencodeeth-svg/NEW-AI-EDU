"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  AssignmentNotifyTarget,
  AssignmentStudentFilter,
  RubricItem,
  TeacherAssignmentDetailData
} from "./types";
import {
  buildTeacherAssignmentNotifyPreviewStudents,
  filterTeacherAssignmentStudents
} from "./utils";
import { useTeacherAssignmentDetailActions } from "./useTeacherAssignmentDetailActions";
import { useTeacherAssignmentDetailLoaders } from "./useTeacherAssignmentDetailLoaders";

export function useTeacherAssignmentDetailPage(id: string) {
  const loadRequestIdRef = useRef(0);
  const rubricRequestIdRef = useRef(0);
  const notifyRequestIdRef = useRef(0);
  const saveRubricsRequestIdRef = useRef(0);
  const hasDetailSnapshotRef = useRef(false);
  const rubricsReadyRef = useRef(false);

  const [data, setData] = useState<TeacherAssignmentDetailData | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notifyTarget, setNotifyTarget] = useState<AssignmentNotifyTarget>("missing");
  const [threshold, setThreshold] = useState(60);
  const [notifyMessage, setNotifyMessage] = useState("");
  const [notifyLoading, setNotifyLoading] = useState(false);
  const [notifySuccess, setNotifySuccess] = useState<string | null>(null);
  const [notifyError, setNotifyError] = useState<string | null>(null);
  const [rubrics, setRubrics] = useState<RubricItem[]>([]);
  const [rubricsLoading, setRubricsLoading] = useState(false);
  const [rubricsReady, setRubricsReady] = useState(false);
  const [rubricLoadError, setRubricLoadError] = useState<string | null>(null);
  const [rubricMessage, setRubricMessage] = useState<string | null>(null);
  const [rubricError, setRubricError] = useState<string | null>(null);
  const [rubricSaving, setRubricSaving] = useState(false);
  const [studentFilter, setStudentFilter] = useState<AssignmentStudentFilter>("all");
  const [studentKeyword, setStudentKeyword] = useState("");
  const [now] = useState(() => Date.now());

  useEffect(() => {
    rubricsReadyRef.current = rubricsReady;
  }, [rubricsReady]);

  const clearAssignmentDetailState = useCallback(() => {
    hasDetailSnapshotRef.current = false;
    rubricsReadyRef.current = false;
    setData(null);
    setNotifySuccess(null);
    setNotifyError(null);
    setRubrics([]);
    setRubricsReady(false);
    setRubricLoadError(null);
    setRubricMessage(null);
    setRubricError(null);
  }, []);

  const handleAuthRequired = useCallback(() => {
    loadRequestIdRef.current += 1;
    rubricRequestIdRef.current += 1;
    notifyRequestIdRef.current += 1;
    saveRubricsRequestIdRef.current += 1;
    clearAssignmentDetailState();
    setLoading(false);
    setRubricsLoading(false);
    setNotifyLoading(false);
    setRubricSaving(false);
    setLoadError(null);
    setAuthRequired(true);
  }, [clearAssignmentDetailState]);

  const { load, retryRubrics } = useTeacherAssignmentDetailLoaders({
    id,
    loadRequestIdRef,
    rubricRequestIdRef,
    hasDetailSnapshotRef,
    rubricsReadyRef,
    clearAssignmentDetailState,
    handleAuthRequired,
    setData,
    setAuthRequired,
    setLoading,
    setLoadError,
    setRubrics,
    setRubricsLoading,
    setRubricsReady,
    setRubricLoadError
  });

  useEffect(() => {
    void load("initial");
  }, [load]);

  const assignmentOverdue = useMemo(
    () => (data ? new Date(data.assignment.dueDate).getTime() < now : false),
    [data, now]
  );
  const completedStudents = useMemo(
    () => data?.students.filter((student) => student.status === "completed") ?? [],
    [data]
  );
  const pendingStudents = useMemo(
    () => data?.students.filter((student) => student.status !== "completed") ?? [],
    [data]
  );
  const reviewReadyStudents = useMemo(
    () =>
      completedStudents.filter(
        (student) => student.score === null || student.total === null
      ),
    [completedStudents]
  );
  const scoredStudents = useMemo(
    () =>
      completedStudents.filter(
        (student) =>
          student.score !== null && student.total !== null && student.total > 0
      ),
    [completedStudents]
  );
  const lowScoreStudents = useMemo(
    () => scoredStudents.filter((student) => student.score! / student.total! < 0.6),
    [scoredStudents]
  );
  const latestCompletedStudent = useMemo(
    () =>
      [...completedStudents].sort((left, right) => {
        const leftTs = new Date(left.completedAt ?? "").getTime();
        const rightTs = new Date(right.completedAt ?? "").getTime();
        return rightTs - leftTs;
      })[0] ?? null,
    [completedStudents]
  );
  const completionRate = data?.students.length
    ? Math.round((completedStudents.length / data.students.length) * 100)
    : 0;
  const averagePercent = scoredStudents.length
    ? Math.round(
        scoredStudents.reduce(
          (sum, student) => sum + (student.score! / student.total!) * 100,
          0
        ) / scoredStudents.length
      )
    : null;
  const notifyPreviewStudents = useMemo(
    () =>
      buildTeacherAssignmentNotifyPreviewStudents(
        data?.students ?? [],
        notifyTarget,
        threshold
      ),
    [data?.students, notifyTarget, threshold]
  );
  const hasStudentFilters = Boolean(studentFilter !== "all" || studentKeyword.trim());
  const filteredStudents = useMemo(
    () =>
      filterTeacherAssignmentStudents(
        data?.students ?? [],
        studentFilter,
        studentKeyword,
        assignmentOverdue
      ),
    [assignmentOverdue, data?.students, studentFilter, studentKeyword]
  );

  const actions = useTeacherAssignmentDetailActions({
    data,
    notifyTarget,
    threshold,
    notifyMessage,
    notifyLoading,
    rubrics,
    rubricsReady,
    rubricSaving,
    notifyRequestIdRef,
    saveRubricsRequestIdRef,
    clearAssignmentDetailState,
    handleAuthRequired,
    setAuthRequired,
    setLoadError,
    setNotifyLoading,
    setNotifySuccess,
    setNotifyError,
    setRubrics,
    setRubricsReady,
    setRubricLoadError,
    setRubricMessage,
    setRubricError,
    setRubricSaving,
    setStudentFilter,
    setStudentKeyword
  });

  return {
    data,
    authRequired,
    loading,
    loadError,
    notifyTarget,
    threshold,
    notifyMessage,
    notifyLoading,
    notifySuccess,
    notifyError,
    rubrics,
    rubricsLoading,
    rubricsReady,
    rubricLoadError,
    rubricMessage,
    rubricError,
    rubricSaving,
    studentFilter,
    studentKeyword,
    now,
    assignmentOverdue,
    completedStudents,
    pendingStudents,
    reviewReadyStudents,
    scoredStudents,
    lowScoreStudents,
    latestCompletedStudent,
    completionRate,
    averagePercent,
    notifyPreviewStudents,
    hasStudentFilters,
    filteredStudents,
    setNotifyTarget,
    setThreshold,
    setNotifyMessage,
    setStudentFilter,
    setStudentKeyword,
    updateRubric: actions.updateRubric,
    updateLevel: actions.updateLevel,
    addRubric: actions.addRubric,
    removeRubric: actions.removeRubric,
    addLevel: actions.addLevel,
    removeLevel: actions.removeLevel,
    clearStudentFilters: actions.clearStudentFilters,
    load,
    retryRubrics,
    handleNotify: actions.handleNotify,
    handleSaveRubrics: actions.handleSaveRubrics
  };
}

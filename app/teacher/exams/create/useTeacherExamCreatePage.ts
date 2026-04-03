"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  ClassItem,
  ClassStudent,
  ConfigNotice,
  FormState,
  KnowledgePoint,
  StageTrailItem
} from "./types";
import {
  buildTeacherExamCreateScopeLabel,
  buildTeacherExamCreateTargetLabel,
  formatClassLabel,
  getDefaultEndAt,
  getTeacherExamCreateCanSubmit,
  getTeacherExamCreateTargetCount,
  getPoolRisk,
  getScheduleStatus
} from "./utils";
import { useTeacherExamCreatePageActions } from "./useTeacherExamCreatePageActions";
import { useTeacherExamCreatePageLoaders } from "./useTeacherExamCreatePageLoaders";

const INITIAL_FORM: FormState = {
  classId: "",
  title: "",
  description: "",
  publishMode: "teacher_assigned",
  antiCheatLevel: "basic",
  studentIds: [],
  startAt: "",
  endAt: getDefaultEndAt(),
  durationMinutes: 60,
  questionCount: 10,
  knowledgePointId: "",
  difficulty: "medium",
  questionType: "choice",
  includeIsolated: false
};

export function useTeacherExamCreatePage() {
  const router = useRouter();
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [knowledgePoints, setKnowledgePoints] = useState<KnowledgePoint[]>([]);
  const [classStudents, setClassStudents] = useState<ClassStudent[]>([]);
  const [configLoading, setConfigLoading] = useState(true);
  const [configRefreshing, setConfigRefreshing] = useState(false);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [configNotice, setConfigNotice] = useState<ConfigNotice | null>(null);
  const [studentsError, setStudentsError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [submitSuggestions, setSubmitSuggestions] = useState<string[]>([]);
  const [stageTrail, setStageTrail] = useState<StageTrailItem[]>([]);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const formRef = useRef<FormState>(INITIAL_FORM);
  const knowledgePointsRef = useRef<KnowledgePoint[]>([]);
  const configRequestIdRef = useRef(0);
  const studentsRequestIdRef = useRef(0);
  const hasClassSnapshotRef = useRef(false);
  const hasKnowledgePointSnapshotRef = useRef(false);

  useEffect(() => {
    formRef.current = form;
  }, [form]);

  useEffect(() => {
    knowledgePointsRef.current = knowledgePoints;
  }, [knowledgePoints]);

  const { loadConfig, loadStudents } = useTeacherExamCreatePageLoaders({
    formRef,
    knowledgePointsRef,
    configRequestIdRef,
    studentsRequestIdRef,
    hasClassSnapshotRef,
    hasKnowledgePointSnapshotRef,
    setClasses,
    setKnowledgePoints,
    setClassStudents,
    setConfigLoading,
    setConfigRefreshing,
    setStudentsLoading,
    setAuthRequired,
    setPageError,
    setConfigNotice,
    setStudentsError,
    setLastLoadedAt,
    setForm
  });

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    void loadStudents(form.classId);
  }, [form.classId, loadStudents]);

  const selectedClass = useMemo(
    () => classes.find((item) => item.id === form.classId),
    [classes, form.classId]
  );

  const filteredPoints = useMemo(() => {
    if (!selectedClass) return [];
    return knowledgePoints.filter(
      (item) =>
        item.subject === selectedClass.subject && item.grade === selectedClass.grade
    );
  }, [knowledgePoints, selectedClass]);

  const selectedPoint = useMemo(
    () => filteredPoints.find((item) => item.id === form.knowledgePointId) ?? null,
    [filteredPoints, form.knowledgePointId]
  );
  const scheduleStatus = useMemo(() => getScheduleStatus(form), [form]);
  const poolRisk = useMemo(() => getPoolRisk(form, filteredPoints), [filteredPoints, form]);
  const targetCount = useMemo(
    () =>
      getTeacherExamCreateTargetCount(
        form.publishMode,
        form.studentIds.length,
        classStudents.length
      ),
    [classStudents.length, form.publishMode, form.studentIds.length]
  );
  const canSubmit = useMemo(
    () =>
      getTeacherExamCreateCanSubmit({
        classId: form.classId,
        title: form.title,
        publishMode: form.publishMode,
        scheduleReady: scheduleStatus.canSubmit,
        configLoading,
        saving,
        targetCount,
        studentsLoading
      }),
    [
      configLoading,
      form.classId,
      form.publishMode,
      form.title,
      saving,
      scheduleStatus.canSubmit,
      studentsLoading,
      targetCount
    ]
  );
  const classLabel = useMemo(() => formatClassLabel(selectedClass), [selectedClass]);
  const scopeLabel = useMemo(
    () =>
      buildTeacherExamCreateScopeLabel(
        selectedPoint,
        selectedClass?.subject,
        form.questionCount
      ),
    [form.questionCount, selectedClass?.subject, selectedPoint]
  );
  const targetLabel = useMemo(
    () =>
      buildTeacherExamCreateTargetLabel(
        form.publishMode,
        targetCount,
        classStudents.length
      ),
    [classStudents.length, form.publishMode, targetCount]
  );

  const refreshConfig = useCallback(async () => {
    const previousClassId = formRef.current.classId;
    const nextClassId = await loadConfig("refresh");

    if (nextClassId && nextClassId === previousClassId) {
      await loadStudents(nextClassId, { preserveExisting: true });
    }
  }, [loadConfig, loadStudents]);

  const retryStudents = useCallback(() => {
    void loadStudents(form.classId, { preserveExisting: true });
  }, [form.classId, loadStudents]);

  const actions = useTeacherExamCreatePageActions({
    router,
    form,
    scheduleStatus,
    saving,
    setSaving,
    setAuthRequired,
    setSubmitError,
    setSubmitMessage,
    setSubmitSuggestions,
    setStageTrail
  });

  return {
    classes,
    knowledgePoints,
    classStudents,
    configLoading,
    configRefreshing,
    studentsLoading,
    authRequired,
    pageError,
    configNotice,
    studentsError,
    saving,
    submitError,
    submitMessage,
    submitSuggestions,
    stageTrail,
    lastLoadedAt,
    form,
    setForm,
    selectedClass,
    filteredPoints,
    selectedPoint,
    scheduleStatus,
    poolRisk,
    targetCount,
    canSubmit,
    classLabel,
    scopeLabel,
    targetLabel,
    loadConfig,
    refreshConfig,
    retryStudents,
    handleSubmit: actions.handleSubmit
  };
}

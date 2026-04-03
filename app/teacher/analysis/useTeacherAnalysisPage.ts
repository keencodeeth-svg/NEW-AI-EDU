"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  AnalysisAlertImpactData,
  AnalysisAlertItem,
  AnalysisAlertSummary,
  AnalysisClassItem,
  AnalysisFavoriteItem,
  AnalysisHeatItem,
  AnalysisInterventionCausalityItem,
  AnalysisInterventionCausalitySummary,
  AnalysisParentCollaborationSummary,
  AnalysisReportData,
  AnalysisStudentItem
} from "./types";
import { useTeacherAnalysisActions } from "./useTeacherAnalysisActions";
import { useTeacherAnalysisLoaders } from "./useTeacherAnalysisLoaders";
import { removeTeacherAnalysisClassSnapshot } from "./utils";

export function useTeacherAnalysisPage() {
  const didInitRef = useRef(false);
  const skipNextClassEffectRef = useRef<string | null>(null);
  const skipNextStudentEffectRef = useRef<string | null>(null);
  const previousClassIdRef = useRef("");
  const classScopedRequestIdRef = useRef(0);
  const favoritesRequestIdRef = useRef(0);
  const studentIdRef = useRef("");

  const [classes, setClasses] = useState<AnalysisClassItem[]>([]);
  const [classId, setClassId] = useState("");
  const [heatmap, setHeatmap] = useState<AnalysisHeatItem[]>([]);
  const [report, setReport] = useState<AnalysisReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [heatmapLoading, setHeatmapLoading] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [students, setStudents] = useState<AnalysisStudentItem[]>([]);
  const [studentId, setStudentId] = useState("");
  const [favorites, setFavorites] = useState<AnalysisFavoriteItem[]>([]);
  const [alerts, setAlerts] = useState<AnalysisAlertItem[]>([]);
  const [alertSummary, setAlertSummary] = useState<AnalysisAlertSummary | null>(null);
  const [parentCollaboration, setParentCollaboration] = useState<AnalysisParentCollaborationSummary | null>(null);
  const [acknowledgingAlertId, setAcknowledgingAlertId] = useState<string | null>(null);
  const [actingAlertKey, setActingAlertKey] = useState<string | null>(null);
  const [alertActionMessage, setAlertActionMessage] = useState<string | null>(null);
  const [impactByAlertId, setImpactByAlertId] = useState<Record<string, AnalysisAlertImpactData>>({});
  const [loadingImpactId, setLoadingImpactId] = useState<string | null>(null);
  const [causalitySummary, setCausalitySummary] = useState<AnalysisInterventionCausalitySummary | null>(null);
  const [causalityItems, setCausalityItems] = useState<AnalysisInterventionCausalityItem[]>([]);
  const [causalityLoading, setCausalityLoading] = useState(false);
  const [causalityDays, setCausalityDays] = useState(14);
  const [pageError, setPageError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);

  const applyStudentId = useCallback((nextStudentId: string) => {
    studentIdRef.current = nextStudentId;
    setStudentId(nextStudentId);
    if (!nextStudentId) {
      favoritesRequestIdRef.current += 1;
      setFavorites([]);
    }
  }, []);

  const clearScopedDataState = useCallback(() => {
    setHeatmap([]);
    setReport(null);
    setReportError(null);
    setStudents([]);
    applyStudentId("");
    setFavorites([]);
    setAlerts([]);
    setAlertSummary(null);
    setParentCollaboration(null);
    setAlertActionMessage(null);
    setImpactByAlertId({});
    setCausalitySummary(null);
    setCausalityItems([]);
  }, [applyStudentId]);

  const resetScopedData = useCallback(() => {
    classScopedRequestIdRef.current += 1;
    favoritesRequestIdRef.current += 1;
    clearScopedDataState();
  }, [clearScopedDataState]);

  const clearAnalysisPageState = useCallback(() => {
    previousClassIdRef.current = "";
    skipNextClassEffectRef.current = null;
    skipNextStudentEffectRef.current = null;
    applyStudentId("");
    setClasses([]);
    setClassId("");
    resetScopedData();
    setReport(null);
    setReportError(null);
    setAcknowledgingAlertId(null);
    setActingAlertKey(null);
    setAlertActionMessage(null);
    setLoadingImpactId(null);
    setPageError(null);
    setLastLoadedAt(null);
  }, [applyStudentId, resetScopedData]);

  const handleAuthRequired = useCallback(() => {
    clearAnalysisPageState();
    setAuthRequired(true);
  }, [clearAnalysisPageState]);

  const handleMissingClassSelection = useCallback((missingClassId: string) => {
    const nextState = removeTeacherAnalysisClassSnapshot(classes, missingClassId);
    previousClassIdRef.current = "";
    setClasses(nextState.classes);
    setClassId(nextState.classId);
    resetScopedData();
    setLastLoadedAt(new Date().toISOString());
  }, [classes, resetScopedData]);

  const { loadFavorites, loadClassScopedData, loadBootstrap } = useTeacherAnalysisLoaders({
    classId,
    causalityDays,
    classScopedRequestIdRef,
    favoritesRequestIdRef,
    skipNextClassEffectRef,
    skipNextStudentEffectRef,
    studentIdRef,
    handleAuthRequired,
    handleMissingClassSelection,
    clearScopedDataState,
    resetScopedData,
    applyStudentId,
    setClasses,
    setClassId,
    setHeatmap,
    setStudents,
    setFavorites,
    setAlerts,
    setAlertSummary,
    setParentCollaboration,
    setImpactByAlertId,
    setCausalitySummary,
    setCausalityItems,
    setHeatmapLoading,
    setCausalityLoading,
    setPageError,
    setAuthRequired,
    setLastLoadedAt,
    setLoading,
    setRefreshing
  });

  useEffect(() => {
    if (didInitRef.current) {
      return;
    }
    didInitRef.current = true;
    void loadBootstrap();
  }, [loadBootstrap]);

  useEffect(() => {
    if (!didInitRef.current) {
      return;
    }
    if (!classId) {
      previousClassIdRef.current = "";
      return;
    }

    const classChanged = previousClassIdRef.current !== classId;
    previousClassIdRef.current = classId;
    if (skipNextClassEffectRef.current === classId) {
      skipNextClassEffectRef.current = null;
      return;
    }
    void loadClassScopedData(classId, causalityDays, studentIdRef.current, {
      resetBeforeLoad: classChanged
    });
  }, [causalityDays, classId, loadClassScopedData]);

  useEffect(() => {
    if (!studentId) {
      return;
    }
    if (skipNextStudentEffectRef.current === studentId) {
      skipNextStudentEffectRef.current = null;
      return;
    }
    void loadFavorites(studentId);
  }, [loadFavorites, studentId]);

  const visibleReport = report?.classId && classId && report.classId !== classId ? null : report;
  const visibleReportError = report?.classId && classId && report.classId !== classId ? null : reportError;
  const actions = useTeacherAnalysisActions({
    classId,
    causalityDays,
    impactByAlertId,
    studentIdRef,
    handleAuthRequired,
    handleMissingClassSelection,
    loadClassScopedData,
    setAcknowledgingAlertId,
    setActingAlertKey,
    setAlertActionMessage,
    setImpactByAlertId,
    setLoadingImpactId,
    setReport,
    setReportLoading,
    setReportError,
    setAuthRequired,
    setPageError
  });

  const sortedHeatmap = useMemo(() => heatmap.slice(0, 40), [heatmap]);
  const showHeatmapSkeleton = heatmapLoading && sortedHeatmap.length === 0;
  const showReportSkeleton = reportLoading && !visibleReport;
  const selectedClass = useMemo(() => classes.find((item) => item.id === classId) ?? null, [classId, classes]);
  const activeAlertCount = useMemo(
    () => alerts.filter((item) => item.status === "active").length,
    [alerts]
  );
  const weakestKnowledgePoint = useMemo(
    () =>
      [...sortedHeatmap].sort((left, right) => {
        if (left.ratio !== right.ratio) return left.ratio - right.ratio;
        return right.total - left.total;
      })[0] ?? null,
    [sortedHeatmap]
  );

  return {
    classes,
    classId,
    setClassId,
    heatmap: sortedHeatmap,
    report: visibleReport,
    loading,
    refreshing,
    heatmapLoading,
    reportLoading,
    reportError: visibleReportError,
    students,
    studentId,
    setStudentId: applyStudentId,
    favorites,
    alerts,
    alertSummary,
    parentCollaboration,
    acknowledgingAlertId,
    actingAlertKey,
    alertActionMessage,
    impactByAlertId,
    loadingImpactId,
    causalitySummary,
    causalityItems,
    causalityLoading,
    causalityDays,
    setCausalityDays,
    pageError,
    authRequired,
    lastLoadedAt,
    showHeatmapSkeleton,
    showReportSkeleton,
    selectedClass,
    activeAlertCount,
    weakestKnowledgePoint,
    loadBootstrap,
    ...actions
  };
}

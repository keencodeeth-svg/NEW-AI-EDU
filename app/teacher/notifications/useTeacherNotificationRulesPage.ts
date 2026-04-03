"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ClassItem,
  HistoryItem,
  HistoryResponse,
  PreviewData,
  RuleItem
} from "./types";
import { useTeacherNotificationRulesActions } from "./useTeacherNotificationRulesActions";
import { useTeacherNotificationRulesLoaders } from "./useTeacherNotificationRulesLoaders";
import {
  buildDraftRule,
  DEFAULT_RULE,
  getCommandState,
  isSameRule,
  upsertTeacherNotificationRule
} from "./utils";

export function useTeacherNotificationRulesPage() {
  const classIdRef = useRef("");
  const loadRequestIdRef = useRef(0);
  const classChangeRequestIdRef = useRef(0);
  const actionRequestIdRef = useRef(0);
  const previewRequestIdRef = useRef(0);
  const historyRequestIdRef = useRef(0);
  const savedRulesRef = useRef<RuleItem[]>([]);

  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [savedRules, setSavedRules] = useState<RuleItem[]>([]);
  const [classId, setClassId] = useState("");
  const [draftRule, setDraftRule] = useState<RuleItem>({ id: "", classId: "", ...DEFAULT_RULE });
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [previewRuleSnapshot, setPreviewRuleSnapshot] = useState<RuleItem | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historySummary, setHistorySummary] = useState<HistoryResponse["summary"] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);

  const applyClassId = useCallback((nextClassId: string) => {
    classIdRef.current = nextClassId;
    setClassId(nextClassId);
  }, []);

  const applySavedRules = useCallback((nextRules: RuleItem[]) => {
    savedRulesRef.current = nextRules;
    setSavedRules(nextRules);
  }, []);

  const upsertSavedRule = useCallback((nextRule: RuleItem) => {
    applySavedRules(upsertTeacherNotificationRule(savedRulesRef.current, nextRule));
  }, [applySavedRules]);

  const clearNotificationScopedState = useCallback((options?: { invalidate?: boolean }) => {
    if (options?.invalidate !== false) {
      previewRequestIdRef.current += 1;
      historyRequestIdRef.current += 1;
    }
    setPreviewing(false);
    setHistoryLoading(false);
    setPreview(null);
    setPreviewRuleSnapshot(null);
    setHistory([]);
    setHistorySummary(null);
  }, []);

  const clearNotificationPageState = useCallback(() => {
    setClasses([]);
    applySavedRules([]);
    applyClassId("");
    setDraftRule({ id: "", classId: "", ...DEFAULT_RULE });
    clearNotificationScopedState();
    setMessage(null);
    setLoadError(null);
    setActionError(null);
    setLastLoadedAt(null);
  }, [applyClassId, applySavedRules, clearNotificationScopedState]);

  const handleAuthRequired = useCallback(() => {
    loadRequestIdRef.current += 1;
    classChangeRequestIdRef.current += 1;
    actionRequestIdRef.current += 1;
    clearNotificationPageState();
    setLoading(false);
    setRefreshing(false);
    setPreviewing(false);
    setHistoryLoading(false);
    setSaving(false);
    setRunning(false);
    setAuthRequired(true);
  }, [clearNotificationPageState]);

  const { loadPreview, loadHistory, load } = useTeacherNotificationRulesLoaders({
    classIdRef,
    loadRequestIdRef,
    actionRequestIdRef,
    previewRequestIdRef,
    historyRequestIdRef,
    handleAuthRequired,
    clearNotificationScopedState,
    applySavedRules,
    applyClassId,
    setClasses,
    setDraftRule,
    setPreview,
    setPreviewRuleSnapshot,
    setHistory,
    setHistorySummary,
    setAuthRequired,
    setLoadError,
    setLoading,
    setRefreshing,
    setPreviewing,
    setHistoryLoading,
    setSaving,
    setRunning,
    setLastLoadedAt
  });

  useEffect(() => {
    void load();
  }, [load]);

  const selectedClass = useMemo(
    () => classes.find((item) => item.id === classId) ?? null,
    [classId, classes]
  );
  const savedRuleForClass = useMemo(() => buildDraftRule(classId, savedRules), [classId, savedRules]);
  const hasUnsavedChanges = classId ? !isSameRule(draftRule, savedRuleForClass) : false;
  const isPreviewCurrent = classId ? Boolean(previewRuleSnapshot && isSameRule(previewRuleSnapshot, draftRule)) : false;
  const configuredRuleCount = savedRules.length;
  const enabledRuleCount = savedRules.filter((item) => item.enabled).length;
  const latestHistory = history[0] ?? null;
  const latestClassResult =
    latestHistory?.classResults.find((entry) => entry.classId === classId) ??
    latestHistory?.classResults[0] ??
    null;
  const overdueAssignments = useMemo(
    () => preview?.sampleAssignments.filter((item) => item.stage === "overdue") ?? [],
    [preview?.sampleAssignments]
  );
  const dueSoonAssignments = useMemo(
    () => preview?.sampleAssignments.filter((item) => item.stage === "due_soon") ?? [],
    [preview?.sampleAssignments]
  );
  const commandState = getCommandState({ draftRule, preview, hasUnsavedChanges, isPreviewCurrent });
  const previewTargetDelta =
    latestClassResult && preview ? preview.summary.studentTargets - latestClassResult.studentTargets : null;

  const updateDraft = useCallback((patch: Partial<RuleItem>) => {
    setMessage(null);
    setActionError(null);
    setDraftRule((previous) => ({
      ...previous,
      ...patch,
      classId
    }));
  }, [classId]);

  const actions = useTeacherNotificationRulesActions({
    classId,
    draftRule,
    savedRules,
    isPreviewCurrent,
    classIdRef,
    classChangeRequestIdRef,
    actionRequestIdRef,
    handleAuthRequired,
    clearNotificationScopedState,
    applyClassId,
    upsertSavedRule,
    loadPreview,
    loadHistory,
    load,
    setDraftRule,
    setAuthRequired,
    setMessage,
    setActionError,
    setSaving,
    setRunning
  });

  return {
    classes,
    savedRules,
    classId,
    draftRule,
    preview,
    previewRuleSnapshot,
    history,
    historySummary,
    message,
    loadError,
    actionError,
    loading,
    refreshing,
    previewing,
    historyLoading,
    saving,
    running,
    authRequired,
    lastLoadedAt,
    selectedClass,
    savedRuleForClass,
    hasUnsavedChanges,
    isPreviewCurrent,
    configuredRuleCount,
    enabledRuleCount,
    latestHistory,
    latestClassResult,
    overdueAssignments,
    dueSoonAssignments,
    commandState,
    previewTargetDelta,
    updateDraft,
    ...actions,
    load
  };
}

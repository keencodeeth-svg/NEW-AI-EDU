"use client";

import { type Dispatch, type SetStateAction, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ClassItem,
  KnowledgePoint,
  OutlineFormState,
  OutlineResult,
  PaperFormState,
  PaperGenerationResult,
  QuestionCheckFormState,
  QuestionCheckResult,
  ReviewPackDispatchQuality,
  ReviewPackFailedItem,
  ReviewPackRelaxedItem,
  ReviewPackResult,
  WrongReviewFormState,
  WrongReviewResult
} from "./types";
import {
  getTeacherAiToolsDerivedState,
  pruneTeacherAiToolsKnowledgePointIds,
  resetTeacherAiToolsOutlineFormScope,
  resetTeacherAiToolsPaperFormScope,
  resetTeacherAiToolsWrongFormScope,
  resolveTeacherAiToolsClassId
} from "./utils";

const TEACHER_AI_TOOLS_GUIDE_KEY = "guide:teacher-ai-tools:v1";

function resolveStateAction<T>(nextState: SetStateAction<T>, previousState: T) {
  return typeof nextState === "function"
    ? (nextState as (previousState: T) => T)(previousState)
    : nextState;
}

function areStringArraysEqual(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function useTeacherAiToolsPageState() {
  const bootstrapRequestIdRef = useRef(0);
  const hasClassesSnapshotRef = useRef(false);
  const hasKnowledgePointsSnapshotRef = useRef(false);

  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [knowledgePoints, setKnowledgePoints] = useState<KnowledgePoint[]>([]);
  const [authRequired, setAuthRequired] = useState(false);
  const [pageLoading, setPageLoading] = useState(false);
  const [pageReady, setPageReady] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [bootstrapNotice, setBootstrapNotice] = useState<string | null>(null);
  const [knowledgePointsNotice, setKnowledgePointsNotice] = useState<string | null>(null);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);
  const [paperFormState, setPaperFormState] = useState<PaperFormState>({
    classId: "",
    knowledgePointIds: [],
    difficulty: "all",
    questionType: "all",
    durationMinutes: 40,
    questionCount: 0,
    mode: "ai",
    includeIsolated: false
  });
  const [paperResult, setPaperResult] = useState<PaperGenerationResult | null>(null);
  const [paperError, setPaperError] = useState<string | null>(null);
  const [paperErrorSuggestions, setPaperErrorSuggestions] = useState<string[]>([]);
  const [outlineFormState, setOutlineFormState] = useState<OutlineFormState>({
    classId: "",
    topic: "",
    knowledgePointIds: []
  });
  const [outlineResult, setOutlineResult] = useState<OutlineResult | null>(null);
  const [outlineError, setOutlineError] = useState<string | null>(null);
  const [wrongFormState, setWrongFormState] = useState<WrongReviewFormState>({
    classId: "",
    rangeDays: 7
  });
  const [wrongResult, setWrongResult] = useState<WrongReviewResult | null>(null);
  const [wrongError, setWrongError] = useState<string | null>(null);
  const [reviewPackResult, setReviewPackResult] = useState<ReviewPackResult | null>(null);
  const [reviewPackError, setReviewPackError] = useState<string | null>(null);
  const [reviewPackAssigningId, setReviewPackAssigningId] = useState<string | null>(null);
  const [reviewPackAssigningAll, setReviewPackAssigningAll] = useState(false);
  const [reviewPackAssignMessage, setReviewPackAssignMessage] = useState<string | null>(null);
  const [reviewPackAssignError, setReviewPackAssignError] = useState<string | null>(null);
  const [reviewPackDispatchIncludeIsolated, setReviewPackDispatchIncludeIsolated] = useState(false);
  const [reviewPackDispatchQuality, setReviewPackDispatchQuality] =
    useState<ReviewPackDispatchQuality | null>(null);
  const [reviewPackFailedItems, setReviewPackFailedItems] = useState<ReviewPackFailedItem[]>([]);
  const [reviewPackRelaxedItems, setReviewPackRelaxedItems] = useState<ReviewPackRelaxedItem[]>([]);
  const [reviewPackRetryingFailed, setReviewPackRetryingFailed] = useState(false);
  const [showGuideCard, setShowGuideCard] = useState(true);
  const [paperAutoFixing, setPaperAutoFixing] = useState(false);
  const [paperAutoFixHint, setPaperAutoFixHint] = useState<string | null>(null);
  const [checkForm, setCheckForm] = useState<QuestionCheckFormState>({
    questionId: "",
    stem: "",
    options: ["", "", "", ""],
    answer: "",
    explanation: ""
  });
  const [checkResult, setCheckResult] = useState<QuestionCheckResult | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const resetPaperScope = useCallback((nextClassId = "") => {
    setPaperFormState((prev) => resetTeacherAiToolsPaperFormScope(prev, nextClassId));
    setPaperResult(null);
    setPaperError(null);
    setPaperErrorSuggestions([]);
    setPaperAutoFixHint(null);
  }, []);

  const resetOutlineScope = useCallback((nextClassId = "") => {
    setOutlineFormState((prev) => resetTeacherAiToolsOutlineFormScope(prev, nextClassId));
    setOutlineResult(null);
    setOutlineError(null);
  }, []);

  const resetWrongScope = useCallback((nextClassId = "") => {
    setWrongFormState((prev) => resetTeacherAiToolsWrongFormScope(prev, nextClassId));
    setWrongResult(null);
    setWrongError(null);
    setReviewPackResult(null);
    setReviewPackError(null);
    setReviewPackAssigningId(null);
    setReviewPackAssigningAll(false);
    setReviewPackAssignMessage(null);
    setReviewPackAssignError(null);
    setReviewPackDispatchQuality(null);
    setReviewPackFailedItems([]);
    setReviewPackRelaxedItems([]);
    setReviewPackRetryingFailed(false);
  }, []);

  const handleAuthRequired = useCallback(() => {
    hasClassesSnapshotRef.current = false;
    hasKnowledgePointsSnapshotRef.current = false;

    setClasses([]);
    setKnowledgePoints([]);
    resetPaperScope("");
    resetOutlineScope("");
    resetWrongScope("");
    setCheckResult(null);
    setCheckError(null);
    setPageReady(false);
    setPageError(null);
    setBootstrapNotice(null);
    setKnowledgePointsNotice(null);
    setLastLoadedAt(null);
    setAuthRequired(true);
  }, [resetOutlineScope, resetPaperScope, resetWrongScope]);

  const paperForm = useMemo(() => {
    const nextClassId = resolveTeacherAiToolsClassId(paperFormState.classId, classes);
    const nextPaperClass = classes.find((item) => item.id === nextClassId);
    const nextPaperPointIdSet = new Set(
      (nextPaperClass
        ? knowledgePoints.filter(
            (item) =>
              item.subject === nextPaperClass.subject && item.grade === nextPaperClass.grade
          )
        : []
      ).map((item) => item.id)
    );
    const nextKnowledgePointIds = pruneTeacherAiToolsKnowledgePointIds(
      paperFormState.knowledgePointIds,
      nextPaperPointIdSet
    );
    if (
      nextClassId === paperFormState.classId &&
      areStringArraysEqual(nextKnowledgePointIds, paperFormState.knowledgePointIds)
    ) {
      return paperFormState;
    }
    return {
      ...paperFormState,
      classId: nextClassId,
      knowledgePointIds: nextKnowledgePointIds
    };
  }, [classes, knowledgePoints, paperFormState]);

  const outlineForm = useMemo(() => {
    const nextClassId = resolveTeacherAiToolsClassId(outlineFormState.classId, classes);
    const nextOutlineClass = classes.find((item) => item.id === nextClassId);
    const nextOutlinePointIdSet = new Set(
      (nextOutlineClass
        ? knowledgePoints.filter(
            (item) =>
              item.subject === nextOutlineClass.subject && item.grade === nextOutlineClass.grade
          )
        : []
      ).map((item) => item.id)
    );
    const nextKnowledgePointIds = pruneTeacherAiToolsKnowledgePointIds(
      outlineFormState.knowledgePointIds,
      nextOutlinePointIdSet
    );
    if (
      nextClassId === outlineFormState.classId &&
      areStringArraysEqual(nextKnowledgePointIds, outlineFormState.knowledgePointIds)
    ) {
      return outlineFormState;
    }
    return {
      ...outlineFormState,
      classId: nextClassId,
      knowledgePointIds: nextKnowledgePointIds
    };
  }, [classes, knowledgePoints, outlineFormState]);

  const wrongForm = useMemo(() => {
    const nextClassId = resolveTeacherAiToolsClassId(wrongFormState.classId, classes);
    if (nextClassId === wrongFormState.classId) {
      return wrongFormState;
    }
    return {
      ...wrongFormState,
      classId: nextClassId
    };
  }, [classes, wrongFormState]);

  const derivedState = useMemo(
    () =>
      getTeacherAiToolsDerivedState({
        classes,
        knowledgePoints,
        paperForm,
        outlineForm,
        checkForm
      }),
    [checkForm, classes, knowledgePoints, outlineForm, paperForm]
  );

  const setPaperForm = useCallback<Dispatch<SetStateAction<PaperFormState>>>((nextState) => {
    const nextForm = resolveStateAction(nextState, paperForm);
    const nextClassId = resolveTeacherAiToolsClassId(nextForm.classId, classes);
    if (nextClassId !== paperForm.classId) {
      resetPaperScope(nextClassId);
      return;
    }
    const nextKnowledgePointIds = pruneTeacherAiToolsKnowledgePointIds(
      nextForm.knowledgePointIds,
      derivedState.paperPointIdSet
    );
    setPaperFormState({
      ...nextForm,
      classId: nextClassId,
      knowledgePointIds: nextKnowledgePointIds
    });
  }, [classes, derivedState.paperPointIdSet, paperForm, resetPaperScope]);

  const setOutlineForm = useCallback<Dispatch<SetStateAction<OutlineFormState>>>((nextState) => {
    const nextForm = resolveStateAction(nextState, outlineForm);
    const nextClassId = resolveTeacherAiToolsClassId(nextForm.classId, classes);
    if (nextClassId !== outlineForm.classId) {
      resetOutlineScope(nextClassId);
      return;
    }
    const nextKnowledgePointIds = pruneTeacherAiToolsKnowledgePointIds(
      nextForm.knowledgePointIds,
      derivedState.outlinePointIdSet
    );
    setOutlineFormState({
      ...nextForm,
      classId: nextClassId,
      knowledgePointIds: nextKnowledgePointIds
    });
  }, [classes, derivedState.outlinePointIdSet, outlineForm, resetOutlineScope]);

  const setWrongForm = useCallback<Dispatch<SetStateAction<WrongReviewFormState>>>((nextState) => {
    const nextForm = resolveStateAction(nextState, wrongForm);
    const nextClassId = resolveTeacherAiToolsClassId(nextForm.classId, classes);
    if (nextClassId !== wrongForm.classId) {
      resetWrongScope(nextClassId);
      return;
    }
    setWrongFormState({
      ...nextForm,
      classId: nextClassId
    });
  }, [classes, resetWrongScope, wrongForm]);

  useEffect(() => {
    const nextShowGuideCard = (() => {
      try {
        return window.localStorage.getItem(TEACHER_AI_TOOLS_GUIDE_KEY) !== "hidden";
      } catch {
        return true;
      }
    })();
    const frameId = window.requestAnimationFrame(() => {
      setShowGuideCard(nextShowGuideCard);
    });
    return () => window.cancelAnimationFrame(frameId);
  }, []);

  const hideGuideCard = useCallback(() => {
    setShowGuideCard(false);
    try {
      window.localStorage.setItem(TEACHER_AI_TOOLS_GUIDE_KEY, "hidden");
    } catch {
      // ignore localStorage errors
    }
  }, []);

  const showGuideAgain = useCallback(() => {
    setShowGuideCard(true);
    try {
      window.localStorage.removeItem(TEACHER_AI_TOOLS_GUIDE_KEY);
    } catch {
      // ignore localStorage errors
    }
  }, []);

  return {
    bootstrapRequestIdRef,
    hasClassesSnapshotRef,
    hasKnowledgePointsSnapshotRef,
    classes,
    knowledgePoints,
    authRequired,
    pageLoading,
    pageReady,
    pageError,
    bootstrapNotice,
    knowledgePointsNotice,
    lastLoadedAt,
    paperForm,
    paperResult,
    paperError,
    paperErrorSuggestions,
    outlineForm,
    outlineResult,
    outlineError,
    wrongForm,
    wrongResult,
    wrongError,
    reviewPackResult,
    reviewPackError,
    reviewPackAssigningId,
    reviewPackAssigningAll,
    reviewPackAssignMessage,
    reviewPackAssignError,
    reviewPackDispatchIncludeIsolated,
    reviewPackDispatchQuality,
    reviewPackFailedItems,
    reviewPackRelaxedItems,
    reviewPackRetryingFailed,
    showGuideCard,
    paperAutoFixing,
    paperAutoFixHint,
    checkForm,
    checkResult,
    checkError,
    loading,
    paperPoints: derivedState.paperPoints,
    outlinePoints: derivedState.outlinePoints,
    checkPreviewOptions: derivedState.checkPreviewOptions,
    hasCheckPreview: derivedState.hasCheckPreview,
    setClasses,
    setKnowledgePoints,
    setAuthRequired,
    setPageLoading,
    setPageReady,
    setPageError,
    setBootstrapNotice,
    setKnowledgePointsNotice,
    setLastLoadedAt,
    setPaperForm,
    setPaperResult,
    setPaperError,
    setPaperErrorSuggestions,
    setOutlineForm,
    setOutlineResult,
    setOutlineError,
    setWrongForm,
    setWrongResult,
    setWrongError,
    setReviewPackResult,
    setReviewPackError,
    setReviewPackAssigningId,
    setReviewPackAssigningAll,
    setReviewPackAssignMessage,
    setReviewPackAssignError,
    setReviewPackDispatchIncludeIsolated,
    setReviewPackDispatchQuality,
    setReviewPackFailedItems,
    setReviewPackRelaxedItems,
    setReviewPackRetryingFailed,
    setShowGuideCard,
    setPaperAutoFixing,
    setPaperAutoFixHint,
    setCheckForm,
    setCheckResult,
    setCheckError,
    setLoading,
    resetPaperScope,
    resetOutlineScope,
    resetWrongScope,
    handleAuthRequired,
    hideGuideCard,
    showGuideAgain
  };
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type SetStateAction } from "react";
import { useAdminStepUp } from "@/components/useAdminStepUp";
import type {
  AiQuestionForm,
  KnowledgePoint,
  Question,
  QuestionFacets,
  QuestionForm,
  QuestionListMeta,
  QuestionQualitySummary,
  QuestionQuery,
  QuestionTreeNode
} from "./types";
import {
  filterAdminQuestionsKnowledgePoints,
  getAdminQuestionsChapterOptions,
  getAdminQuestionsPageRange,
  INITIAL_ADMIN_AI_QUESTION_FORM,
  INITIAL_ADMIN_QUESTION_FORM,
  INITIAL_ADMIN_QUESTIONS_FACETS,
  INITIAL_ADMIN_QUESTIONS_META,
  INITIAL_ADMIN_QUESTIONS_QUERY,
  resolveAdminQuestionsFormSelections
} from "./utils";
import { useAdminQuestionsListActions } from "./useAdminQuestionsListActions";
import { useAdminQuestionsPageLoaders } from "./useAdminQuestionsPageLoaders";
import { useAdminQuestionsToolActions } from "./useAdminQuestionsToolActions";

function applyStateAction<T>(action: SetStateAction<T>, current: T) {
  return typeof action === "function" ? (action as (previous: T) => T)(current) : action;
}

export function useAdminQuestionsPage() {
  const { runWithStepUp, stepUpDialog } = useAdminStepUp();
  const knowledgePointsRequestIdRef = useRef(0);
  const questionsRequestIdRef = useRef(0);
  const importRequestIdRef = useRef(0);
  const aiRequestIdRef = useRef(0);
  const createRequestIdRef = useRef(0);
  const listActionRequestIdRef = useRef(0);
  const recheckRequestIdRef = useRef(0);
  const queryRef = useRef<QuestionQuery>(INITIAL_ADMIN_QUESTIONS_QUERY);
  const pageRef = useRef(1);
  const pageSizeRef = useRef(20);
  const hasKnowledgePointsSnapshotRef = useRef(false);
  const [list, setList] = useState<Question[]>([]);
  const [knowledgePoints, setKnowledgePoints] = useState<KnowledgePoint[]>([]);
  const [workspace, setWorkspace] = useState<"list" | "tools">("list");
  const [authRequired, setAuthRequired] = useState(false);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState<QuestionQuery>(INITIAL_ADMIN_QUESTIONS_QUERY);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [meta, setMeta] = useState<QuestionListMeta>(INITIAL_ADMIN_QUESTIONS_META);
  const [tree, setTree] = useState<QuestionTreeNode[]>([]);
  const [qualitySummary, setQualitySummary] = useState<QuestionQualitySummary | null>(null);
  const [facets, setFacets] = useState<QuestionFacets>(INITIAL_ADMIN_QUESTIONS_FACETS);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [formState, setFormState] = useState<QuestionForm>(INITIAL_ADMIN_QUESTION_FORM);
  const [aiFormState, setAiFormState] = useState<AiQuestionForm>(INITIAL_ADMIN_AI_QUESTION_FORM);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const [aiErrors, setAiErrors] = useState<string[]>([]);
  const [recheckLoading, setRecheckLoading] = useState(false);
  const [recheckMessage, setRecheckMessage] = useState<string | null>(null);
  const [recheckError, setRecheckError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [pageActionError, setPageActionError] = useState<string | null>(null);
  const [knowledgePointsLoadError, setKnowledgePointsLoadError] = useState<string | null>(null);
  const [questionsLoadError, setQuestionsLoadError] = useState<string | null>(null);

  useEffect(() => {
    queryRef.current = query;
  }, [query]);

  useEffect(() => {
    pageRef.current = page;
  }, [page]);

  useEffect(() => {
    pageSizeRef.current = pageSize;
  }, [pageSize]);

  const setForm = useCallback((next: SetStateAction<QuestionForm>) => {
    setFormState((current) => applyStateAction(next, current));
  }, []);

  const setAiForm = useCallback((next: SetStateAction<AiQuestionForm>) => {
    setAiFormState((current) => applyStateAction(next, current));
  }, []);

  const formKnowledgePoints = useMemo(
    () => filterAdminQuestionsKnowledgePoints(knowledgePoints, formState.subject, formState.grade),
    [formState.grade, formState.subject, knowledgePoints]
  );
  const aiKnowledgePoints = useMemo(
    () => filterAdminQuestionsKnowledgePoints(knowledgePoints, aiFormState.subject, aiFormState.grade),
    [aiFormState.grade, aiFormState.subject, knowledgePoints]
  );
  const chapterOptions = useMemo(
    () => getAdminQuestionsChapterOptions(knowledgePoints, aiFormState.subject, aiFormState.grade),
    [aiFormState.grade, aiFormState.subject, knowledgePoints]
  );
  const loadError = questionsLoadError ?? knowledgePointsLoadError;

  const {
    handleAuthRequired,
    removeQuestionFromCurrentPage,
    loadKnowledgePoints,
    loadQuestions
  } = useAdminQuestionsPageLoaders({
    knowledgePointsRequestIdRef,
    questionsRequestIdRef,
    importRequestIdRef,
    aiRequestIdRef,
    createRequestIdRef,
    listActionRequestIdRef,
    recheckRequestIdRef,
    queryRef,
    pageRef,
    pageSizeRef,
    hasKnowledgePointsSnapshotRef,
    setList,
    setKnowledgePoints,
    setLoading,
    setAiLoading,
    setRecheckLoading,
    setAuthRequired,
    setMeta,
    setTree,
    setQualitySummary,
    setFacets,
    setKnowledgePointsLoadError,
    setQuestionsLoadError
  });

  useEffect(() => {
    void loadKnowledgePoints();
  }, [loadKnowledgePoints]);

  useEffect(() => {
    void loadQuestions({ query, page, pageSize });
  }, [loadQuestions, page, pageSize, query]);

  const resolvedSelections = useMemo(
    () =>
      resolveAdminQuestionsFormSelections({
        form: formState,
        aiForm: aiFormState,
        formKnowledgePoints,
        aiKnowledgePoints,
        chapterOptions
      }),
    [aiFormState, aiKnowledgePoints, chapterOptions, formKnowledgePoints, formState]
  );

  const form = useMemo(
    () =>
      resolvedSelections.nextFormKnowledgePointId === formState.knowledgePointId
        ? formState
        : { ...formState, knowledgePointId: resolvedSelections.nextFormKnowledgePointId },
    [formState, resolvedSelections.nextFormKnowledgePointId]
  );

  const aiForm = useMemo(() => {
    const nextKnowledgePointId = resolvedSelections.nextAiKnowledgePointId;
    const nextChapter = resolvedSelections.nextAiChapter;
    if (nextKnowledgePointId === aiFormState.knowledgePointId && nextChapter === aiFormState.chapter) {
      return aiFormState;
    }
    return {
      ...aiFormState,
      knowledgePointId: nextKnowledgePointId,
      chapter: nextChapter
    };
  }, [aiFormState, resolvedSelections.nextAiChapter, resolvedSelections.nextAiKnowledgePointId]);

  const patchQuery = useCallback((next: Partial<QuestionQuery>) => {
    setQuery((prev) => ({ ...prev, ...next }));
    setPage(1);
  }, []);

  const { handleImport, handleGenerate, handleCreate } = useAdminQuestionsToolActions({
    aiForm,
    form,
    knowledgePoints,
    runWithStepUp,
    handleAuthRequired,
    loadKnowledgePoints,
    loadQuestions,
    importRequestIdRef,
    aiRequestIdRef,
    createRequestIdRef,
    setImportMessage,
    setImportErrors,
    setPageActionError,
    setAiMessage,
    setAiErrors,
    setAiLoading,
    setCreateError,
    setForm
  });

  const { handleDelete, handleToggleIsolation, handleRecheckQuality } = useAdminQuestionsListActions({
    query,
    runWithStepUp,
    handleAuthRequired,
    loadQuestions,
    removeQuestionFromCurrentPage,
    listActionRequestIdRef,
    recheckRequestIdRef,
    setPageActionError,
    setRecheckMessage,
    setRecheckError,
    setRecheckLoading
  });

  const { start: pageStart, end: pageEnd } = getAdminQuestionsPageRange(meta);

  return {
    stepUpDialog,
    authRequired,
    list,
    knowledgePoints,
    workspace,
    setWorkspace,
    loading,
    query,
    page,
    setPage,
    pageSize,
    setPageSize,
    meta,
    tree,
    qualitySummary,
    facets,
    importMessage,
    importErrors,
    form,
    setForm,
    aiForm,
    setAiForm,
    aiLoading,
    aiMessage,
    aiErrors,
    recheckLoading,
    recheckMessage,
    recheckError,
    createError,
    pageActionError,
    loadError,
    chapterOptions,
    aiKnowledgePoints,
    formKnowledgePoints,
    patchQuery,
    handleImport,
    handleGenerate,
    handleCreate,
    handleDelete,
    handleToggleIsolation,
    handleRecheckQuality,
    pageStart,
    pageEnd
  };
}

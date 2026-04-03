"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type SetStateAction } from "react";
import { useAdminStepUp } from "@/components/useAdminStepUp";
import type {
  AiKnowledgePointForm,
  BatchForm,
  KnowledgePoint,
  KnowledgePointBatchPreviewItem,
  KnowledgePointFacets,
  KnowledgePointForm,
  KnowledgePointListMeta,
  KnowledgePointQuery,
  KnowledgePointTreeNode,
  TreeForm
} from "./types";
import {
  createInitialAiKnowledgePointForm,
  createInitialBatchForm,
  createInitialKnowledgePointFacets,
  createInitialKnowledgePointForm,
  createInitialKnowledgePointMeta,
  createInitialKnowledgePointQuery,
  createInitialTreeForm,
  removeKnowledgePointSnapshot,
  resolveKnowledgePointChapter,
  resolveKnowledgePointChapterOptions
} from "./utils";
import { useAdminKnowledgePointsActions } from "./useAdminKnowledgePointsActions";
import { useAdminKnowledgePointsLoaders } from "./useAdminKnowledgePointsLoaders";

function applyStateAction<T>(action: SetStateAction<T>, current: T) {
  return typeof action === "function" ? (action as (previous: T) => T)(current) : action;
}

export function useAdminKnowledgePointsPage() {
  const { runWithStepUp, stepUpDialog } = useAdminStepUp();
  const allKnowledgePointsRequestIdRef = useRef(0);
  const knowledgePointListRequestIdRef = useRef(0);
  const createRequestIdRef = useRef(0);
  const aiRequestIdRef = useRef(0);
  const treeRequestIdRef = useRef(0);
  const batchPreviewRequestIdRef = useRef(0);
  const batchConfirmRequestIdRef = useRef(0);
  const deleteRequestIdRef = useRef(0);
  const queryRef = useRef<KnowledgePointQuery>(createInitialKnowledgePointQuery());
  const pageRef = useRef(1);
  const pageSizeRef = useRef(20);
  const hasAllKnowledgePointsSnapshotRef = useRef(false);
  const hasKnowledgePointListSnapshotRef = useRef(false);
  const listRef = useRef<KnowledgePoint[]>([]);
  const allKnowledgePointsRef = useRef<KnowledgePoint[]>([]);
  const metaRef = useRef<KnowledgePointListMeta>(createInitialKnowledgePointMeta());
  const [list, setList] = useState<KnowledgePoint[]>([]);
  const [allKnowledgePoints, setAllKnowledgePoints] = useState<KnowledgePoint[]>([]);
  const [workspace, setWorkspace] = useState<"list" | "tools">("list");
  const [authRequired, setAuthRequired] = useState(false);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState<KnowledgePointQuery>(createInitialKnowledgePointQuery);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [meta, setMeta] = useState<KnowledgePointListMeta>(createInitialKnowledgePointMeta);
  const [tree, setTree] = useState<KnowledgePointTreeNode[]>([]);
  const [facets, setFacets] = useState<KnowledgePointFacets>(createInitialKnowledgePointFacets);
  const [form, setForm] = useState<KnowledgePointForm>(createInitialKnowledgePointForm);
  const [aiFormState, setAiFormState] = useState<AiKnowledgePointForm>(createInitialAiKnowledgePointForm);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const [aiErrors, setAiErrors] = useState<string[]>([]);
  const [treeForm, setTreeForm] = useState<TreeForm>(createInitialTreeForm);
  const [treeLoading, setTreeLoading] = useState(false);
  const [treeMessage, setTreeMessage] = useState<string | null>(null);
  const [treeErrors, setTreeErrors] = useState<string[]>([]);
  const [batchForm, setBatchForm] = useState<BatchForm>(createInitialBatchForm);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [batchMessage, setBatchMessage] = useState<string | null>(null);
  const [batchProgress, setBatchProgress] = useState<string | null>(null);
  const [batchPreview, setBatchPreview] = useState<KnowledgePointBatchPreviewItem[]>([]);
  const [batchConfirming, setBatchConfirming] = useState(false);
  const [batchShowDetail, setBatchShowDetail] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pageActionError, setPageActionError] = useState<string | null>(null);
  const [allKnowledgePointsLoadError, setAllKnowledgePointsLoadError] = useState<string | null>(null);
  const [knowledgePointListLoadError, setKnowledgePointListLoadError] = useState<string | null>(null);

  useEffect(() => {
    queryRef.current = query;
  }, [query]);

  useEffect(() => {
    pageRef.current = page;
  }, [page]);

  useEffect(() => {
    pageSizeRef.current = pageSize;
  }, [pageSize]);

  const syncList = useCallback((nextList: KnowledgePoint[]) => {
    listRef.current = nextList;
    setList(nextList);
  }, []);

  const syncAllKnowledgePoints = useCallback((nextKnowledgePoints: KnowledgePoint[]) => {
    allKnowledgePointsRef.current = nextKnowledgePoints;
    setAllKnowledgePoints(nextKnowledgePoints);
  }, []);

  const syncMeta = useCallback((nextMeta: KnowledgePointListMeta) => {
    metaRef.current = nextMeta;
    setMeta(nextMeta);
  }, []);

  const setAiForm = useCallback((next: SetStateAction<AiKnowledgePointForm>) => {
    setAiFormState((current) => applyStateAction(next, current));
  }, []);

  const chapterOptions = useMemo(
    () => resolveKnowledgePointChapterOptions(allKnowledgePoints, aiFormState.subject, aiFormState.grade),
    [aiFormState.grade, aiFormState.subject, allKnowledgePoints]
  );
  const loadError = knowledgePointListLoadError ?? allKnowledgePointsLoadError;

  const removeKnowledgePointFromState = useCallback((knowledgePointId: string) => {
    const nextSnapshot = removeKnowledgePointSnapshot(
      listRef.current,
      allKnowledgePointsRef.current,
      metaRef.current,
      knowledgePointId
    );
    syncList(nextSnapshot.list);
    syncAllKnowledgePoints(nextSnapshot.allKnowledgePoints);
    syncMeta(nextSnapshot.meta);
  }, [syncAllKnowledgePoints, syncList, syncMeta]);

  const handleAuthRequired = useCallback(() => {
    allKnowledgePointsRequestIdRef.current += 1;
    knowledgePointListRequestIdRef.current += 1;
    createRequestIdRef.current += 1;
    aiRequestIdRef.current += 1;
    treeRequestIdRef.current += 1;
    batchPreviewRequestIdRef.current += 1;
    batchConfirmRequestIdRef.current += 1;
    deleteRequestIdRef.current += 1;
    setLoading(false);
    setAiLoading(false);
    setTreeLoading(false);
    setBatchLoading(false);
    setBatchConfirming(false);
    setBatchProgress(null);
    setAuthRequired(true);
  }, []);

  const { loadAllKnowledgePoints, loadKnowledgePointList } = useAdminKnowledgePointsLoaders({
    queryRef,
    pageRef,
    pageSizeRef,
    allKnowledgePointsRequestIdRef,
    knowledgePointListRequestIdRef,
    hasAllKnowledgePointsSnapshotRef,
    hasKnowledgePointListSnapshotRef,
    handleAuthRequired,
    syncAllKnowledgePoints,
    syncList,
    syncMeta,
    setTree,
    setFacets,
    setLoading,
    setAuthRequired,
    setAllKnowledgePointsLoadError,
    setKnowledgePointListLoadError
  });

  useEffect(() => {
    void loadAllKnowledgePoints();
  }, [loadAllKnowledgePoints]);

  useEffect(() => {
    void loadKnowledgePointList({ query, page, pageSize });
  }, [loadKnowledgePointList, page, pageSize, query]);

  const aiForm = useMemo(() => {
    const nextChapter = resolveKnowledgePointChapter(chapterOptions, aiFormState.chapter);
    if (nextChapter === aiFormState.chapter) {
      return aiFormState;
    }
    return {
      ...aiFormState,
      chapter: nextChapter
    };
  }, [aiFormState, chapterOptions]);

  const patchQuery = useCallback((next: Partial<KnowledgePointQuery>) => {
    setQuery((current) => ({ ...current, ...next }));
    setPage(1);
  }, []);

  const clearBatchPreview = useCallback(() => {
    setBatchPreview([]);
    setBatchProgress(null);
    setBatchError(null);
    setBatchMessage(null);
  }, []);

  const actions = useAdminKnowledgePointsActions({
    form,
    aiForm,
    treeForm,
    batchForm,
    batchPreview,
    runWithStepUp,
    handleAuthRequired,
    loadAllKnowledgePoints,
    loadKnowledgePointList,
    removeKnowledgePointFromState,
    createRequestIdRef,
    aiRequestIdRef,
    treeRequestIdRef,
    batchPreviewRequestIdRef,
    batchConfirmRequestIdRef,
    deleteRequestIdRef,
    setForm,
    setFormError,
    setPageActionError,
    setAiLoading,
    setAiMessage,
    setAiErrors,
    setTreeLoading,
    setTreeMessage,
    setTreeErrors,
    setBatchLoading,
    setBatchError,
    setBatchMessage,
    setBatchProgress,
    setBatchPreview,
    setBatchConfirming
  });

  const pageStart = meta.total === 0 ? 0 : (meta.page - 1) * meta.pageSize + 1;
  const pageEnd = meta.total === 0 ? 0 : Math.min(meta.total, meta.page * meta.pageSize);

  return {
    authRequired,
    workspace,
    setWorkspace,
    list,
    loading,
    query,
    page,
    setPage,
    pageSize,
    setPageSize,
    meta,
    tree,
    facets,
    form,
    setForm,
    formError,
    aiForm,
    setAiForm,
    chapterOptions,
    aiLoading,
    aiMessage,
    aiErrors,
    treeForm,
    setTreeForm,
    treeLoading,
    treeMessage,
    treeErrors,
    batchForm,
    setBatchForm,
    batchLoading,
    batchError,
    batchMessage,
    batchProgress,
    batchPreview,
    batchShowDetail,
    setBatchShowDetail,
    batchConfirming,
    loadError,
    pageActionError,
    pageStart,
    pageEnd,
    patchQuery,
    clearBatchPreview,
    handleCreate: actions.handleCreate,
    handleAiGenerate: actions.handleAiGenerate,
    handleTreeGenerate: actions.handleTreeGenerate,
    handleBatchPreview: actions.handleBatchPreview,
    handleBatchConfirm: actions.handleBatchConfirm,
    handleDelete: actions.handleDelete,
    stepUpDialog
  };
}

"use client";

import { type Dispatch, type SetStateAction, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAdminStepUp } from "@/components/useAdminStepUp";
import type {
  BatchImportSummary,
  ClassItem,
  LibraryAiFormState,
  LibraryBatchPreview,
  LibraryContentFilter,
  LibraryFacets,
  LibraryImportFormState,
  LibraryItem,
  LibraryMeta,
  LibrarySummary,
  LibraryUser,
  LibraryViewMode
} from "./types";
import { useLibraryPageActions } from "./useLibraryPageActions";
import { useLibraryPageLoaders } from "./useLibraryPageLoaders";
import {
  DEFAULT_FACETS,
  DEFAULT_META,
  DEFAULT_SUMMARY,
  buildLibraryExpandedTypeKeys,
  buildLibrarySubjectGroups,
  buildLibrarySubjectList,
  pruneExpandedLibrarySubjects,
  pruneExpandedLibraryTypeKeys,
  removeLibraryItemSnapshot
} from "./utils";

function resolveStateAction<T>(nextState: SetStateAction<T>, previousState: T) {
  return typeof nextState === "function"
    ? (nextState as (previousState: T) => T)(previousState)
    : nextState;
}

export function useLibraryPage() {
  const { runWithStepUp, stepUpDialog } = useAdminStepUp();
  const userRequestIdRef = useRef(0);
  const listRequestIdRef = useRef(0);
  const classesRequestIdRef = useRef(0);
  const hasListSnapshotRef = useRef(false);
  const pageRef = useRef(1);
  const pageSizeRef = useRef(16);
  const subjectFilterRef = useRef("all");
  const contentFilterRef = useRef<LibraryContentFilter>("all");
  const keywordRef = useRef("");
  const itemsRef = useRef<LibraryItem[]>([]);
  const metaRef = useRef<LibraryMeta>(DEFAULT_META);
  const facetsRef = useRef<LibraryFacets>(DEFAULT_FACETS);
  const summaryRef = useRef<LibrarySummary>(DEFAULT_SUMMARY);

  const [user, setUser] = useState<LibraryUser>(null);
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [authRequired, setAuthRequired] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [pageReady, setPageReady] = useState(false);
  const [bootstrapNotice, setBootstrapNotice] = useState<string | null>(null);
  const [classesNotice, setClassesNotice] = useState<string | null>(null);
  const [listNotice, setListNotice] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [importForm, setImportForm] = useState<LibraryImportFormState>({
    title: "",
    description: "",
    subject: "math",
    grade: "4",
    contentType: "textbook",
    sourceType: "file",
    textContent: "",
    linkUrl: ""
  });
  const [importFile, setImportFile] = useState<File | null>(null);
  const [batchFile, setBatchFile] = useState<File | null>(null);
  const [batchPreview, setBatchPreview] = useState<LibraryBatchPreview | null>(null);
  const [batchSummary, setBatchSummary] = useState<BatchImportSummary | null>(null);
  const [batchFailedPreview, setBatchFailedPreview] = useState<string[]>([]);

  const [aiForm, setAiForm] = useState<LibraryAiFormState>({
    classId: "",
    topic: "",
    contentType: "lesson_plan"
  });
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [contentFilter, setContentFilter] = useState<LibraryContentFilter>("all");
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(16);
  const [meta, setMeta] = useState<LibraryMeta>(DEFAULT_META);
  const [facets, setFacets] = useState<LibraryFacets>(DEFAULT_FACETS);
  const [summary, setSummary] = useState<LibrarySummary>(DEFAULT_SUMMARY);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedSubjects, setExpandedSubjects] = useState<string[]>([]);
  const [expandedTypeKeys, setExpandedTypeKeys] = useState<string[]>([]);
  const [libraryViewMode, setLibraryViewMode] = useState<LibraryViewMode>("compact");

  const setPageState = useCallback<Dispatch<SetStateAction<number>>>((nextState) => {
    setPage((previousPage) => {
      const nextPage = resolveStateAction(nextState, previousPage);
      pageRef.current = nextPage;
      return nextPage;
    });
  }, []);

  const setPageSizeState = useCallback<Dispatch<SetStateAction<number>>>((nextState) => {
    setPageSize((previousPageSize) => {
      const nextPageSize = resolveStateAction(nextState, previousPageSize);
      pageSizeRef.current = nextPageSize;
      return nextPageSize;
    });
    setPageState(1);
  }, [setPageState]);

  const setSubjectFilterState = useCallback<Dispatch<SetStateAction<string>>>((nextState) => {
    setSubjectFilter((previousSubjectFilter) => {
      const nextSubjectFilter = resolveStateAction(nextState, previousSubjectFilter);
      subjectFilterRef.current = nextSubjectFilter;
      return nextSubjectFilter;
    });
    setPageState(1);
  }, [setPageState]);

  const setContentFilterState = useCallback<Dispatch<SetStateAction<LibraryContentFilter>>>((nextState) => {
    setContentFilter((previousContentFilter) => {
      const nextContentFilter = resolveStateAction(nextState, previousContentFilter);
      contentFilterRef.current = nextContentFilter;
      return nextContentFilter;
    });
    setPageState(1);
  }, [setPageState]);

  const setKeywordState = useCallback<Dispatch<SetStateAction<string>>>((nextState) => {
    setKeyword((previousKeyword) => {
      const nextKeyword = resolveStateAction(nextState, previousKeyword);
      keywordRef.current = nextKeyword;
      return nextKeyword;
    });
    setPageState(1);
  }, [setPageState]);

  const setImportFormState = useCallback<Dispatch<SetStateAction<LibraryImportFormState>>>((nextState) => {
    setImportForm((previousImportForm) => {
      const nextImportForm = resolveStateAction(nextState, previousImportForm);
      if (nextImportForm.contentType !== "textbook") {
        return nextImportForm;
      }
      if (
        nextImportForm.sourceType === "file" &&
        nextImportForm.textContent === "" &&
        nextImportForm.linkUrl === ""
      ) {
        return nextImportForm;
      }
      return {
        ...nextImportForm,
        sourceType: "file",
        textContent: "",
        linkUrl: ""
      };
    });
  }, []);

  const syncUser = useCallback((nextUser: LibraryUser) => {
    setUser(nextUser);
  }, []);

  const syncItems = useCallback((nextItems: LibraryItem[]) => {
    itemsRef.current = nextItems;
    setItems(nextItems);
  }, []);

  const syncClasses = useCallback((nextClasses: ClassItem[]) => {
    setClasses(nextClasses);
  }, []);

  const syncMeta = useCallback((nextMeta: LibraryMeta) => {
    metaRef.current = nextMeta;
    setMeta(nextMeta);
  }, []);

  const syncFacets = useCallback((nextFacets: LibraryFacets) => {
    facetsRef.current = nextFacets;
    setFacets(nextFacets);
  }, []);

  const syncSummary = useCallback((nextSummary: LibrarySummary) => {
    summaryRef.current = nextSummary;
    setSummary(nextSummary);
  }, []);

  const removeItemFromSnapshot = useCallback((item: LibraryItem) => {
    const nextSnapshot = removeLibraryItemSnapshot(
      itemsRef.current,
      metaRef.current,
      facetsRef.current,
      summaryRef.current,
      item
    );
    syncItems(nextSnapshot.items);
    syncMeta(nextSnapshot.meta);
    syncFacets(nextSnapshot.facets);
    syncSummary(nextSnapshot.summary);
    if (nextSnapshot.meta.page !== pageRef.current) {
      setPageState(nextSnapshot.meta.page);
    }
  }, [setPageState, syncFacets, syncItems, syncMeta, syncSummary]);

  const { loadUser, loadItems, loadTeacherClasses } = useLibraryPageLoaders({
    userRequestIdRef,
    listRequestIdRef,
    classesRequestIdRef,
    hasListSnapshotRef,
    pageRef,
    pageSizeRef,
    subjectFilterRef,
    contentFilterRef,
    keywordRef,
    syncUser,
    syncItems,
    syncClasses,
    syncMeta,
    syncFacets,
    syncSummary,
    setPage: setPageState,
    setAiForm,
    setLoading,
    setAuthRequired,
    setPageError,
    setPageReady,
    setBootstrapNotice,
    setClassesNotice,
    setListNotice
  });

  useEffect(() => {
    void loadUser();
  }, [loadUser]);

  useEffect(() => {
    void loadItems();
  }, [contentFilter, keyword, loadItems, page, pageSize, subjectFilter]);

  useEffect(() => {
    void loadTeacherClasses(user?.role);
  }, [loadTeacherClasses, user?.role]);

  const subjectList = useMemo(() => buildLibrarySubjectList(facets), [facets]);
  const groupedBySubject = useMemo(() => buildLibrarySubjectGroups(items), [items]);
  const visibleExpandedSubjects = useMemo(
    () => pruneExpandedLibrarySubjects(expandedSubjects, groupedBySubject),
    [expandedSubjects, groupedBySubject]
  );
  const visibleExpandedTypeKeys = useMemo(
    () => pruneExpandedLibraryTypeKeys(expandedTypeKeys, groupedBySubject),
    [expandedTypeKeys, groupedBySubject]
  );

  const toggleExpandedSubject = useCallback((subject: string) => {
    setExpandedSubjects((prev) =>
      {
        const nextVisibleSubjects = pruneExpandedLibrarySubjects(prev, groupedBySubject);
        return nextVisibleSubjects.includes(subject)
          ? nextVisibleSubjects.filter((item) => item !== subject)
          : [...nextVisibleSubjects, subject];
      }
    );
  }, [groupedBySubject]);

  const toggleExpandedType = useCallback((typeKey: string) => {
    setExpandedTypeKeys((prev) =>
      {
        const nextVisibleTypeKeys = pruneExpandedLibraryTypeKeys(prev, groupedBySubject);
        return nextVisibleTypeKeys.includes(typeKey)
          ? nextVisibleTypeKeys.filter((item) => item !== typeKey)
          : [...nextVisibleTypeKeys, typeKey];
      }
    );
  }, [groupedBySubject]);

  const setAllSubjectsExpanded = useCallback((expanded: boolean) => {
    if (!expanded) {
      setExpandedSubjects([]);
      return;
    }
    setExpandedSubjects(groupedBySubject.map((group) => group.subject));
  }, [groupedBySubject]);

  const setAllTypesExpanded = useCallback((expanded: boolean) => {
    if (!expanded) {
      setExpandedTypeKeys([]);
      return;
    }
    setExpandedTypeKeys(buildLibraryExpandedTypeKeys(groupedBySubject));
  }, [groupedBySubject]);

  const reload = useCallback(async () => {
    setPageError(null);
    setError(null);
    await Promise.allSettled([loadUser(), loadItems()]);
  }, [loadItems, loadUser]);

  const actions = useLibraryPageActions({
    user,
    importForm,
    importFile,
    batchFile,
    aiForm,
    runWithStepUp,
    loadItems,
    removeItemFromSnapshot,
    setAuthRequired,
    setMessage,
    setError,
    setImportForm: setImportFormState,
    setImportFile,
    setBatchPreview,
    setBatchSummary,
    setBatchFailedPreview,
    setAiForm,
    setDeletingId,
    setBatchFile
  });

  return {
    user,
    classes,
    items,
    loading,
    authRequired,
    pageError,
    pageReady,
    bootstrapNotice,
    classesNotice,
    listNotice,
    message,
    error,
    importForm,
    setImportForm: setImportFormState,
    setImportFile,
    batchPreview,
    batchSummary,
    batchFailedPreview,
    aiForm,
    setAiForm,
    subjectList,
    facets,
    subjectFilter,
    setSubjectFilter: setSubjectFilterState,
    contentFilter,
    setContentFilter: setContentFilterState,
    keyword,
    setKeyword: setKeywordState,
    pageSize,
    setPageSize: setPageSizeState,
    meta,
    summary,
    deletingId,
    expandedSubjects: visibleExpandedSubjects,
    expandedTypeKeys: visibleExpandedTypeKeys,
    libraryViewMode,
    setLibraryViewMode,
    groupedBySubject,
    stepUpDialog,
    reload,
    setPage: setPageState,
    toggleExpandedSubject,
    toggleExpandedType,
    setAllSubjectsExpanded,
    setAllTypesExpanded,
    ...actions
  };
}

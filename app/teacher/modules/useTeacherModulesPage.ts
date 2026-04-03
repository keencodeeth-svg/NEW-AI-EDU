"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ClassItem,
  ModuleItem,
  ModuleResourceItem,
  ModuleResourceType
} from "./types";
import {
  removeTeacherModulesClassSnapshot,
  removeTeacherModulesModuleSnapshot
} from "./utils";
import { useTeacherModulesActions } from "./useTeacherModulesActions";
import { useTeacherModulesLoaders } from "./useTeacherModulesLoaders";

export function useTeacherModulesPage() {
  const initialLoadStartedRef = useRef(false);
  const classRequestIdRef = useRef(0);
  const moduleRequestIdRef = useRef(0);
  const resourceRequestIdRef = useRef(0);
  const lastSuccessfulModulesClassIdRef = useRef("");
  const lastSuccessfulResourcesModuleIdRef = useRef("");
  const classesRef = useRef<ClassItem[]>([]);
  const classIdRef = useRef("");
  const modulesRef = useRef<ModuleItem[]>([]);
  const moduleIdRef = useRef("");
  const resourcesRef = useRef<ModuleResourceItem[]>([]);

  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [classId, setClassId] = useState("");
  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [moduleId, setModuleId] = useState("");
  const [resources, setResources] = useState<ModuleResourceItem[]>([]);
  const [moduleTitle, setModuleTitle] = useState("");
  const [moduleDesc, setModuleDesc] = useState("");
  const [parentId, setParentId] = useState("");
  const [orderIndex, setOrderIndex] = useState(0);
  const [resourceType, setResourceType] = useState<ModuleResourceType>("file");
  const [resourceTitle, setResourceTitle] = useState("");
  const [resourceUrl, setResourceUrl] = useState("");
  const [resourceFile, setResourceFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pageReady, setPageReady] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [classesNotice, setClassesNotice] = useState<string | null>(null);
  const [modulesNotice, setModulesNotice] = useState<string | null>(null);
  const [resourcesNotice, setResourcesNotice] = useState<string | null>(null);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);

  const syncClasses = useCallback((nextClasses: ClassItem[]) => {
    classesRef.current = nextClasses;
    setClasses(nextClasses);
  }, []);

  const applyClassId = useCallback((nextClassId: string) => {
    classIdRef.current = nextClassId;
    setClassId(nextClassId);
  }, []);

  const syncModules = useCallback((nextModules: ModuleItem[]) => {
    modulesRef.current = nextModules;
    setModules(nextModules);
    setParentId((currentParentId) =>
      nextModules.some((item) => item.id === currentParentId) ? currentParentId : ""
    );
  }, []);

  const applyModuleId = useCallback((nextModuleId: string) => {
    moduleIdRef.current = nextModuleId;
    setModuleId(nextModuleId);
  }, []);

  const syncResources = useCallback((nextResources: ModuleResourceItem[]) => {
    resourcesRef.current = nextResources;
    setResources(nextResources);
  }, []);

  const resetResourceForm = useCallback(() => {
    setResourceType("file");
    setResourceTitle("");
    setResourceUrl("");
    setResourceFile(null);
  }, []);

  const clearResourcesSnapshot = useCallback(() => {
    syncResources([]);
    setResourcesNotice(null);
    lastSuccessfulResourcesModuleIdRef.current = "";
  }, [syncResources]);

  const resetModuleSelection = useCallback((nextModuleId = "") => {
    applyModuleId(nextModuleId);
    clearResourcesSnapshot();
    resetResourceForm();
  }, [applyModuleId, clearResourcesSnapshot, resetResourceForm]);

  const clearModulesSnapshot = useCallback(() => {
    syncModules([]);
    setModulesNotice(null);
    lastSuccessfulModulesClassIdRef.current = "";
    resetModuleSelection("");
  }, [resetModuleSelection, syncModules]);

  const resetClassSelection = useCallback((nextClassId = "") => {
    applyClassId(nextClassId);
    clearModulesSnapshot();
  }, [applyClassId, clearModulesSnapshot]);

  const removeMissingClass = useCallback((staleClassId: string) => {
    const nextState = removeTeacherModulesClassSnapshot(classesRef.current, staleClassId);
    syncClasses(nextState.classes);
    resetClassSelection(nextState.classId);
  }, [resetClassSelection, syncClasses]);

  const removeMissingModule = useCallback((staleModuleId: string) => {
    const nextState = removeTeacherModulesModuleSnapshot(modulesRef.current, staleModuleId);
    syncModules(nextState.modules);
    resetModuleSelection(nextState.moduleId);
  }, [resetModuleSelection, syncModules]);

  const handleAuthRequired = useCallback(() => {
    syncClasses([]);
    applyClassId("");
    clearModulesSnapshot();
    setClassesNotice(null);
    setMessage(null);
    setError(null);
    setPageReady(false);
    setPageError(null);
    setLastLoadedAt(null);
    setAuthRequired(true);
  }, [applyClassId, clearModulesSnapshot, syncClasses]);

  const { loadClasses, loadModules, loadResources } = useTeacherModulesLoaders({
    pageReady,
    classIdRef,
    moduleIdRef,
    modulesRef,
    resourcesRef,
    classRequestIdRef,
    moduleRequestIdRef,
    resourceRequestIdRef,
    lastSuccessfulModulesClassIdRef,
    lastSuccessfulResourcesModuleIdRef,
    syncClasses,
    syncModules,
    syncResources,
    resetModuleSelection,
    clearResourcesSnapshot,
    clearModulesSnapshot,
    resetClassSelection,
    handleAuthRequired,
    removeMissingClass,
    removeMissingModule,
    setAuthRequired,
    setLoading,
    setPageReady,
    setPageError,
    setClassesNotice,
    setModulesNotice,
    setResourcesNotice,
    setLastLoadedAt
  });

  useEffect(() => {
    if (initialLoadStartedRef.current) {
      return;
    }
    initialLoadStartedRef.current = true;
    void loadClasses();
  }, [loadClasses]);

  useEffect(() => {
    if (!pageReady || !classId) {
      return;
    }
    void loadModules(classId, {
      clearExisting: true
    });
  }, [classId, loadModules, pageReady]);

  useEffect(() => {
    if (!pageReady) {
      return;
    }
    if (!moduleId) {
      return;
    }
    void loadResources(moduleId, {
      clearExisting: true
    });
  }, [loadResources, moduleId, pageReady]);

  const actions = useTeacherModulesActions({
    moduleTitle,
    moduleDesc,
    parentId,
    orderIndex,
    resourceType,
    resourceTitle,
    resourceUrl,
    resourceFile,
    modules,
    moving,
    classIdRef,
    moduleIdRef,
    handleAuthRequired,
    resetResourceForm,
    loadModules,
    loadResources,
    removeMissingClass,
    removeMissingModule,
    applyClassId,
    applyModuleId,
    setModuleTitle,
    setModuleDesc,
    setParentId,
    setOrderIndex,
    setMessage,
    setError,
    setMoving
  });

  const reload = useCallback(() => {
    void loadClasses();
  }, [loadClasses]);

  return {
    classes,
    classId,
    modules,
    moduleId,
    resources,
    moduleTitle,
    moduleDesc,
    parentId,
    orderIndex,
    resourceType,
    resourceTitle,
    resourceUrl,
    message,
    error,
    moving,
    authRequired,
    loading,
    pageReady,
    pageError,
    classesNotice,
    modulesNotice,
    resourcesNotice,
    lastLoadedAt,
    setClassId: actions.handleClassChange,
    setModuleId: actions.handleModuleChange,
    setModuleTitle,
    setModuleDesc,
    setParentId,
    setOrderIndex,
    setResourceType,
    setResourceTitle,
    setResourceUrl,
    setResourceFile,
    handleCreateModule: actions.handleCreateModule,
    handleAddResource: actions.handleAddResource,
    handleDeleteResource: actions.handleDeleteResource,
    swapOrder: actions.swapOrder,
    reload
  };
}

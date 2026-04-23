"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isAuthError, requestJson } from "@/lib/client-request";
import type { KnowledgeGraphData, KnowledgeGraphNode } from "./types";

type KnowledgeMapResponse = {
  data: KnowledgeGraphData;
};

export function useKnowledgeMapPage() {
  const requestIdRef = useRef(0);
  const hasSnapshotRef = useRef(false);
  const [data, setData] = useState<KnowledgeGraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [subjectFilter, setSubjectFilter] = useState<string>("");
  const [gradeFilter, setGradeFilter] = useState<string>("");

  const loadData = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (subjectFilter) params.set("subject", subjectFilter);
      if (gradeFilter) params.set("grade", gradeFilter);
      const qs = params.toString();
      const url = `/api/student/knowledge-map${qs ? `?${qs}` : ""}`;

      const payload = await requestJson<KnowledgeMapResponse>(url);
      if (requestId !== requestIdRef.current) return;

      setData(payload.data);
      setAuthRequired(false);
      hasSnapshotRef.current = true;
    } catch (err) {
      if (requestId !== requestIdRef.current) return;

      if (isAuthError(err)) {
        setAuthRequired(true);
        setData(null);
        hasSnapshotRef.current = false;
      } else {
        if (!hasSnapshotRef.current) {
          setData(null);
        }
        setAuthRequired(false);
        setError(err instanceof Error ? err.message : "加载知识图谱失败");
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [subjectFilter, gradeFilter]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const selectedNode: KnowledgeGraphNode | null =
    selectedNodeId && data
      ? data.nodes.find((n) => n.id === selectedNodeId) ?? null
      : null;

  const selectedNodePrerequisites: KnowledgeGraphNode[] =
    selectedNodeId && data
      ? data.edges
          .filter((e) => e.target === selectedNodeId)
          .map((e) => data.nodes.find((n) => n.id === e.source))
          .filter((n): n is KnowledgeGraphNode => n !== undefined)
      : [];

  return {
    data,
    loading,
    error,
    authRequired,
    selectedNodeId,
    selectedNode,
    selectedNodePrerequisites,
    subjectFilter,
    gradeFilter,
    setSelectedNodeId,
    setSubjectFilter,
    setGradeFilter,
    reload: loadData,
  };
}

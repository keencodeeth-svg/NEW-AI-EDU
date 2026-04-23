"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { requestJson } from "@/lib/client-request";

type TeacherClass = {
  id: string;
  name: string;
  subject: string;
  grade: string;
};

type LiveSession = {
  id: string;
  classId: string;
  title: string;
  currentPrompt: string;
  status: "active" | "ended";
  updatedAt: string;
};

type LiveSnapshot = {
  session: LiveSession;
  totalAnswered: number;
  totalStudents: number;
  accuracy: number;
  fastestStudents: Array<{ studentId: string; studentName: string; total: number }>;
  slowestStudents: Array<{ studentId: string; studentName: string; total: number }>;
};

export function useClassroomLivePage() {
  const [classes, setClasses] = useState<TeacherClass[]>([]);
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [classId, setClassId] = useState("");
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [snapshot, setSnapshot] = useState<LiveSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    const [classesPayload, sessionsPayload] = await Promise.all([
      requestJson<{ data?: TeacherClass[] }>("/api/teacher/classes", {
        cache: "no-store"
      }),
      requestJson<{ data?: LiveSession[] }>("/api/teacher/classroom-live", {
        cache: "no-store"
      })
    ]);
    const nextClasses = classesPayload.data ?? [];
    const nextSessions = sessionsPayload.data ?? [];
    setClasses(nextClasses);
    setSessions(nextSessions);
    if (!classId && nextClasses[0]) {
      setClassId(nextClasses[0].id);
      setTitle(`${nextClasses[0].name} 课堂练习`);
    }
    if (!selectedSessionId && nextSessions[0]) {
      setSelectedSessionId(nextSessions[0].id);
    }
  }, [classId, selectedSessionId]);

  const loadSnapshot = useCallback(async (sessionId: string) => {
    const payload = await requestJson<{ data?: LiveSnapshot }>(`/api/teacher/classroom-live/${sessionId}`, {
      cache: "no-store"
    });
    setSnapshot(payload.data ?? null);
  }, []);

  useEffect(() => {
    void loadSessions().catch(() => {
      setError("课堂实时看板加载失败");
    });
  }, [loadSessions]);

  useEffect(() => {
    if (!selectedSessionId) {
      return;
    }
    void loadSnapshot(selectedSessionId).catch(() => {
      setError("实时数据读取失败");
    });
    const timer = window.setInterval(() => {
      void loadSnapshot(selectedSessionId).catch(() => {
        setError("实时数据读取失败");
      });
    }, 10000);
    return () => window.clearInterval(timer);
  }, [loadSnapshot, selectedSessionId]);

  const selectedSession = useMemo(
    () => sessions.find((item) => item.id === selectedSessionId) ?? null,
    [selectedSessionId, sessions]
  );

  async function createSession() {
    setLoading(true);
    setError(null);
    try {
      const payload = await requestJson<{ data?: LiveSession }>("/api/teacher/classroom-live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId, title })
      });
      const session = payload.data;
      if (session) {
        setSessions((prev) => [session, ...prev]);
        setSelectedSessionId(session.id);
        await loadSnapshot(session.id);
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "发起课堂练习失败");
    } finally {
      setLoading(false);
    }
  }

  async function pushNextPrompt() {
    if (!selectedSessionId || !selectedSession) {
      return;
    }
    setLoading(true);
    try {
      const payload = await requestJson<{ data?: LiveSession }>(`/api/teacher/classroom-live/${selectedSessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPrompt: "老师已切换到下一题，请同学们继续作答。"
        })
      });
      const updated = payload.data;
      if (updated) {
        setSessions((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
        await loadSnapshot(updated.id);
      }
    } finally {
      setLoading(false);
    }
  }

  return {
    classes,
    sessions,
    classId,
    setClassId,
    title,
    setTitle,
    selectedSessionId,
    setSelectedSessionId,
    selectedSession,
    snapshot,
    loading,
    error,
    createSession,
    pushNextPrompt
  };
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { requestJson } from "@/lib/client-request";

type TeacherClass = {
  id: string;
  name: string;
  subject: string;
  grade: string;
};

type LessonPlanResult = {
  commonMistakes: string[];
  interactionIdeas: string[];
  tieredAssignments: {
    easy: string[];
    medium: string[];
    hard: string[];
  };
  reflectionReport: string;
  classMasteryStats?: string[];
};

export function useLessonPlannerPage() {
  const [classes, setClasses] = useState<TeacherClass[]>([]);
  const [classId, setClassId] = useState("");
  const [subject, setSubject] = useState("math");
  const [grade, setGrade] = useState("4");
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LessonPlanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void requestJson<{ data?: TeacherClass[] }>("/api/teacher/classes")
      .then((payload) => {
        const nextClasses = payload.data ?? [];
        setClasses(nextClasses);
        if (nextClasses[0]) {
          setClassId(nextClasses[0].id);
          setSubject(nextClasses[0].subject);
          setGrade(nextClasses[0].grade);
        }
      })
      .catch(() => {
        // Keep empty classes state if loading teacher classes fails.
      });
  }, []);

  const selectedClass = useMemo(
    () => classes.find((item) => item.id === classId) ?? null,
    [classId, classes]
  );

  useEffect(() => {
    if (!selectedClass) {
      return;
    }
    setSubject(selectedClass.subject);
    setGrade(selectedClass.grade);
  }, [selectedClass]);

  async function generatePlan() {
    setLoading(true);
    setError(null);
    try {
      const payload = await requestJson<{ data?: LessonPlanResult }>("/api/teacher/lesson-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId: classId || undefined,
          subject,
          grade,
          topic
        })
      });
      setResult(payload.data ?? null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "备课方案生成失败");
    } finally {
      setLoading(false);
    }
  }

  return {
    classes,
    classId,
    setClassId,
    subject,
    setSubject,
    grade,
    setGrade,
    topic,
    setTopic,
    selectedClass,
    loading,
    result,
    error,
    generatePlan
  };
}

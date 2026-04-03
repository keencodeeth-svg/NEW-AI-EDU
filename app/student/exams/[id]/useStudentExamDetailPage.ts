import { useCallback, useEffect, useMemo, useRef, useState, type SetStateAction } from "react";
import { useMathViewSettings } from "@/lib/math-view-settings";
import type { ExamDetail, LocalDraft, ReviewPack, ReviewPackSummary, SubmitResult } from "./types";
import {
  getStudentExamStageCopy,
  LOCAL_DRAFT_PREFIX
} from "./utils";
import { useStudentExamDetailActions } from "./useStudentExamDetailActions";

export function useStudentExamDetailPage(examId: string) {
  const [data, setData] = useState<ExamDetail | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [clientStartedAt, setClientStartedAt] = useState<string | null>(null);
  const [pendingLocalSync, setPendingLocalSync] = useState(false);
  const [reviewPack, setReviewPack] = useState<ReviewPack | null>(null);
  const [reviewPackLoading, setReviewPackLoading] = useState(false);
  const [reviewPackError, setReviewPackError] = useState<string | null>(null);
  const [clock, setClock] = useState(() => Date.now());
  const [timeupTriggered, setTimeupTriggeredState] = useState(false);
  const mathView = useMathViewSettings("student-exam");
  const examEventRef = useRef({ blurCountDelta: 0, visibilityHiddenCountDelta: 0 });
  const timeupTriggeredRef = useRef(false);
  const hasReviewPackSnapshotRef = useRef(false);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resultSectionRef = useRef<HTMLDivElement | null>(null);

  const localDraftKey = `${LOCAL_DRAFT_PREFIX}${examId}`;

  const submitted = useMemo(
    () => (data?.assignment.status ?? "pending") === "submitted" || Boolean(data?.submission),
    [data]
  );

  const readLocalDraft = useCallback((): LocalDraft | null => {
    if (typeof window === "undefined") {
      return null;
    }

    const raw = window.localStorage.getItem(localDraftKey);
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as LocalDraft;
      if (!parsed || typeof parsed !== "object" || !parsed.answers || typeof parsed.answers !== "object") {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }, [localDraftKey]);

  const writeLocalDraft = useCallback(
    (draft: LocalDraft) => {
      if (typeof window === "undefined") {
        return;
      }
      window.localStorage.setItem(localDraftKey, JSON.stringify(draft));
    },
    [localDraftKey]
  );

  const clearLocalDraft = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.removeItem(localDraftKey);
  }, [localDraftKey]);

  const setTimeupTriggered = useCallback((next: SetStateAction<boolean>) => {
    setTimeupTriggeredState((current) => {
      const resolved = typeof next === "function" ? (next as (previous: boolean) => boolean)(current) : next;
      timeupTriggeredRef.current = resolved;
      return resolved;
    });
  }, []);

  const clearExamState = useCallback(() => {
    hasReviewPackSnapshotRef.current = false;
    examEventRef.current = { blurCountDelta: 0, visibilityHiddenCountDelta: 0 };
    clearLocalDraft();
    setData(null);
    setAnswers({});
    setDirty(false);
    setSavedAt(null);
    setResult(null);
    setLoadError(null);
    setActionError(null);
    setActionMessage(null);
    setSyncNotice(null);
    setClientStartedAt(null);
    setPendingLocalSync(false);
    setReviewPack(null);
    setReviewPackError(null);
    setTimeupTriggered(false);
  }, [clearLocalDraft, setTimeupTriggered]);

  const handleAuthRequired = useCallback(() => {
    clearExamState();
    setAuthRequired(true);
  }, [clearExamState]);

  const startedAt = data?.assignment.startedAt ?? clientStartedAt ?? null;

  const deadlineMs = useMemo(() => {
    if (!data || submitted) {
      return null;
    }

    const endDeadline = new Date(data.exam.endAt).getTime();
    if (data.exam.durationMinutes && startedAt) {
      const durationDeadline = new Date(startedAt).getTime() + data.exam.durationMinutes * 60 * 1000;
      return Math.min(endDeadline, durationDeadline);
    }
    return endDeadline;
  }, [data, startedAt, submitted]);

  const remainingSeconds = useMemo(() => {
    if (deadlineMs === null || submitted) {
      return null;
    }
    return Math.max(0, Math.ceil((deadlineMs - clock) / 1000));
  }, [clock, deadlineMs, submitted]);

  const lockedByTime = !submitted && remainingSeconds !== null && remainingSeconds <= 0;
  const lockedByStatus = !submitted && data?.exam.status === "closed";
  const lockedByAccess = !submitted && !data?.access?.canSubmit;
  const lockedByServer = lockedByStatus || lockedByAccess;
  const lockReason = data?.access?.lockReason ?? (lockedByStatus ? "考试已关闭" : null);

  const {
    flushExamEvents,
    queueExamEvent,
    loadReviewPack,
    load,
    saveDraft,
    submitExam,
    handleSubmit,
    handleAnswerChange,
    handleSaveDraft
  } = useStudentExamDetailActions({
    examId,
    data,
    answers,
    submitted,
    saving,
    submitting,
    lockedByTime,
    lockedByServer,
    online,
    clientStartedAt,
    readLocalDraft,
    writeLocalDraft,
    clearLocalDraft,
    clearExamState,
    handleAuthRequired,
    examEventRef,
    hasReviewPackSnapshotRef,
    flushTimerRef,
    setData,
    setAnswers,
    setDirty,
    setSaving,
    setSavedAt,
    setSubmitting,
    setResult,
    setAuthRequired,
    setPageLoading,
    setLoadError,
    setActionError,
    setActionMessage,
    setSyncNotice,
    setClientStartedAt,
    setPendingLocalSync,
    setReviewPack,
    setReviewPackLoading,
    setReviewPackError,
    setTimeupTriggered
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const updateNetwork = () => setOnline(window.navigator.onLine);
    updateNetwork();
    window.addEventListener("online", updateNetwork);
    window.addEventListener("offline", updateNetwork);
    return () => {
      window.removeEventListener("online", updateNetwork);
      window.removeEventListener("offline", updateNetwork);
    };
  }, []);

  useEffect(() => {
    if (deadlineMs === null || submitted) {
      return;
    }
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [deadlineMs, submitted]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (submitted || (!dirty && !pendingLocalSync)) {
        return;
      }
      void flushExamEvents();
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty, flushExamEvents, pendingLocalSync, submitted]);

  useEffect(() => {
    if (!data || submitted || data.exam.antiCheatLevel !== "basic") {
      return;
    }

    const onBlur = () => queueExamEvent("blur");
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        queueExamEvent("hidden");
      }
    };

    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [data, queueExamEvent, submitted]);

  useEffect(() => {
    return () => {
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      void flushExamEvents();
    };
  }, [flushExamEvents]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!dirty || submitted || lockedByTime || lockedByServer) {
      return;
    }
    const timer = setTimeout(() => {
      void saveDraft("auto");
    }, 1200);
    return () => clearTimeout(timer);
  }, [dirty, lockedByServer, lockedByTime, saveDraft, submitted]);

  useEffect(() => {
    if (!online || !pendingLocalSync || submitted || saving || lockedByTime || lockedByServer) {
      return;
    }
    void saveDraft("sync");
  }, [lockedByServer, lockedByTime, online, pendingLocalSync, saveDraft, saving, submitted]);

  useEffect(() => {
    if (submitted || submitting || lockedByTime === false) {
      return;
    }
    if (!startedAt || (data?.access && !data.access.canSubmit) || timeupTriggeredRef.current || timeupTriggered) {
      return;
    }
    timeupTriggeredRef.current = true;
    void submitExam("timeout");
  }, [data?.access, lockedByTime, startedAt, submitExam, submitted, submitting, timeupTriggered]);

  useEffect(() => {
    if (result) {
      resultSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [result]);

  const totalScore = data?.questions.reduce((sum, item) => sum + (item.score ?? 1), 0) ?? 0;
  const finalScore = result?.score ?? data?.submission?.score ?? data?.assignment.score ?? 0;
  const finalTotal = result?.total ?? data?.submission?.total ?? data?.assignment.total ?? totalScore;
  const answeredQuestionIds = data?.questions.filter((item) => Boolean(answers[item.id]?.trim())).map((item) => item.id) ?? [];
  const answerCount = answeredQuestionIds.length;
  const unansweredQuestionIds = data?.questions.filter((item) => !answers[item.id]?.trim()).map((item) => item.id) ?? [];
  const unansweredCount = unansweredQuestionIds.length;
  const firstUnansweredQuestionId = unansweredQuestionIds[0] ?? null;
  const effectiveWrongCount = result?.wrongCount ?? data?.reviewPackSummary?.wrongCount ?? 0;
  const stageLabel = submitted
    ? "已提交"
    : data?.access.stage === "upcoming"
      ? "待开始"
      : data?.access.stage === "open"
        ? "考试进行中"
        : "不可作答";
  const reviewPackSummary: ReviewPackSummary | null = result?.reviewPackSummary ?? data?.reviewPackSummary ?? null;
  const feedbackTargetId = reviewPack || reviewPackSummary ? "exam-review-pack" : result ? "exam-result" : null;
  const hasReviewPackSection =
    submitted || Boolean(reviewPack) || Boolean(reviewPackSummary) || Boolean(reviewPackError);
  const stageCopy = getStudentExamStageCopy({
    data,
    submitted,
    effectiveWrongCount,
    remainingSeconds,
    unansweredCount,
    startedAt,
    lockedByServer,
    lockReason
  });

  return {
    data,
    answers,
    result,
    authRequired,
    pageLoading,
    loadError,
    reviewPack,
    reviewPackLoading,
    reviewPackError,
    reviewPackSummary,
    mathView,
    submitted,
    online,
    answerCount,
    unansweredCount,
    totalScore,
    remainingSeconds,
    startedAt,
    saving,
    savedAt,
    syncNotice,
    actionMessage,
    actionError,
    lockReason,
    finalScore,
    finalTotal,
    submitting,
    lockedByTime,
    lockedByServer,
    stageLabel,
    stageCopy,
    firstUnansweredQuestionId,
    feedbackTargetId,
    hasReviewPackSection,
    resultSectionRef,
    load,
    loadReviewPack,
    handleSaveDraft,
    handleSubmit,
    handleAnswerChange: (questionId: string, value: string) => handleAnswerChange(questionId, value, startedAt)
  };
}

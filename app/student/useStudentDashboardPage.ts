import { useCallback, useEffect, useMemo, useRef, useState, type SetStateAction } from 'react';
import { trackEvent } from '@/lib/analytics-client';
import type { ScheduleResponse } from '@/lib/class-schedules';
import type {
  EntryCategory,
  EntryViewMode,
  JoinMessage,
  JoinRequest,
  MotivationPayload,
  PlanItem,
  StudentRadarSnapshot,
  TodayTaskPayload,
} from './types';
import { useStudentDashboardActions } from './useStudentDashboardActions';
import { useStudentDashboardLoaders } from './useStudentDashboardLoaders';
import {
  STUDENT_DASHBOARD_GUIDE_KEY,
  buildStudentDashboardTopTodayTasks,
  buildStudentDashboardVisiblePriorityTasks,
  countStudentDashboardPendingJoinRequests,
  getStudentDashboardCategoryCounts,
  getStudentDashboardEntriesByCategory,
  getStudentDashboardHiddenTodayTaskCount,
  getStudentDashboardRecommendedTask,
  getStudentDashboardTotalPlanCount,
  getStudentDashboardVisibleEntries,
  getStudentDashboardWeakPlanCount,
  hasStudentDashboardData,
} from './utils';

type ScheduleData = NonNullable<ScheduleResponse['data']>;

function applyStateAction<T>(action: SetStateAction<T>, current: T) {
  return typeof action === 'function' ? (action as (previous: T) => T)(current) : action;
}

export function useStudentDashboardPage() {
  const trackedTaskExposureRef = useRef<string | null>(null);
  const hasDashboardSnapshotRef = useRef(false);
  const dashboardRequestIdRef = useRef(0);
  const joinRequestsRequestIdRef = useRef(0);
  const todayTasksRequestIdRef = useRef(0);
  const radarRequestIdRef = useRef(0);
  const scheduleRequestIdRef = useRef(0);
  const joinClassRequestIdRef = useRef(0);
  const refreshPlanRequestIdRef = useRef(0);
  const [plan, setPlan] = useState<PlanItem[]>([]);
  const [motivation, setMotivation] = useState<MotivationPayload | null>(null);
  const [todayTasks, setTodayTasks] = useState<TodayTaskPayload | null>(null);
  const [radarSnapshot, setRadarSnapshot] = useState<StudentRadarSnapshot | null>(null);
  const [todayTaskError, setTodayTaskError] = useState<string | null>(null);
  const [radarError, setRadarError] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<ScheduleData | null>(null);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [scheduleRefreshing, setScheduleRefreshing] = useState(false);
  const [scheduleLastLoadedAt, setScheduleLastLoadedAt] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [joinMessage, setJoinMessage] = useState<JoinMessage | null>(null);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dashboardNotice, setDashboardNotice] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);
  const [activeCategory, setActiveCategoryState] = useState<EntryCategory>('priority');
  const [showAllEntries, setShowAllEntries] = useState(false);
  const [entryViewMode, setEntryViewMode] = useState<EntryViewMode>('compact');
  const [showDashboardGuide, setShowDashboardGuide] = useState(() => {
    if (typeof window === 'undefined') {
      return true;
    }
    try {
      return window.localStorage.getItem(STUDENT_DASHBOARD_GUIDE_KEY) !== 'hidden';
    } catch {
      return true;
    }
  });

  const clearDashboardState = useCallback(() => {
    hasDashboardSnapshotRef.current = false;
    trackedTaskExposureRef.current = null;
    setPlan([]);
    setMotivation(null);
    setTodayTasks(null);
    setRadarSnapshot(null);
    setTodayTaskError(null);
    setRadarError(null);
    setSchedule(null);
    setScheduleError(null);
    setScheduleLastLoadedAt(null);
    setJoinMessage(null);
    setJoinRequests([]);
    setDashboardNotice(null);
    setPageError(null);
    setLastLoadedAt(null);
  }, []);

  const invalidateStudentDashboardRequests = useCallback(() => {
    dashboardRequestIdRef.current += 1;
    joinRequestsRequestIdRef.current += 1;
    todayTasksRequestIdRef.current += 1;
    radarRequestIdRef.current += 1;
    scheduleRequestIdRef.current += 1;
    joinClassRequestIdRef.current += 1;
    refreshPlanRequestIdRef.current += 1;
  }, []);

  const handleAuthRequired = useCallback(() => {
    invalidateStudentDashboardRequests();
    clearDashboardState();
    setLoading(false);
    setRefreshing(false);
    setScheduleLoading(false);
    setScheduleRefreshing(false);
    setAuthRequired(true);
  }, [clearDashboardState, invalidateStudentDashboardRequests]);

  const { loadJoinRequests, loadTodayTasks, loadRadarSnapshot, loadSchedule, loadDashboard } =
    useStudentDashboardLoaders({
      dashboardRequestIdRef,
      joinRequestsRequestIdRef,
      todayTasksRequestIdRef,
      radarRequestIdRef,
      scheduleRequestIdRef,
      hasDashboardSnapshotRef,
      clearDashboardState,
      handleAuthRequired,
      setPlan,
      setMotivation,
      setTodayTasks,
      setRadarSnapshot,
      setTodayTaskError,
      setRadarError,
      setSchedule,
      setScheduleError,
      setScheduleLoading,
      setScheduleRefreshing,
      setScheduleLastLoadedAt,
      setJoinRequests,
      setLoading,
      setRefreshing,
      setDashboardNotice,
      setPageError,
      setAuthRequired,
      setLastLoadedAt,
    });

  const refreshSchedule = useCallback(async () => {
    await loadSchedule('refresh');
  }, [loadSchedule]);

  const setActiveCategory = useCallback((next: SetStateAction<EntryCategory>) => {
    setActiveCategoryState((current) => {
      const resolved = applyStateAction(next, current);
      if (resolved !== current) {
        queueMicrotask(() => {
          setShowAllEntries(false);
        });
      }
      return resolved;
    });
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const pendingJoinCount = useMemo(
    () => countStudentDashboardPendingJoinRequests(joinRequests),
    [joinRequests],
  );

  const totalPlanCount = useMemo(() => getStudentDashboardTotalPlanCount(plan), [plan]);

  const weakPlanCount = useMemo(() => getStudentDashboardWeakPlanCount(plan), [plan]);

  const topTodayTasks = useMemo(() => buildStudentDashboardTopTodayTasks(todayTasks), [todayTasks]);

  const visiblePriorityTasks = useMemo(
    () => buildStudentDashboardVisiblePriorityTasks(todayTasks, topTodayTasks),
    [todayTasks, topTodayTasks],
  );

  const hiddenTodayTaskCount = useMemo(
    () => getStudentDashboardHiddenTodayTaskCount(todayTasks, visiblePriorityTasks.length),
    [todayTasks, visiblePriorityTasks.length],
  );

  useEffect(() => {
    if (!todayTasks?.generatedAt || topTodayTasks.length === 0) {
      return;
    }
    if (trackedTaskExposureRef.current === todayTasks.generatedAt) {
      return;
    }
    trackedTaskExposureRef.current = todayTasks.generatedAt;
    topTodayTasks.forEach((task, index) => {
      trackEvent({
        eventName: 'task_exposed',
        page: '/student',
        props: {
          taskId: task.id,
          source: task.source,
          rank: index + 1,
          priority: task.priority,
          impactScore: task.impactScore,
          urgencyScore: task.urgencyScore,
          effortMinutes: task.effortMinutes,
        },
      });
    });
  }, [todayTasks?.generatedAt, topTodayTasks]);

  const categoryCounts = useMemo(() => getStudentDashboardCategoryCounts(), []);

  const entriesByCategory = useMemo(
    () => getStudentDashboardEntriesByCategory(activeCategory),
    [activeCategory],
  );

  const visibleEntries = useMemo(
    () => getStudentDashboardVisibleEntries(entriesByCategory, activeCategory, showAllEntries),
    [activeCategory, entriesByCategory, showAllEntries],
  );

  const recommendedTask = useMemo(
    () => getStudentDashboardRecommendedTask(todayTasks, visiblePriorityTasks),
    [todayTasks, visiblePriorityTasks],
  );

  const hasDashboardData = useMemo(
    () =>
      hasStudentDashboardData({
        plan,
        motivation,
        todayTasks,
        schedule,
        joinRequests,
      }),
    [joinRequests, motivation, plan, schedule, todayTasks],
  );

  const actions = useStudentDashboardActions({
    joinClassRequestIdRef,
    refreshPlanRequestIdRef,
    joinCode,
    loadJoinRequests,
    loadTodayTasks,
    loadRadarSnapshot,
    handleAuthRequired,
    setPlan,
    setJoinCode,
    setJoinMessage,
    setRefreshing,
    setAuthRequired,
    setPageError,
    setLastLoadedAt,
  });

  const hideDashboardGuide = useCallback(() => {
    setShowDashboardGuide(false);
    try {
      window.localStorage.setItem(STUDENT_DASHBOARD_GUIDE_KEY, 'hidden');
    } catch {
      // ignore localStorage errors
    }
  }, []);

  const showDashboardGuideAgain = useCallback(() => {
    setShowDashboardGuide(true);
    try {
      window.localStorage.removeItem(STUDENT_DASHBOARD_GUIDE_KEY);
    } catch {
      // ignore localStorage errors
    }
  }, []);

  return {
    plan,
    motivation,
    todayTasks,
    radarSnapshot,
    todayTaskError,
    radarError,
    schedule,
    scheduleError,
    scheduleLoading,
    scheduleRefreshing,
    scheduleLastLoadedAt,
    joinCode,
    setJoinCode,
    joinMessage,
    joinRequests,
    loading,
    refreshing,
    dashboardNotice,
    pageError,
    authRequired,
    lastLoadedAt,
    activeCategory,
    setActiveCategory,
    showAllEntries,
    setShowAllEntries,
    entryViewMode,
    setEntryViewMode,
    showDashboardGuide,
    pendingJoinCount,
    totalPlanCount,
    weakPlanCount,
    visiblePriorityTasks,
    hiddenTodayTaskCount,
    categoryCounts,
    entriesByCategory,
    visibleEntries,
    recommendedTask,
    hasDashboardData,
    loadDashboard,
    refreshSchedule,
    handleTaskEvent: actions.handleTaskEvent,
    handleJoinClass: actions.handleJoinClass,
    refreshPlan: actions.refreshPlan,
    hideDashboardGuide,
    showDashboardGuideAgain,
  };
}

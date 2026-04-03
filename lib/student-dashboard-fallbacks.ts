import { buildWeekDays, type ScheduleApiPayload } from './class-schedules';

export function buildEmptyStudentMotivationPayload() {
  return {
    streak: 0,
    badges: [],
    weekly: {
      accuracy: 0,
    },
  };
}

export function buildEmptyTodayTaskPayload() {
  return {
    generatedAt: new Date().toISOString(),
    recentStudyVariantActivity: null,
    summary: {
      total: 0,
      mustDo: 0,
      continueLearning: 0,
      growth: 0,
      overdue: 0,
      dueToday: 0,
      inProgress: 0,
      top3EstimatedMinutes: 0,
      bySource: {
        assignment: 0,
        exam: 0,
        wrongReview: 0,
        plan: 0,
        challenge: 0,
        lesson: 0,
      },
    },
    groups: {
      mustDo: [],
      continueLearning: [],
      growth: [],
    },
    topTasks: [],
    tasks: [],
  };
}

export function buildEmptySchedulePayload(
  role: ScheduleApiPayload['role'],
  classCount = 0,
): ScheduleApiPayload {
  return {
    generatedAt: new Date().toISOString(),
    role,
    summary: {
      classCount,
      scheduledClassCount: 0,
      classesWithoutScheduleCount: classCount,
      totalLessonsToday: 0,
      remainingLessonsToday: 0,
      totalLessonsThisWeek: 0,
    },
    nextLesson: null,
    todayLessons: [],
    weekly: buildWeekDays().map((day) => ({
      ...day,
      lessons: [],
    })),
  };
}

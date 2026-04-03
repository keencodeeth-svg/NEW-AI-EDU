import { getCurrentUser } from '@/lib/auth';
import { getBadges, getStreak, getWeeklyStats } from '@/lib/progress';
import { unauthorized } from '@/lib/api/http';
import { createLearningRoute } from '@/lib/api/domains';
import { buildEmptyStudentMotivationPayload } from '@/lib/student-dashboard-fallbacks';

export const GET = createLearningRoute({
  cache: 'private-short',
  handler: async () => {
    const user = await getCurrentUser();
    if (!user || user.role !== 'student') {
      unauthorized();
    }

    const warnings: string[] = [];
    const [streakResult, badgesResult, weeklyResult] = await Promise.allSettled([
      getStreak(user.id),
      getBadges(user.id),
      getWeeklyStats(user.id),
    ]);

    if (streakResult.status === 'rejected') {
      console.error('[api/student/motivation] load streak failed', streakResult.reason);
      warnings.push('streak_unavailable');
    }
    if (badgesResult.status === 'rejected') {
      console.error('[api/student/motivation] load badges failed', badgesResult.reason);
      warnings.push('badges_unavailable');
    }
    if (weeklyResult.status === 'rejected') {
      console.error('[api/student/motivation] load weekly stats failed', weeklyResult.reason);
      warnings.push('weekly_unavailable');
    }

    const fallback = buildEmptyStudentMotivationPayload();

    return {
      data: {
        streak: streakResult.status === 'fulfilled' ? streakResult.value : fallback.streak,
        badges: badgesResult.status === 'fulfilled' ? badgesResult.value : fallback.badges,
        weekly: weeklyResult.status === 'fulfilled' ? weeklyResult.value : fallback.weekly,
      },
      warnings,
    };
  },
});

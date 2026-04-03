import { refreshStudyPlan } from '@/lib/progress';
import {
  getMasteryRecordsByUser,
  getWeaknessRankMap,
  indexMasteryByKnowledgePoint,
} from '@/lib/mastery';
import { enrichPlanWithMastery } from '@/lib/plan-enrichment';
import { getStudentProfile } from '@/lib/profiles';
import { unauthorized } from '@/lib/api/http';
import { v } from '@/lib/api/validation';
import { createLearningRoute } from '@/lib/api/domains';

const refreshPlanBodySchema = v.object<{ subject?: string }>(
  {
    subject: v.optional(v.string({ minLength: 1 })),
  },
  { allowUnknown: false },
);

function normalizeSubjectInput(value?: string) {
  return value?.trim().toLowerCase();
}

export const POST = createLearningRoute({
  role: 'student',
  cache: 'private-realtime',
  handler: async ({ request, user }) => {
    if (!user || user.role !== 'student') {
      unauthorized();
    }

    const warnings: string[] = [];
    const rawBody = (await request.json().catch(() => ({}))) as unknown;
    const body = refreshPlanBodySchema(rawBody, 'body');
    const profile = await getStudentProfile(user.id).catch((error) => {
      console.error('[api/plan/refresh] load student profile failed', error);
      warnings.push('profile_unavailable');
      return null;
    });
    const subject = normalizeSubjectInput(body.subject);
    const subjects = (profile?.subjects?.length ? profile.subjects : ['math'])
      .map((item) => normalizeSubjectInput(item))
      .filter((item): item is string => Boolean(item));

    if (!subject || subject === 'all') {
      const plans = await Promise.allSettled(
        subjects.map((item) => refreshStudyPlan(user.id, item)),
      );
      const fulfilledPlans = plans
        .filter(
          (
            result,
          ): result is PromiseFulfilledResult<Awaited<ReturnType<typeof refreshStudyPlan>>> =>
            result.status === 'fulfilled',
        )
        .map((result) => result.value);

      if (fulfilledPlans.length !== plans.length) {
        const rejectedPlan = plans.find((result) => result.status === 'rejected');
        console.error(
          '[api/plan/refresh] refresh study plans failed',
          rejectedPlan?.status === 'rejected' ? rejectedPlan.reason : undefined,
        );
        warnings.push('plans_unavailable');
      }

      const masteryRecords = await getMasteryRecordsByUser(user.id).catch((error) => {
        console.error('[api/plan/refresh] load mastery records failed', error);
        warnings.push('mastery_unavailable');
        return [];
      });
      const masteryMap = indexMasteryByKnowledgePoint(masteryRecords);
      const enrichedPlans = fulfilledPlans.map((plan) =>
        enrichPlanWithMastery(plan, masteryMap, getWeaknessRankMap(masteryRecords, plan.subject)),
      );
      const items = enrichedPlans.flatMap((plan) =>
        plan.items.map((item) => ({ ...item, subject: plan.subject })),
      );
      return { data: { items, plans: enrichedPlans }, warnings };
    }

    const plan = await refreshStudyPlan(user.id, subject).catch((error) => {
      console.error('[api/plan/refresh] refresh subject plan failed', error);
      warnings.push('plan_unavailable');
      return null;
    });
    const masteryRecords = await getMasteryRecordsByUser(user.id, subject).catch((error) => {
      console.error('[api/plan/refresh] load subject mastery records failed', error);
      warnings.push('mastery_unavailable');
      return [];
    });
    const masteryMap = indexMasteryByKnowledgePoint(masteryRecords);
    return {
      data:
        plan === null
          ? {
              subject,
              items: [],
            }
          : enrichPlanWithMastery(plan, masteryMap, getWeaknessRankMap(masteryRecords, subject)),
      warnings,
    };
  },
});

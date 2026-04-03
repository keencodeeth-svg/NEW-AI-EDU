import { generateStudyPlan, generateStudyPlans, getStudyPlan, getStudyPlans } from '@/lib/progress';
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

const planQuerySchema = v.object<{ subject?: string }>(
  {
    subject: v.optional(v.string({ minLength: 1 })),
  },
  { allowUnknown: true },
);

function normalizeSubjectInput(value?: string) {
  return value?.trim().toLowerCase();
}

export const GET = createLearningRoute({
  role: 'student',
  query: planQuerySchema,
  cache: 'private-short',
  handler: async ({ query, user }) => {
    if (!user || user.role !== 'student') {
      unauthorized();
    }

    const warnings: string[] = [];
    const subject = normalizeSubjectInput(query.subject);
    const profile = await getStudentProfile(user.id).catch((error) => {
      console.error('[api/plan] load student profile failed', error);
      warnings.push('profile_unavailable');
      return null;
    });
    const subjects = (profile?.subjects?.length ? profile.subjects : ['math'])
      .map((item) => normalizeSubjectInput(item))
      .filter((item): item is string => Boolean(item));

    if (!subject || subject === 'all') {
      const plans = await getStudyPlans(user.id, subjects)
        .then(async (existing) =>
          existing.length ? existing : await generateStudyPlans(user.id, subjects),
        )
        .catch((error) => {
          console.error('[api/plan] load study plans failed', error);
          warnings.push('plans_unavailable');
          return [];
        });
      const masteryRecords = await getMasteryRecordsByUser(user.id).catch((error) => {
        console.error('[api/plan] load mastery records failed', error);
        warnings.push('mastery_unavailable');
        return [];
      });
      const masteryMap = indexMasteryByKnowledgePoint(masteryRecords);
      const enrichedPlans = plans.map((plan) =>
        enrichPlanWithMastery(plan, masteryMap, getWeaknessRankMap(masteryRecords, plan.subject)),
      );
      const items = enrichedPlans.flatMap((plan) =>
        plan.items.map((item) => ({ ...item, subject: plan.subject })),
      );
      return { data: { items, plans: enrichedPlans }, warnings };
    }

    const plan = await getStudyPlan(user.id, subject)
      .then(async (existing) => existing ?? (await generateStudyPlan(user.id, subject)))
      .catch((error) => {
        console.error('[api/plan] load subject plan failed', error);
        warnings.push('plan_unavailable');
        return null;
      });
    const masteryRecords = await getMasteryRecordsByUser(user.id, subject).catch((error) => {
      console.error('[api/plan] load subject mastery records failed', error);
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

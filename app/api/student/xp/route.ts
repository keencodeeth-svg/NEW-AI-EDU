import { createLearningRoute } from "@/lib/api/domains";
import { getXpSummary, getXpHistory, computeLevel } from "@/lib/gamification";

export const GET = createLearningRoute({
  role: "student",
  cache: "private-short",
  handler: async ({ user }) => {
    const summary = await getXpSummary(user!.id);
    const levelInfo = computeLevel(summary.totalXp);
    const recentXp = await getXpHistory(user!.id, 10);
    return { data: { ...summary, ...levelInfo, recentXp } };
  },
});

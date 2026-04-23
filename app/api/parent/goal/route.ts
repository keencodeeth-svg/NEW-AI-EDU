import { createLearningRoute } from "@/lib/api/domains";
import { parseJson, v } from "@/lib/api/validation";
import { badRequest, unauthorized } from "@/lib/api/http";
import { getMasteryRecord } from "@/lib/mastery";
import {
  buildParentActionSuggestions,
  getActiveParentStudentGoal,
  upsertParentStudentGoal
} from "@/lib/parent-engagement";

export const dynamic = "force-dynamic";

const bodySchema = v.object<{
  title: string;
  targetDate: string;
  knowledgePointId?: string;
}>(
  {
    title: v.string({ minLength: 1, maxLength: 80 }),
    targetDate: v.string({ minLength: 1 }),
    knowledgePointId: v.optional(v.string({ minLength: 1 }))
  },
  { allowUnknown: false }
);

export const GET = createLearningRoute({
  role: "parent",
  cache: "private-short",
  handler: async ({ user }) => {
    if (!user || user.role !== "parent") {
      unauthorized();
    }
    if (!user.studentId) {
      badRequest("parent student binding missing");
    }
    const [goal, suggestions] = await Promise.all([
      getActiveParentStudentGoal(user.id, user.studentId),
      buildParentActionSuggestions(user.studentId)
    ]);
    const mastery =
      goal?.knowledgePointId
        ? await getMasteryRecord(user.studentId, goal.knowledgePointId).catch(() => null)
        : null;
    return {
      data: {
        goal,
        suggestions,
        mastery
      }
    };
  }
});

export const POST = createLearningRoute({
  role: "parent",
  cache: "private-realtime",
  handler: async ({ request, user }) => {
    if (!user || user.role !== "parent") {
      unauthorized();
    }
    if (!user.studentId) {
      badRequest("parent student binding missing");
    }
    const body = await parseJson(request, bodySchema);
    const goal = await upsertParentStudentGoal({
      parentId: user.id,
      studentId: user.studentId,
      title: body.title,
      targetDate: body.targetDate,
      knowledgePointId: body.knowledgePointId
    });
    return { data: goal };
  }
});

import { createLearningRoute } from "@/lib/api/domains";
import { parseJson, v } from "@/lib/api/validation";
import { badRequest, unauthorized } from "@/lib/api/http";
import { getClassesByTeacher } from "@/lib/classes";
import {
  buildMoodTrendSummary,
  getClassMoodTrend,
  getStudentMoodCheckins,
  saveStudentMoodCheckin,
  type StudentMoodType
} from "@/lib/learning-state";

export const dynamic = "force-dynamic";

const bodySchema = v.object<{
  mood: StudentMoodType;
  context?: string;
}>(
  {
    mood: v.enum(["good", "neutral", "tired"] as const),
    context: v.optional(v.string({ allowEmpty: true, trim: false, maxLength: 120 }))
  },
  { allowUnknown: false }
);

export const GET = createLearningRoute({
  role: ["student", "parent", "teacher"],
  cache: "private-short",
  handler: async ({ request, user }) => {
    if (!user) {
      unauthorized();
    }

    if (user.role === "student") {
      const checkins = await getStudentMoodCheckins(user.id);
      return {
        data: {
          scope: "student",
          checkins,
          summary: buildMoodTrendSummary(checkins)
        }
      };
    }

    if (user.role === "parent") {
      if (!user.studentId) {
        badRequest("parent student binding missing");
      }
      const checkins = await getStudentMoodCheckins(user.studentId);
      return {
        data: {
          scope: "parent",
          studentId: user.studentId,
          checkins,
          summary: buildMoodTrendSummary(checkins)
        }
      };
    }

    const classId = new URL(request.url).searchParams.get("classId")?.trim();
    if (!classId) {
      badRequest("classId required");
    }
    const classes = await getClassesByTeacher(user.id);
    if (!classes.some((item) => item.id === classId)) {
      unauthorized();
    }
    const trend = await getClassMoodTrend(classId);
    return {
      data: {
        scope: "teacher",
        classId,
        ...trend
      }
    };
  }
});

export const POST = createLearningRoute({
  role: "student",
  cache: "private-realtime",
  handler: async ({ request, user }) => {
    if (!user || user.role !== "student") {
      unauthorized();
    }
    const body = await parseJson(request, bodySchema);
    const record = await saveStudentMoodCheckin({
      userId: user.id,
      mood: body.mood,
      context: body.context
    });
    return { data: record };
  }
});

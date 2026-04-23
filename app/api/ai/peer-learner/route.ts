import { createLearningRoute } from "@/lib/api/domains";
import { parseJson, v } from "@/lib/api/validation";
import { unauthorized } from "@/lib/api/http";
import { addXp } from "@/lib/gamification";
import { generatePeerLearnerChallenge } from "@/lib/ai-peer-learner";

export const dynamic = "force-dynamic";

const bodySchema = v.object<{
  question: string;
  correctAnswer: string;
  commonMistake?: string;
  studentExplanation?: string;
  sourceId?: string;
}>(
  {
    question: v.string({ minLength: 1, maxLength: 1000 }),
    correctAnswer: v.string({ minLength: 1, maxLength: 200 }),
    commonMistake: v.optional(v.string({ allowEmpty: true, trim: false, maxLength: 300 })),
    studentExplanation: v.optional(v.string({ allowEmpty: true, trim: false, maxLength: 600 })),
    sourceId: v.optional(v.string({ minLength: 1 }))
  },
  { allowUnknown: false }
);

export const POST = createLearningRoute({
  role: "student",
  cache: "private-realtime",
  handler: async ({ request, user }) => {
    if (!user || user.role !== "student") {
      unauthorized();
    }
    const body = await parseJson(request, bodySchema);
    const data = await generatePeerLearnerChallenge({
      question: body.question,
      correctAnswer: body.correctAnswer,
      commonMistake: body.commonMistake,
      studentExplanation: body.studentExplanation
    });

    if (body.studentExplanation?.trim()) {
      const xp = await addXp(
        user.id,
        20,
        "peer_teaching",
        body.sourceId,
        "完成一次 AI 学伴纠错讲解"
      );
      return {
        data: {
          ...data,
          awardedXp: 20,
          totalXp: xp.totalXp
        }
      };
    }

    return { data };
  }
});

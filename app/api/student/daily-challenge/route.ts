import { createLearningRoute } from "@/lib/api/domains";
import { parseJson, v } from "@/lib/api/validation";
import { badRequest } from "@/lib/api/http";
import {
  getDailyChallenge,
  generateDailyChallenge,
  submitDailyChallenge,
} from "@/lib/daily-challenge";

export const GET = createLearningRoute({
  role: "student",
  cache: "private-short",
  handler: async ({ user }) => {
    let challenge = await getDailyChallenge(user!.id);
    if (!challenge) {
      challenge = await generateDailyChallenge(user!.id);
    }
    return { data: challenge };
  },
});

const passthrough = (value: unknown) => value;

const submitSchema = v.object<{ challengeId: string; answers?: unknown }>(
  {
    challengeId: v.string(),
    answers: v.optional(passthrough),
  },
  { allowUnknown: false }
);

function normalizeAnswers(input: unknown): Record<string, string> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    badRequest("answers must be an object");
  }
  const answers: Record<string, string> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (typeof value !== "string") {
      badRequest(`answers.${key} must be a string`);
    }
    answers[key] = value;
  }
  return answers;
}

export const POST = createLearningRoute({
  role: "student",
  handler: async ({ request, user }) => {
    const body = await parseJson(request, submitSchema);
    const answers = normalizeAnswers(body.answers);
    const result = await submitDailyChallenge(user!.id, body.challengeId, answers);
    return { data: result };
  },
});

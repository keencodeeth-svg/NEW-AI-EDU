import { createLearningRoute } from "@/lib/api/domains";
import { parseJson, v } from "@/lib/api/validation";
import { unauthorized } from "@/lib/api/http";
import { completeOnboarding, getOnboardingProgress } from "@/lib/onboarding";

export const dynamic = "force-dynamic";

const bodySchema = v.object<{
  completedSteps?: string[];
}>(
  {
    completedSteps: v.optional(v.array(v.string({ minLength: 1, maxLength: 48 }), { minLength: 1, maxLength: 12 }))
  },
  { allowUnknown: false }
);

export const GET = createLearningRoute({
  role: ["student", "teacher", "parent", "admin", "school_admin"],
  cache: "private-short",
  handler: async ({ user }) => {
    if (!user) {
      unauthorized();
    }
    const progress = await getOnboardingProgress(user.id);
    return { data: progress };
  }
});

export const POST = createLearningRoute({
  role: ["student", "teacher", "parent", "admin", "school_admin"],
  cache: "private-realtime",
  handler: async ({ request, user }) => {
    if (!user) {
      unauthorized();
    }
    const body = await parseJson(request, bodySchema);
    const progress = await completeOnboarding(user.id, body.completedSteps ?? ["tour"]);
    return { data: progress };
  }
});

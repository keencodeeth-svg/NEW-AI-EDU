import { createLearningRoute } from "@/lib/api/domains";
import { parseJson, v } from "@/lib/api/validation";
import { badRequest, unauthorized } from "@/lib/api/http";
import {
  getLatestParentEncouragement,
  markParentEncouragementRead,
  sendParentEncouragement
} from "@/lib/parent-engagement";

export const dynamic = "force-dynamic";

const postBodySchema = v.object<{ message: string }>(
  {
    message: v.string({ minLength: 1, maxLength: 50 })
  },
  { allowUnknown: false }
);

const patchBodySchema = v.object<{ id: string }>(
  {
    id: v.string({ minLength: 1 })
  },
  { allowUnknown: false }
);

export const GET = createLearningRoute({
  role: ["student", "parent"],
  cache: "private-short",
  handler: async ({ request, user }) => {
    if (!user) {
      unauthorized();
    }
    const unread = new URL(request.url).searchParams.get("unread") === "true";

    if (user.role === "student") {
      const latest = await getLatestParentEncouragement(user.id, unread);
      return { data: latest };
    }

    if (!user.studentId) {
      badRequest("parent student binding missing");
    }
    const latest = await getLatestParentEncouragement(user.studentId, false);
    return { data: latest };
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
    const body = await parseJson(request, postBodySchema);
    const record = await sendParentEncouragement({
      parentId: user.id,
      studentId: user.studentId,
      message: body.message
    });
    return { data: record };
  }
});

export const PATCH = createLearningRoute({
  role: "student",
  cache: "private-realtime",
  handler: async ({ request, user }) => {
    if (!user || user.role !== "student") {
      unauthorized();
    }
    const body = await parseJson(request, patchBodySchema);
    const latest = await getLatestParentEncouragement(user.id, false);
    if (!latest || latest.id !== body.id) {
      badRequest("encouragement not found");
    }
    await markParentEncouragementRead(body.id);
    return { success: true };
  }
});

import { createLearningRoute } from "@/lib/api/domains";
import { parseJson, v } from "@/lib/api/validation";
import { notFound, unauthorized } from "@/lib/api/http";
import {
  getClassroomLiveSession,
  getClassroomLiveSnapshot,
  updateClassroomLivePrompt
} from "@/lib/classroom-live";

export const dynamic = "force-dynamic";

const paramsSchema = v.object<{ sessionId: string }>(
  {
    sessionId: v.string({ minLength: 1 })
  },
  { allowUnknown: true }
);

const bodySchema = v.object<{
  currentPrompt?: string;
  status?: "active" | "ended";
}>(
  {
    currentPrompt: v.optional(v.string({ minLength: 1, maxLength: 160 })),
    status: v.optional(v.enum(["active", "ended"] as const))
  },
  { allowUnknown: false }
);

export const GET = createLearningRoute({
  role: "teacher",
  params: paramsSchema,
  cache: "private-realtime",
  handler: async ({ params, user }) => {
    if (!user || user.role !== "teacher") {
      unauthorized();
    }
    const session = await getClassroomLiveSession(params.sessionId);
    if (!session || session.teacherId !== user.id) {
      notFound("session not found");
    }
    const snapshot = await getClassroomLiveSnapshot(params.sessionId);
    return { data: snapshot };
  }
});

export const PATCH = createLearningRoute({
  role: "teacher",
  params: paramsSchema,
  cache: "private-realtime",
  handler: async ({ request, params, user }) => {
    if (!user || user.role !== "teacher") {
      unauthorized();
    }
    const session = await getClassroomLiveSession(params.sessionId);
    if (!session || session.teacherId !== user.id) {
      notFound("session not found");
    }
    const body = await parseJson(request, bodySchema);
    const updated = await updateClassroomLivePrompt({
      sessionId: params.sessionId,
      currentPrompt: body.currentPrompt ?? session.currentPrompt,
      status: body.status
    });
    return { data: updated };
  }
});

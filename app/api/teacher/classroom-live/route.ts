import { createLearningRoute } from "@/lib/api/domains";
import { parseJson, v } from "@/lib/api/validation";
import { unauthorized } from "@/lib/api/http";
import { createClassroomLiveSession, getTeacherClassroomLiveSessions } from "@/lib/classroom-live";
import { getClassById } from "@/lib/classes";

export const dynamic = "force-dynamic";

const bodySchema = v.object<{
  classId: string;
  title?: string;
}>(
  {
    classId: v.string({ minLength: 1 }),
    title: v.optional(v.string({ allowEmpty: true, trim: false, maxLength: 80 }))
  },
  { allowUnknown: false }
);

export const GET = createLearningRoute({
  role: "teacher",
  cache: "private-realtime",
  handler: async ({ user }) => {
    if (!user || user.role !== "teacher") {
      unauthorized();
    }
    const data = await getTeacherClassroomLiveSessions(user.id);
    return { data };
  }
});

export const POST = createLearningRoute({
  role: "teacher",
  cache: "private-realtime",
  handler: async ({ request, user }) => {
    if (!user || user.role !== "teacher") {
      unauthorized();
    }
    const body = await parseJson(request, bodySchema);
    const klass = await getClassById(body.classId);
    if (!klass || klass.teacherId !== user.id) {
      unauthorized();
    }
    const session = await createClassroomLiveSession({
      classId: body.classId,
      teacherId: user.id,
      title: body.title?.trim() || `${klass.name} 课堂练习`
    });
    return { data: session };
  }
});

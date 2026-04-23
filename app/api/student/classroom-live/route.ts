import { createLearningRoute } from "@/lib/api/domains";
import { unauthorized } from "@/lib/api/http";
import { getStudentActiveClassroomLiveSessions } from "@/lib/classroom-live";

export const dynamic = "force-dynamic";

export const GET = createLearningRoute({
  role: "student",
  cache: "private-realtime",
  handler: async ({ user }) => {
    if (!user || user.role !== "student") {
      unauthorized();
    }
    const data = await getStudentActiveClassroomLiveSessions(user.id);
    return { data };
  }
});

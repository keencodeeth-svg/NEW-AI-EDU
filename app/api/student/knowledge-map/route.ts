import { createLearningRoute } from "@/lib/api/domains";
import { buildKnowledgeGraph } from "@/lib/knowledge-graph";

export const GET = createLearningRoute({
  role: "student",
  cache: "private-short",
  handler: async ({ user, request }) => {
    const url = new URL(request.url);
    const subject = url.searchParams.get("subject") || undefined;
    const grade = url.searchParams.get("grade") || undefined;
    const data = await buildKnowledgeGraph(user!.id, subject, grade);
    return { data };
  },
});

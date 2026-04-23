import { createLearningRoute } from "@/lib/api/domains";
import { parseJson, v } from "@/lib/api/validation";
import { unauthorized } from "@/lib/api/http";
import { getClassById, getClassStudentIds } from "@/lib/classes";
import { getKnowledgePoints } from "@/lib/content";
import { generateLessonPlan } from "@/lib/ai-lesson-planner";
import { getMasteryRecordsByUser } from "@/lib/mastery";

export const dynamic = "force-dynamic";

const bodySchema = v.object<{
  classId?: string;
  subject: string;
  grade: string;
  topic: string;
}>(
  {
    classId: v.optional(v.string({ minLength: 1 })),
    subject: v.string({ minLength: 1 }),
    grade: v.string({ minLength: 1 }),
    topic: v.string({ minLength: 1, maxLength: 80 })
  },
  { allowUnknown: false }
);

async function buildClassMasteryStats(classId: string, subject: string) {
  const studentIds = await getClassStudentIds(classId);
  if (!studentIds.length) {
    return [] as string[];
  }
  const [knowledgePoints, recordsByStudent] = await Promise.all([
    getKnowledgePoints(),
    Promise.all(studentIds.map((studentId) => getMasteryRecordsByUser(studentId, subject)))
  ]);
  const kpMap = new Map(
    knowledgePoints
      .filter((item) => item.subject === subject)
      .map((item) => [item.id, item.title])
  );
  const aggregate = new Map<string, { totalScore: number; count: number; below60: number }>();
  recordsByStudent.flat().forEach((record) => {
    const current = aggregate.get(record.knowledgePointId) ?? { totalScore: 0, count: 0, below60: 0 };
    current.totalScore += record.masteryScore;
    current.count += 1;
    if (record.masteryScore < 60) {
      current.below60 += 1;
    }
    aggregate.set(record.knowledgePointId, current);
  });
  return Array.from(aggregate.entries())
    .map(([knowledgePointId, stat]) => ({
      title: kpMap.get(knowledgePointId) ?? knowledgePointId,
      average: Math.round(stat.totalScore / Math.max(stat.count, 1)),
      below60: stat.below60
    }))
    .sort((left, right) => left.average - right.average)
    .slice(0, 5)
    .map((item) => `${item.title} 平均掌握 ${item.average}，低于 60 分学生 ${item.below60} 人`);
}

export const POST = createLearningRoute({
  role: "teacher",
  cache: "private-realtime",
  handler: async ({ request, user }) => {
    if (!user || user.role !== "teacher") {
      unauthorized();
    }
    const body = await parseJson(request, bodySchema);

    if (body.classId) {
      const klass = await getClassById(body.classId);
      if (!klass || klass.teacherId !== user.id) {
        unauthorized();
      }
    }

    const classMasteryStats = body.classId ? await buildClassMasteryStats(body.classId, body.subject) : [];
    const plan = await generateLessonPlan({
      subject: body.subject,
      grade: body.grade,
      topic: body.topic,
      classMasteryStats
    });
    return {
      data: {
        ...plan,
        classMasteryStats
      }
    };
  }
});

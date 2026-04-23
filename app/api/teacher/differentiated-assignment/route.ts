import { createLearningRoute } from "@/lib/api/domains";
import { parseJson, v } from "@/lib/api/validation";
import { badRequest, unauthorized } from "@/lib/api/http";
import { getClassById, getStudentsByClass } from "@/lib/classes";
import { createAssignment } from "@/lib/assignments";
import { createQuestion, getKnowledgePoints, getQuestions, normalizeQuestionType } from "@/lib/content";
import { getMasteryRecordsByUser } from "@/lib/mastery";
import { generateQuestionDraft } from "@/lib/ai";
import type { ClassStudentInfo } from "@/lib/classes";
import type { Subject } from "@/lib/types";

export const dynamic = "force-dynamic";

const bodySchema = v.object<{
  classId: string;
  title: string;
  description?: string;
  dueDate?: string;
  questionCount?: number;
  knowledgePointId?: string;
  mode?: "bank" | "ai";
  questionType?: string;
  moduleId?: string;
}>(
  {
    classId: v.string({ minLength: 1 }),
    title: v.string({ minLength: 1, maxLength: 80 }),
    description: v.optional(v.string({ allowEmpty: true, trim: false, maxLength: 200 })),
    dueDate: v.optional(v.string({ minLength: 1 })),
    questionCount: v.optional(v.number({ coerce: true, integer: true, min: 3, max: 12 })),
    knowledgePointId: v.optional(v.string({ minLength: 1 })),
    mode: v.optional(v.enum(["bank", "ai"] as const)),
    questionType: v.optional(v.string({ minLength: 1 })),
    moduleId: v.optional(v.string({ minLength: 1 }))
  },
  { allowUnknown: false }
);

function average(values: number[]) {
  if (!values.length) {
    return 50;
  }
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function sampleQuestionIds(questionIds: string[], count: number) {
  const pool = [...questionIds];
  const output: string[] = [];
  while (pool.length && output.length < count) {
    const index = Math.floor(Math.random() * pool.length);
    const [picked] = pool.splice(index, 1);
    if (picked) {
      output.push(picked);
    }
  }
  return output;
}

async function ensureTierQuestionIds(input: {
  tier: "A" | "B" | "C";
  subject: Subject;
  grade: string;
  knowledgePointId?: string;
  questionType?: string;
  count: number;
  mode: "bank" | "ai";
}) {
  const difficulty = input.tier === "A" ? "easy" : input.tier === "B" ? "medium" : "hard";
  const allQuestions = await getQuestions();
  const pool = allQuestions.filter(
    (item) =>
      item.subject === input.subject &&
      item.grade === input.grade &&
      (!input.knowledgePointId || item.knowledgePointId === input.knowledgePointId) &&
      (!input.questionType || normalizeQuestionType(item.questionType) === normalizeQuestionType(input.questionType)) &&
      item.difficulty === difficulty
  );

  if (pool.length < input.count && input.mode === "ai") {
    const knowledgePoints = await getKnowledgePoints();
    const kp =
      knowledgePoints.find((item) => item.id === input.knowledgePointId) ??
      knowledgePoints.find((item) => item.subject === input.subject && item.grade === input.grade);
    if (!kp) {
      badRequest("knowledge point not found");
    }

    const missing = input.count - pool.length;
    for (let index = 0; index < missing; index += 1) {
      const draft = await generateQuestionDraft({
        subject: input.subject,
        grade: input.grade,
        knowledgePointTitle: kp.title,
        chapter: kp.chapter,
        difficulty
      });
      if (!draft) {
        break;
      }
      const saved = await createQuestion({
        subject: input.subject,
        grade: input.grade,
        knowledgePointId: kp.id,
        stem: draft.stem,
        options: draft.options,
        answer: draft.answer,
        explanation: draft.explanation,
        difficulty,
        questionType: normalizeQuestionType(input.questionType ?? "choice"),
        tags: [`tier-${input.tier.toLowerCase()}`],
        abilities: []
      });
      if (saved) {
        pool.push(saved);
      }
    }
  }

  if (pool.length < input.count) {
    badRequest(`题库不足，无法为 ${input.tier} 档生成 ${input.count} 道题`);
  }
  return sampleQuestionIds(pool.map((item) => item.id), input.count);
}

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

    const students = await getStudentsByClass(klass.id);
    if (!students.length) {
      badRequest("class has no students");
    }

    const studentScores = await Promise.all(
      students.map(async (student: ClassStudentInfo) => {
        const records = await getMasteryRecordsByUser(student.id, klass.subject);
        const relevant = body.knowledgePointId
          ? records.filter((item) => item.knowledgePointId === body.knowledgePointId)
          : records;
        const score = average(relevant.map((item) => item.masteryScore));
        return {
          studentId: student.id,
          studentName: student.name,
          score
        };
      })
    );

    const tiers = {
      A: studentScores.filter((item) => item.score < 60),
      B: studentScores.filter((item) => item.score >= 60 && item.score <= 85),
      C: studentScores.filter((item) => item.score > 85)
    } as const;

    const dueDate = body.dueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const questionCount = body.questionCount ?? 5;
    const mode = body.mode ?? "bank";
    const result = {
      tiers: [] as Array<{
        tier: "A" | "B" | "C";
        label: string;
        assignmentId: string | null;
        students: Array<{ id: string; name: string; score: number }>;
        questionIds: string[];
      }>
    };

    for (const tier of ["A", "B", "C"] as const) {
      const members = tiers[tier];
      if (!members.length) {
        result.tiers.push({
          tier,
          label: tier === "A" ? "基础巩固" : tier === "B" ? "标准提升" : "迁移挑战",
          assignmentId: null,
          students: [],
          questionIds: []
        });
        continue;
      }

      const questionIds = await ensureTierQuestionIds({
        tier,
        subject: klass.subject,
        grade: klass.grade,
        knowledgePointId: body.knowledgePointId,
        questionType: body.questionType,
        count: questionCount,
        mode
      });

      const assignment = await createAssignment({
        classId: klass.id,
        moduleId: body.moduleId,
        title: `${body.title} · ${tier}档`,
        description:
          `${body.description?.trim() || "系统按学情分层生成。"}（${tier}档：${tier === "A" ? "基础巩固" : tier === "B" ? "标准提升" : "迁移挑战"}）`,
        dueDate,
        questionIds,
        submissionType: "quiz",
        targetStudentIds: members.map((item) => item.studentId)
      });

      result.tiers.push({
        tier,
        label: tier === "A" ? "基础巩固" : tier === "B" ? "标准提升" : "迁移挑战",
        assignmentId: assignment.id,
        students: members.map((item) => ({ id: item.studentId, name: item.studentName, score: item.score })),
        questionIds
      });
    }

    return { data: result };
  }
});

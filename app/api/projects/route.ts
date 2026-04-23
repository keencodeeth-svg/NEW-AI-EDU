import { createLearningRoute } from "@/lib/api/domains";
import { parseJson, v } from "@/lib/api/validation";
import { badRequest, unauthorized } from "@/lib/api/http";
import { getClassById } from "@/lib/classes";
import { generatePblProjectSkeleton } from "@/lib/ai-pbl-generator";
import {
  createPblProject,
  getPblTasks,
  listPblProjects,
  listPblProjectsForStudent,
  listPblProjectsForTeacher,
  listPblSubmissions,
  togglePblProjectFeatured
} from "@/lib/pbl";

export const dynamic = "force-dynamic";

const taskSchema = v.object<{ subject: string; title: string; description: string }>(
  {
    subject: v.string({ minLength: 1 }),
    title: v.string({ minLength: 1, maxLength: 80 }),
    description: v.string({ minLength: 1, maxLength: 240 })
  },
  { allowUnknown: false }
);

const createBodySchema = v.object<{
  classId?: string;
  topic: string;
  subjects: string[];
  grade?: string;
  title?: string;
  description?: string;
  rubric?: string[];
  tasks?: Array<{ subject: string; title: string; description: string }>;
  generateWithAi?: boolean;
}>(
  {
    classId: v.optional(v.string({ minLength: 1 })),
    topic: v.string({ minLength: 1, maxLength: 80 }),
    subjects: v.array(v.string({ minLength: 1 }), { minLength: 1, maxLength: 6 }),
    grade: v.optional(v.string({ minLength: 1 })),
    title: v.optional(v.string({ minLength: 1, maxLength: 80 })),
    description: v.optional(v.string({ allowEmpty: true, trim: false, maxLength: 240 })),
    rubric: v.optional(v.array(v.string({ minLength: 1, maxLength: 80 }), { minLength: 1, maxLength: 8 })),
    tasks: v.optional(v.array(taskSchema, { minLength: 1, maxLength: 8 })),
    generateWithAi: v.optional(v.boolean())
  },
  { allowUnknown: false }
);

const patchBodySchema = v.object<{ projectId: string; featured: boolean }>(
  {
    projectId: v.string({ minLength: 1 }),
    featured: v.boolean()
  },
  { allowUnknown: false }
);

export const GET = createLearningRoute({
  role: ["student", "teacher", "admin"],
  cache: "private-realtime",
  handler: async ({ user }) => {
    if (!user) {
      unauthorized();
    }

    const baseProjects =
      user.role === "student"
        ? await listPblProjectsForStudent(user.id)
        : user.role === "teacher"
          ? await listPblProjectsForTeacher(user.id)
          : await listPblProjects();

    const data = await Promise.all(
      baseProjects.map(async (project) => {
        const tasks = await getPblTasks(project.id);
        const taskPayload = await Promise.all(
          tasks.map(async (task) => {
            const submissions = await listPblSubmissions(task.id);
            return {
              ...task,
              submissionCount: submissions.length,
              latestSubmission:
                user.role === "student"
                  ? submissions.find((item) => item.studentId === user.id) ?? null
                  : submissions[0] ?? null
            };
          })
        );
        return {
          ...project,
          tasks: taskPayload
        };
      })
    );
    return { data };
  }
});

export const POST = createLearningRoute({
  role: ["teacher", "admin"],
  cache: "private-realtime",
  handler: async ({ request, user }) => {
    if (!user || (user.role !== "teacher" && user.role !== "admin")) {
      unauthorized();
    }
    const body = await parseJson(request, createBodySchema);

    if (user.role === "teacher" && body.classId) {
      const klass = await getClassById(body.classId);
      if (!klass || klass.teacherId !== user.id) {
        unauthorized();
      }
    }

    const generated =
      body.generateWithAi || !body.tasks?.length
        ? await generatePblProjectSkeleton({
            topic: body.topic,
            subjects: body.subjects,
            grade: body.grade
          })
        : null;

    const tasks = body.tasks?.length ? body.tasks : generated?.tasks;
    if (!tasks?.length) {
      badRequest("tasks required");
    }
    const created = await createPblProject({
      title: body.title?.trim() || generated?.title || `${body.topic} 跨学科项目`,
      description:
        body.description?.trim() || generated?.description || `围绕「${body.topic}」开展跨学科探究与展示。`,
      subjects: body.subjects,
      classId: body.classId,
      createdBy: user.id,
      rubric: body.rubric?.length ? body.rubric : generated?.rubric ?? [],
      tasks
    });

    return {
      data: {
        project: created.project,
        tasks: created.tasks
      }
    };
  }
});

export const PATCH = createLearningRoute({
  role: ["teacher", "admin"],
  cache: "private-realtime",
  handler: async ({ request, user }) => {
    if (!user || (user.role !== "teacher" && user.role !== "admin")) {
      unauthorized();
    }
    const body = await parseJson(request, patchBodySchema);
    const projects =
      user.role === "teacher"
        ? await listPblProjectsForTeacher(user.id)
        : await listPblProjects();
    if (!projects.some((item) => item.id === body.projectId)) {
      unauthorized();
    }
    await togglePblProjectFeatured(body.projectId, body.featured);
    return { success: true };
  }
});

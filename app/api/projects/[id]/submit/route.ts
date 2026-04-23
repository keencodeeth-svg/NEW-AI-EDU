import { createLearningRoute } from "@/lib/api/domains";
import { parseJson, v } from "@/lib/api/validation";
import { badRequest, notFound, unauthorized } from "@/lib/api/http";
import { callRoutedLLM } from "@/lib/ai-router";
import { getPblTasks, listPblProjectsForStudent, upsertPblSubmission } from "@/lib/pbl";

export const dynamic = "force-dynamic";

const paramsSchema = v.object<{ id: string }>(
  {
    id: v.string({ minLength: 1 })
  },
  { allowUnknown: true }
);

const bodySchema = v.object<{
  taskId: string;
  content: string;
}>(
  {
    taskId: v.string({ minLength: 1 }),
    content: v.string({ minLength: 1, maxLength: 4000 })
  },
  { allowUnknown: false }
);

async function buildAiFeedback(content: string, taskTitle: string, subject: string) {
  const llm = await callRoutedLLM({
    taskType: "explanation",
    temperature: 0.4,
    messages: [
      {
        role: "system",
        content: "你是项目式学习导师，请给出简短、具体、可执行的过程性反馈。"
      },
      {
        role: "user",
        content: [
          `任务标题：${taskTitle}`,
          `学科：${subject}`,
          "请从完成度、表达清晰度、下一步改进三个角度给出 3 句以内反馈。",
          `学生提交：${content}`
        ].join("\n")
      }
    ]
  });
  return llm?.text?.trim() || "已经完成了关键任务内容，下一步建议补充更具体的证据、过程说明和最终结论，让作品更完整。";
}

export const POST = createLearningRoute({
  role: "student",
  params: paramsSchema,
  cache: "private-realtime",
  handler: async ({ request, params, user }) => {
    if (!user || user.role !== "student") {
      unauthorized();
    }
    const projects = await listPblProjectsForStudent(user.id);
    const project = projects.find((item) => item.id === params.id);
    if (!project) {
      notFound("project not found");
    }
    const body = await parseJson(request, bodySchema);
    const tasks = await getPblTasks(project.id);
    const task = tasks.find((item) => item.id === body.taskId);
    if (!task) {
      badRequest("task not found");
    }
    const aiFeedback = await buildAiFeedback(body.content, task.title, task.subject);
    const submission = await upsertPblSubmission({
      taskId: task.id,
      studentId: user.id,
      content: body.content,
      aiFeedback,
      score: Math.max(60, Math.min(98, 70 + Math.round(body.content.trim().length / 80)))
    });
    return { data: submission };
  }
});

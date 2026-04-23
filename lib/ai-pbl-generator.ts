import { asJsonObject, getJsonObjectArrayField, getStringArrayField, getStringField } from "./ai-json";
import { callRoutedLLM } from "./ai-router";
import { extractJson } from "./ai-utils";

export type GeneratedPblTask = {
  subject: string;
  title: string;
  description: string;
};

export type GeneratedPblProject = {
  title: string;
  description: string;
  subjects: string[];
  rubric: string[];
  tasks: GeneratedPblTask[];
};

function buildFallbackProject(input: { topic: string; subjects: string[] }) {
  return {
    title: `${input.topic} 跨学科项目`,
    description: `围绕「${input.topic}」组织资料查找、方案设计、表达展示与反思复盘。`,
    subjects: input.subjects,
    rubric: ["问题定义是否清晰", "跨学科知识是否真正用上", "表达与展示是否完整"],
    tasks: input.subjects.map((subject, index) => ({
      subject,
      title: `${subject} 子任务 ${index + 1}`,
      description: `围绕 ${subject} 视角完成与主题相关的资料整理、解释或小作品。`
    }))
  } satisfies GeneratedPblProject;
}

export async function generatePblProjectSkeleton(input: {
  topic: string;
  subjects: string[];
  grade?: string;
}) {
  const llm = await callRoutedLLM({
    taskType: "lesson_plan",
    temperature: 0.5,
    messages: [
      {
        role: "system",
        content: "你是一个跨学科项目式学习设计助手，擅长把一个主题拆成适合学校课堂实施的小项目。"
      },
      {
        role: "user",
        content: [
          "请只输出 JSON。",
          '字段：title(string), description(string), subjects(string[]), rubric(string[]), tasks([{subject,title,description}])。',
          `主题：${input.topic}`,
          input.grade ? `年级：${input.grade}` : "",
          `学科范围：${input.subjects.join("、")}`,
          "要求：任务数量 3-5 个，每个任务只关联一个学科，评价维度要兼顾知识应用、合作表达和创意。"
        ]
          .filter(Boolean)
          .join("\n")
      }
    ]
  });

  if (!llm?.text) {
    return buildFallbackProject(input);
  }

  const root = asJsonObject(extractJson(llm.text));
  if (!root) {
    return buildFallbackProject(input);
  }

  const taskList = getJsonObjectArrayField(root, "tasks")
    .map((item) => ({
      subject: getStringField(item, "subject"),
      title: getStringField(item, "title"),
      description: getStringField(item, "description")
    }))
    .filter((item) => item.subject && item.title && item.description);

  const fallback = buildFallbackProject(input);
  return {
    title: getStringField(root, "title") || fallback.title,
    description: getStringField(root, "description") || fallback.description,
    subjects: getStringArrayField(root, "subjects").length ? getStringArrayField(root, "subjects") : fallback.subjects,
    rubric: getStringArrayField(root, "rubric").length ? getStringArrayField(root, "rubric") : fallback.rubric,
    tasks: taskList.length ? taskList : fallback.tasks
  } satisfies GeneratedPblProject;
}


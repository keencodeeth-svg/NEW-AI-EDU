import { asJsonObject, getJsonObjectField, getStringArrayField } from "./ai-json";
import { callRoutedLLM } from "./ai-router";
import { extractJson } from "./ai-utils";

export type LessonPlanOutput = {
  commonMistakes: string[];
  interactionIdeas: string[];
  tieredAssignments: {
    easy: string[];
    medium: string[];
    hard: string[];
  };
  reflectionReport: string;
  rawText?: string;
};

type LessonPlanInput = {
  subject: string;
  grade: string;
  topic: string;
  classMasteryStats?: string[];
};

function buildFallbackPlan(input: LessonPlanInput): LessonPlanOutput {
  return {
    commonMistakes: [
      `学生可能会把「${input.topic}」中的核心概念和旧知识混用，需要先澄清定义。`,
      "中等水平学生容易只记步骤，不清楚为什么这样做。",
      "薄弱学生可能在读题阶段就丢失关键信息。"
    ],
    interactionIdeas: [
      "先用一个贴近生活的情境引出概念，再让学生说出自己的第一反应。",
      "设置 1 道全班共答的小题，及时判断理解断点。",
      "课堂中段加入同桌互讲或一分钟复述，帮助暴露误区。"
    ],
    tieredAssignments: {
      easy: ["先完成 3 道基础题，重点保证读题和列式正确。"],
      medium: ["完成 4 道同类题，并写出每步依据。"],
      hard: ["完成 2 道综合迁移题，并用自己的话总结通法。"]
    },
    reflectionReport:
      input.classMasteryStats?.length
        ? `从当前学情看，班级在 ${input.classMasteryStats.slice(0, 2).join("、")} 上仍需持续追踪。建议本轮教学后重点复盘“错误集中在哪一步”和“哪一档学生最需要额外脚手架”。`
        : `围绕「${input.topic}」完成本轮教学后，建议教师重点记录：学生最常见误区、互动环节有效度，以及分层作业是否真正拉开梯度。`
  };
}

function normalizeLessonPlanPayload(payload: unknown, input: LessonPlanInput): LessonPlanOutput {
  const root = asJsonObject(payload);
  if (!root) {
    return buildFallbackPlan(input);
  }
  const tieredAssignments = getJsonObjectField(root, "tieredAssignments");
  return {
    commonMistakes: getStringArrayField(root, "commonMistakes").slice(0, 6),
    interactionIdeas: getStringArrayField(root, "interactionIdeas").slice(0, 6),
    tieredAssignments: {
      easy: tieredAssignments ? getStringArrayField(tieredAssignments, "easy").slice(0, 5) : [],
      medium: tieredAssignments ? getStringArrayField(tieredAssignments, "medium").slice(0, 5) : [],
      hard: tieredAssignments ? getStringArrayField(tieredAssignments, "hard").slice(0, 5) : []
    },
    reflectionReport:
      (typeof root.reflectionReport === "string" && root.reflectionReport.trim()) || buildFallbackPlan(input).reflectionReport
  };
}

export async function generateLessonPlan(input: LessonPlanInput): Promise<LessonPlanOutput> {
  const prompt = [
    "请以中国学校真实教师备课助手的口吻输出 JSON，不要输出额外说明。",
    '字段必须包含：commonMistakes(string[]), interactionIdeas(string[]), tieredAssignments({easy:string[],medium:string[],hard:string[]}), reflectionReport(string)。',
    `学科：${input.subject}`,
    `年级：${input.grade}`,
    `主题：${input.topic}`,
    input.classMasteryStats?.length ? `班级学情摘要：${input.classMasteryStats.join("；")}` : "班级学情摘要：暂无完整统计，请给出稳健的通用策略。",
    "要求：错误预测要具体，互动设计要可直接在课堂中执行，分层作业分别对应基础巩固、常规提升、迁移挑战。"
  ]
    .filter(Boolean)
    .join("\n");

  const llm = await callRoutedLLM({
    taskType: "lesson_plan",
    messages: [
      {
        role: "system",
        content: "你是资深教研组长兼 AI 备课助手，擅长产出结构化、可执行、适合一线教师直接使用的备课方案。"
      },
      {
        role: "user",
        content: prompt
      }
    ],
    temperature: 0.4
  });

  if (!llm?.text) {
    return buildFallbackPlan(input);
  }

  const normalized = normalizeLessonPlanPayload(extractJson(llm.text), input);
  return {
    ...normalized,
    rawText: llm.text
  };
}


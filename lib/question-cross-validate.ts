import { getEffectiveAiProviderChain } from "./ai-config";
import { asJsonObject, getStringField } from "./ai-json";
import { callRoutedLLM } from "./ai-router";
import { extractJson } from "./ai-utils";
import type { Question } from "./types";

export type QuestionCrossValidationResult = {
  checked: boolean;
  provider: string;
  matched: boolean;
  proposedAnswer: string | null;
  needsManualReview: boolean;
  reviewReason: string | null;
};

function normalizeAnswer(value?: string | null) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

function normalizeModelAnswer(value: string, question: Question) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const upper = trimmed.toUpperCase();
  if (["A", "B", "C", "D"].includes(upper)) {
    const index = ["A", "B", "C", "D"].indexOf(upper);
    return question.options[index] ?? trimmed;
  }
  return trimmed;
}

export async function crossValidateQuestionAnswer(question: Question): Promise<QuestionCrossValidationResult> {
  const chain = getEffectiveAiProviderChain().filter((item) => item !== "mock");
  const secondaryChain = chain.slice(1, 2);
  if (!secondaryChain.length) {
    return {
      checked: false,
      provider: "rule",
      matched: true,
      proposedAnswer: question.answer,
      needsManualReview: false,
      reviewReason: null
    };
  }

  const llm = await callRoutedLLM({
    taskType: "question_check",
    chain: secondaryChain,
    temperature: 0.1,
    messages: [
      {
        role: "system",
        content: "你是一个独立数学题审核助手。请独立解题后只输出 JSON。"
      },
      {
        role: "user",
        content: [
          "请独立求解下面这道题，并只输出 JSON。",
          '字段：answer(string), confidence(string)。',
          `题目：${question.stem}`,
          question.options.length ? `选项：${question.options.join(" | ")}` : ""
        ]
          .filter(Boolean)
          .join("\n")
      }
    ]
  });

  if (!llm?.text) {
    return {
      checked: false,
      provider: secondaryChain[0] ?? "unknown",
      matched: true,
      proposedAnswer: null,
      needsManualReview: false,
      reviewReason: null
    };
  }

  const parsed = asJsonObject(extractJson(llm.text));
  const proposedAnswer = normalizeModelAnswer(getStringField(parsed ?? {}, "answer"), question) || question.answer;
  const matched = normalizeAnswer(proposedAnswer) === normalizeAnswer(question.answer);
  return {
    checked: true,
    provider: llm.provider,
    matched,
    proposedAnswer,
    needsManualReview: !matched,
    reviewReason: matched ? null : `交叉验证答案不一致：原答案为「${question.answer}」，二次求解为「${proposedAnswer}」。`
  };
}


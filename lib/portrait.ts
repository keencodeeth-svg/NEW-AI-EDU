import { getAttemptsByUser } from "./progress";
import { getQuestions } from "./content";
import type { Question } from "./types";

export type AbilityStat = {
  id: string;
  label: string;
  correct: number;
  total: number;
  score: number;
};

const DEFAULT_ABILITIES = ["算数", "阅读", "逻辑", "表达", "语法"];

function fallbackAbility(question: Question) {
  const tags = question.tags ?? [];
  const text = `${question.stem} ${tags.join(" ")}`.toLowerCase();
  if (question.subject === "math") {
    if (text.includes("逻辑") || text.includes("推理")) return "逻辑";
    if (text.includes("应用") || text.includes("情境")) return "应用";
    return "算数";
  }
  if (question.subject === "english") {
    if (text.includes("grammar") || text.includes("语法")) return "语法";
    if (text.includes("reading") || text.includes("阅读")) return "阅读";
    return "词汇";
  }
  if (question.subject === "chinese") {
    if (text.includes("作文") || text.includes("写作")) return "表达";
    if (text.includes("字词") || text.includes("生字")) return "字词";
    return "阅读";
  }
  return "综合";
}

function normalizeAbility(label: string) {
  return label.trim();
}

export async function getAbilityRadar(userId: string): Promise<AbilityStat[]> {
  const attempts = await getAttemptsByUser(userId);
  const questions = await getQuestions();
  const questionMap = new Map<string, Question>(questions.map((q) => [q.id, q]));

  const stats = new Map<string, { correct: number; total: number }>();
  attempts.forEach((attempt) => {
    const question = questionMap.get(attempt.questionId);
    if (!question) return;
    const abilities = question.abilities?.length
      ? question.abilities.map(normalizeAbility)
      : [fallbackAbility(question)];
    abilities.forEach((ability) => {
      if (!ability) return;
      const current = stats.get(ability) ?? { correct: 0, total: 0 };
      current.total += 1;
      current.correct += attempt.correct ? 1 : 0;
      stats.set(ability, current);
    });
  });

  if (!stats.size) {
    return DEFAULT_ABILITIES.map((label) => ({ id: label, label, correct: 0, total: 0, score: 0 }));
  }

  const result: AbilityStat[] = [];
  stats.forEach((value, key) => {
    const ratio = value.total === 0 ? 0 : value.correct / value.total;
    const score = Math.round(ratio * 100);
    result.push({ id: key, label: key, correct: value.correct, total: value.total, score });
  });

  return result.sort((a, b) => b.score - a.score).slice(0, 5);
}

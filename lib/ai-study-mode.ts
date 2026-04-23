import type { AssistResponse, StudyCoachResponse, HintTier, ScaffoldedHint, MetacognitionPrompt } from "./ai-types";

const STAGE_LABELS: Record<StudyCoachResponse["stage"], string> = {
  diagnose: "先说思路",
  check: "知识检查",
  reveal: "完整讲解"
};

function normalizeInline(value: string, maxLength = 72) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "";
  }
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength)}...`;
}

function simplifyStepLead(value: string) {
  const normalized = normalizeInline(value, 48)
    .replace(/[=].*$/, "")
    .replace(/[0-9]+(?:\/[0-9]+)?/g, "关键量")
    .trim();
  return normalized || "先判断题目要你求什么";
}

function buildMasteryFocus(input: {
  question: string;
  subject?: string;
  sources: string[];
}) {
  const primarySource = input.sources.find(Boolean);
  if (primarySource) {
    return `先确认你为什么要用「${primarySource}」来切题。`;
  }

  if (input.subject === "math") {
    if (/\d+\s*\/\s*\d+/.test(input.question) || /分数|通分|约分/.test(input.question)) {
      return "先判断分数之间的关系，再决定是否需要通分或约分。";
    }
    if (/面积|周长|长方形|正方形|三角形|圆|图形/.test(input.question)) {
      return "先找清图形条件和要求，再决定公式。";
    }
    if (/方程|未知数|x|等量关系/.test(input.question)) {
      return "先列出等量关系，再动手求未知数。";
    }
  }

  if (input.subject === "english") {
    return "先判断题目考的是词义、语法还是语境。";
  }

  if (input.subject === "chinese") {
    return "先圈出题干关键词，再判断答题角度。";
  }

  return "先说清题目的已知条件、目标和第一步。";
}

function buildHints(assist: AssistResponse) {
  const nextHints = assist.hints.filter(Boolean).slice(0, 4);
  if (nextHints.length) {
    return nextHints;
  }

  return ["先圈出题目里的已知条件。", "不要急着算，先判断要用什么方法。"];
}

function buildKnowledgeChecks(input: {
  question: string;
  studentAnswer?: string;
  masteryFocus: string;
  sources: string[];
  steps: string[];
}) {
  const primarySource = input.sources.find(Boolean);
  const firstStep = simplifyStepLead(input.steps[0] ?? "");

  return [
    primarySource
      ? `这道题为什么会用到「${primarySource}」？请用一句话说明。`
      : "题目里最关键的已知条件是什么？",
    `如果现在开始，你的第一步会怎么做？可以先从“${firstStep}”这个方向思考。`,
    input.studentAnswer?.trim()
      ? "回头看你的思路，哪一步最不稳？你准备怎么修正？"
      : `请把这句要求落实成你的动作：${input.masteryFocus}`
  ];
}

function buildFeedback(input: { studentAnswer?: string; masteryFocus: string; hints: string[] }) {
  const studentAnswer = input.studentAnswer?.trim();
  if (!studentAnswer) {
    return null;
  }

  const preview = normalizeInline(studentAnswer, 56);
  const nextHint = input.hints[0] ? `提示你先抓住：${normalizeInline(input.hints[0], 36)}` : "";
  const detailHint =
    studentAnswer.length < 16
      ? "思路还比较短，建议补上“已知条件 + 用到的方法 + 第一动作”。"
      : "你已经给出了起点，下一步把方法依据说得更明确。";

  return `已收到你的思路：“${preview}”。${detailHint} 当前先盯住这件事：${input.masteryFocus}${nextHint ? ` ${nextHint}` : ""}`;
}

function buildCoachReply(input: {
  stage: StudyCoachResponse["stage"];
  masteryFocus: string;
  feedback: string | null;
}) {
  if (input.stage === "reveal") {
    return "下面给你完整讲解。看完先别退出，试着不看答案再复述一遍关键转折。";
  }

  if (input.stage === "check") {
    return input.feedback ?? `先别急着看答案，我们继续把这道题的切题方法说扎实。重点是：${input.masteryFocus}`;
  }

  return `先不直接给答案。这一轮按学习模式来，先判断你会不会选对方法。重点是：${input.masteryFocus}`;
}

function buildNextPrompt(input: {
  stage: StudyCoachResponse["stage"];
  question: string;
  studentAnswer?: string;
}) {
  const questionPreview = normalizeInline(input.question, 28);
  if (input.stage === "reveal") {
    return `现在回到题目“${questionPreview}”，请你不用看答案，再复述一遍为什么要这么做。`;
  }

  if (input.studentAnswer?.trim()) {
    return "把你的解法重写成 2-3 句：先说条件，再说方法，最后说第一步。";
  }

  return `围绕题目“${questionPreview}”，先用 1-2 句话说出已知条件和你准备下手的第一步。`;
}

function buildRevealAnswerCta(stage: StudyCoachResponse["stage"]) {
  if (stage === "reveal") {
    return "已显示完整讲解";
  }
  if (stage === "check") {
    return "需要时可查看完整讲解";
  }
  return "先回答后再看讲解";
}

function buildAnalogyHint(assist: AssistResponse, subject?: string): ScaffoldedHint {
  const primarySource = assist.sources.find(Boolean);
  let content: string;

  if (primarySource) {
    content = `想想你之前学过的「${primarySource}」，这道题的核心思路和它是类似的。`;
  } else if (subject === "math") {
    content = "试试把这道题里的数字换成更简单的数（比如 1、2、3），先用简单情况找规律。";
  } else if (subject === "english") {
    content = "把这道题翻译成中文理解一遍，看看考的是词汇、语法还是语境。";
  } else if (subject === "chinese") {
    content = "回忆一下课文里有没有类似的表达方式或写作手法，先找到对应的知识点。";
  } else {
    content = "想想生活中有没有类似的场景，先用自己的话描述一遍这道题在问什么。";
  }

  return { tier: 1, tierLabel: "类比提示", content };
}

function buildFirstStepHint(assist: AssistResponse): ScaffoldedHint {
  const firstStep = assist.steps[0];
  const content = firstStep
    ? `第一步方向：${simplifyStepLead(firstStep)}`
    : "第一步：先把题目里的已知条件全部列出来，再判断要求什么。";

  return { tier: 2, tierLabel: "第一步", content };
}

function buildFormulaHint(assist: AssistResponse): ScaffoldedHint {
  const primarySource = assist.sources.find(Boolean);
  const keyStep = assist.steps.find((s) => /公式|定理|法则|规则|原理/.test(s));

  let content: string;
  if (primarySource && keyStep) {
    content = `关键知识点：${primarySource}。核心方法：${normalizeInline(keyStep, 64)}`;
  } else if (primarySource) {
    content = `关键知识点：${primarySource}。回忆这个知识点对应的公式或方法，直接套用。`;
  } else {
    content = assist.steps.length
      ? `核心方法：${normalizeInline(assist.steps[0], 64)}`
      : "回忆课本上这类题目对应的公式或定理，直接套用。";
  }

  return { tier: 3, tierLabel: "关键公式", content };
}

function buildScaffoldedHints(
  assist: AssistResponse,
  subject?: string,
  requestedTier: HintTier = 1
): ScaffoldedHint[] {
  const hints: ScaffoldedHint[] = [buildAnalogyHint(assist, subject)];
  if (requestedTier >= 2) {
    hints.push(buildFirstStepHint(assist));
  }
  if (requestedTier >= 3) {
    hints.push(buildFormulaHint(assist));
  }
  return hints;
}

function buildMetacognitionPrompt(subject?: string): MetacognitionPrompt {
  const baseQuestion = "你觉得这道题做错（或卡住）的主要原因是什么？";

  const mathSuggestions = [
    "题目没读清楚",
    "知道方法但计算出错",
    "不知道该用什么方法",
    "公式记混了",
    "粗心大意",
  ];

  const chineseSuggestions = [
    "题目理解有偏差",
    "关键词没找对",
    "答题角度没选好",
    "知识点记忆模糊",
    "审题太快",
  ];

  const englishSuggestions = [
    "单词不认识",
    "语法规则不熟",
    "句意理解错误",
    "固定搭配不记得",
    "审题不仔细",
  ];

  const defaultSuggestions = [
    "题目没看懂",
    "方法不对",
    "知识点没掌握",
    "粗心出错",
    "时间不够",
  ];

  let attributionSuggestions: string[];
  if (subject === "math") {
    attributionSuggestions = mathSuggestions;
  } else if (subject === "chinese") {
    attributionSuggestions = chineseSuggestions;
  } else if (subject === "english") {
    attributionSuggestions = englishSuggestions;
  } else {
    attributionSuggestions = defaultSuggestions;
  }

  return { question: baseQuestion, attributionSuggestions };
}

export function buildStudyCoachResponse(input: {
  question: string;
  subject?: string;
  studentAnswer?: string;
  revealAnswer?: boolean;
  assist: AssistResponse;
  requestedHintTier?: HintTier;
  metacognitionTrigger?: boolean;
}): StudyCoachResponse {
  const stage: StudyCoachResponse["stage"] = input.revealAnswer
    ? "reveal"
    : input.studentAnswer?.trim()
      ? "check"
      : "diagnose";
  const hints = buildHints(input.assist);
  const masteryFocus = buildMasteryFocus({
    question: input.question,
    subject: input.subject,
    sources: input.assist.sources
  });
  const feedback = buildFeedback({
    studentAnswer: input.studentAnswer,
    masteryFocus,
    hints
  });
  const knowledgeChecks = buildKnowledgeChecks({
    question: input.question,
    studentAnswer: input.studentAnswer,
    masteryFocus,
    sources: input.assist.sources,
    steps: input.assist.steps
  });

  const scaffoldedHints = stage !== "reveal"
    ? buildScaffoldedHints(input.assist, input.subject, input.requestedHintTier)
    : undefined;
  const activeHintTier = stage !== "reveal" ? (input.requestedHintTier ?? 1) : undefined;
  const metacognition =
    stage === "check" && input.metacognitionTrigger
      ? buildMetacognitionPrompt(input.subject)
      : null;

  return {
    learningMode: "study",
    stage,
    stageLabel: STAGE_LABELS[stage],
    coachReply: buildCoachReply({
      stage,
      masteryFocus,
      feedback
    }),
    nextPrompt: buildNextPrompt({
      stage,
      question: input.question,
      studentAnswer: input.studentAnswer
    }),
    knowledgeChecks,
    checkpoints: knowledgeChecks,
    masteryFocus,
    studentTurnRequired: stage !== "reveal",
    answerAvailable: Boolean(input.assist.answer.trim()),
    revealAnswerCta: buildRevealAnswerCta(stage),
    answer: stage === "reveal" ? input.assist.answer : "",
    steps: stage === "reveal" ? input.assist.steps : [],
    hints,
    sources: input.assist.sources,
    provider: input.assist.provider,
    quality: input.assist.quality,
    feedback,
    scaffoldedHints,
    activeHintTier,
    metacognition
  };
}

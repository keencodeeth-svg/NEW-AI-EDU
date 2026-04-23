import { asJsonObject, getStringField } from "./ai-json";
import { callRoutedLLM } from "./ai-router";
import { extractJson } from "./ai-utils";

export type PeerLearnerChallenge = {
  wrongSolution: string;
  confusionPrompt: string;
  followUpPrompt: string;
  feedback?: string;
};

type PeerLearnerInput = {
  question: string;
  correctAnswer: string;
  commonMistake?: string;
  studentExplanation?: string;
};

function buildFallbackChallenge(input: PeerLearnerInput): PeerLearnerChallenge {
  if (input.studentExplanation?.trim()) {
    return {
      wrongSolution: "",
      confusionPrompt: "",
      followUpPrompt: "你能再用一句话总结，为什么这个错误会让最后答案偏掉吗？",
      feedback: "你的纠错思路已经很接近老师式讲解了。再把“错在哪里”和“为什么不能这样做”说完整，就是真正的费曼式复述。"
    };
  }
  return {
    wrongSolution: `我觉得答案应该直接选 ${input.correctAnswer}，因为看到题目里的关键词就能马上套这个结论，不需要再检查中间条件。`,
    confusionPrompt: "我觉得我的思路是对的，但又有点不确定，你能告诉我哪里不对吗？",
    followUpPrompt: "你能解释为什么这里错了吗？如果换成讲给同学听，你会怎么说？"
  };
}

export async function generatePeerLearnerChallenge(input: PeerLearnerInput): Promise<PeerLearnerChallenge> {
  const prompt = input.studentExplanation?.trim()
    ? [
        "请用鼓励式中文输出 JSON，不要输出额外说明。",
        '字段：feedback(string), followUpPrompt(string)。',
        `题目：${input.question}`,
        `正确答案：${input.correctAnswer}`,
        `学生对 AI 学伴的纠错说明：${input.studentExplanation.trim()}`,
        "要求：先肯定，再指出是否讲清了“错因”和“正确原则”，最后追问一句帮助学生进一步巩固。"
      ].join("\n")
    : [
        "请用中文输出 JSON，不要输出额外说明。",
        '字段：wrongSolution(string), confusionPrompt(string), followUpPrompt(string)。',
        `题目：${input.question}`,
        `正确答案：${input.correctAnswer}`,
        input.commonMistake ? `常见错误：${input.commonMistake}` : "",
        "要求：你要扮演一个刚学这道题、犯了典型错误的同学，给出带有具体错误步骤的错误解法，并表达“我觉得我是对的”的困惑。"
      ]
        .filter(Boolean)
        .join("\n");

  const llm = await callRoutedLLM({
    taskType: "explanation",
    messages: [
      {
        role: "system",
        content: "你是一个用于费曼学习法的 AI 学伴，擅长故意暴露典型错误，促使学生通过讲解来巩固知识。"
      },
      {
        role: "user",
        content: prompt
      }
    ],
    temperature: 0.5
  });

  if (!llm?.text) {
    return buildFallbackChallenge(input);
  }

  const parsed = asJsonObject(extractJson(llm.text));
  if (!parsed) {
    return buildFallbackChallenge(input);
  }

  return {
    wrongSolution: getStringField(parsed, "wrongSolution"),
    confusionPrompt: getStringField(parsed, "confusionPrompt"),
    followUpPrompt: getStringField(parsed, "followUpPrompt") || buildFallbackChallenge(input).followUpPrompt,
    feedback: getStringField(parsed, "feedback") || undefined
  };
}


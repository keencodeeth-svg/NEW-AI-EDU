import { createLearningRoute } from "@/lib/api/domains";
import { parseJson, v } from "@/lib/api/validation";
import { unauthorized } from "@/lib/api/http";
import { callRoutedLLM } from "@/lib/ai-router";

export const dynamic = "force-dynamic";

const bodySchema = v.object<{
  step: string;
  subject?: string;
  grade?: string;
}>(
  {
    step: v.string({ minLength: 1, maxLength: 500 }),
    subject: v.optional(v.string({ minLength: 1 })),
    grade: v.optional(v.string({ minLength: 1 }))
  },
  { allowUnknown: false }
);

export const POST = createLearningRoute({
  role: ["student", "teacher"],
  cache: "private-realtime",
  handler: async ({ request, user }) => {
    if (!user) {
      unauthorized();
    }
    const body = await parseJson(request, bodySchema);
    const llm = await callRoutedLLM({
      taskType: "reexplain",
      temperature: 0.4,
      messages: [
        {
          role: "system",
          content: "你是耐心的中小学学科老师，擅长把难点改写成类比、图示感或生活化的解释。"
        },
        {
          role: "user",
          content: [
            body.subject ? `学科：${body.subject}` : "",
            body.grade ? `年级：${body.grade}` : "",
            "请用生活中的类比或者更直观的画面感，重新解释下面这个步骤。",
            "要求：少用符号，多用口语，控制在 120 字以内。",
            `步骤：${body.step}`
          ]
            .filter(Boolean)
            .join("\n")
        }
      ]
    });

    return {
      data: {
        explanation:
          llm?.text?.trim() ||
          "可以把它理解成先把问题拆成更小的块，先弄清每一块在做什么，再把它们按顺序拼起来，这样就不容易在中间跳步。"
      }
    };
  }
});

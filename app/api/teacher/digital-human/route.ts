import { createLearningRoute } from "@/lib/api/domains";
import { getTeacherDigitalHumanProfile, saveTeacherDigitalHumanProfile } from "@/lib/teacher-digital-human";
import { unauthorized } from "@/lib/api/http";
import { v } from "@/lib/api/validation";
import type { TeacherDigitalHumanProfile } from "@/lib/classroom-integration";
import type { TTSProviderId } from "@/lib/audio/types";
import type { ImageProviderId } from "@/lib/media/types";

export const dynamic = "force-dynamic";

const IMAGE_PROVIDER_IDS = ["seedream", "qwen-image", "nano-banana"] as const satisfies readonly ImageProviderId[];
const TTS_PROVIDER_IDS = [
  "openai-tts",
  "azure-tts",
  "glm-tts",
  "qwen-tts",
  "browser-native-tts",
] as const satisfies readonly TTSProviderId[];

const updateBodySchema = v.object<Partial<TeacherDigitalHumanProfile>>(
  {
    displayName: v.optional(v.string({ allowEmpty: true, trim: false })),
    title: v.optional(v.string({ allowEmpty: true, trim: false })),
    portraitPrompt: v.optional(v.string({ allowEmpty: true, trim: false })),
    portraitUrl: v.optional(v.string({ allowEmpty: true, trim: false })),
    imageProviderId: v.optional(v.enum(IMAGE_PROVIDER_IDS)),
    voiceProviderId: v.optional(v.enum(TTS_PROVIDER_IDS)),
    voiceId: v.optional(v.string({ allowEmpty: true, trim: false })),
    voiceLabel: v.optional(v.string({ allowEmpty: true, trim: false })),
    introduction: v.optional(v.string({ allowEmpty: true, trim: false })),
    sampleScript: v.optional(v.string({ allowEmpty: true, trim: false })),
  },
  { allowUnknown: false },
);

export const GET = createLearningRoute({
  role: "teacher",
  cache: "private-realtime",
  handler: async ({ user }) => {
    if (!user || user.role !== "teacher") {
      unauthorized();
    }

    return {
      data: await getTeacherDigitalHumanProfile(user.id, user.name),
    };
  },
});

export const POST = createLearningRoute({
  role: "teacher",
  body: updateBodySchema,
  cache: "private-realtime",
  handler: async ({ body, user }) => {
    if (!user || user.role !== "teacher") {
      unauthorized();
    }

    const profile = await saveTeacherDigitalHumanProfile(user.id, user.name, body);
    return {
      data: profile,
    };
  },
});

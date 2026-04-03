export type ServerProviderCategory =
  | "providers"
  | "tts"
  | "asr"
  | "pdf"
  | "image"
  | "video"
  | "webSearch";

export const LLM_ENV_MAP: Record<string, string> = {
  OPENAI: "openai",
  ANTHROPIC: "anthropic",
  GOOGLE: "google",
  DEEPSEEK: "deepseek",
  QWEN: "qwen",
  KIMI: "kimi",
  MINIMAX: "minimax",
  GLM: "glm",
  SILICONFLOW: "siliconflow",
  DOUBAO: "doubao",
};

export const TTS_ENV_MAP: Record<string, string> = {
  TTS_OPENAI: "openai-tts",
  TTS_AZURE: "azure-tts",
  TTS_GLM: "glm-tts",
  TTS_QWEN: "qwen-tts",
};

export const ASR_ENV_MAP: Record<string, string> = {
  ASR_OPENAI: "openai-whisper",
  ASR_QWEN: "qwen-asr",
};

export const PDF_ENV_MAP: Record<string, string> = {
  PDF_UNPDF: "unpdf",
  PDF_MINERU: "mineru",
};

export const IMAGE_ENV_MAP: Record<string, string> = {
  IMAGE_SEEDREAM: "seedream",
  IMAGE_QWEN_IMAGE: "qwen-image",
  IMAGE_NANO_BANANA: "nano-banana",
};

export const VIDEO_ENV_MAP: Record<string, string> = {
  VIDEO_SEEDANCE: "seedance",
  VIDEO_KLING: "kling",
  VIDEO_VEO: "veo",
  VIDEO_SORA: "sora",
};

export const WEB_SEARCH_ENV_MAP: Record<string, string> = {
  TAVILY: "tavily",
};

export const PROVIDER_ENV_MAPS: Record<ServerProviderCategory, Record<string, string>> = {
  providers: LLM_ENV_MAP,
  tts: TTS_ENV_MAP,
  asr: ASR_ENV_MAP,
  pdf: PDF_ENV_MAP,
  image: IMAGE_ENV_MAP,
  video: VIDEO_ENV_MAP,
  webSearch: WEB_SEARCH_ENV_MAP,
};

export const PROVIDER_CATEGORY_LABELS: Record<ServerProviderCategory, string> = {
  providers: "语言模型",
  tts: "语音合成",
  asr: "语音识别",
  pdf: "文档解析",
  image: "图像生成",
  video: "视频生成",
  webSearch: "联网检索",
};

export function listProviderIds(
  category: ServerProviderCategory,
  extraIds: string[] = [],
): string[] {
  return Array.from(
    new Set([...Object.values(PROVIDER_ENV_MAPS[category]), ...extraIds].filter(Boolean)),
  ).sort();
}

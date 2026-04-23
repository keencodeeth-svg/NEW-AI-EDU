import assert from "node:assert/strict";
import path from "node:path";
import { afterEach, test } from "node:test";

const Module = require("node:module") as {
  _resolveFilename: (request: string, parent?: unknown, isMain?: boolean, options?: unknown) => string;
};

type WebSearchRouteModule = typeof import("../../app/api/web-search/route");
type VerifyImageProviderRouteModule = typeof import("../../app/api/verify-image-provider/route");
type VerifyVideoProviderRouteModule = typeof import("../../app/api/verify-video-provider/route");
type TtsRouteModule = typeof import("../../app/api/generate/tts/route");
type AzureVoicesRouteModule = typeof import("../../app/api/azure-voices/route");
type TranscriptionRouteModule = typeof import("../../app/api/transcription/route");
type ParsePdfRouteModule = typeof import("../../app/api/parse-pdf/route");
type _ProviderConfigModule = typeof import("../../lib/server/provider-config");
type _TavilyModule = typeof import("../../lib/web-search/tavily");
type _ImageProvidersModule = typeof import("../../lib/media/image-providers");
type _VideoProvidersModule = typeof import("../../lib/media/video-providers");
type _TtsProvidersModule = typeof import("../../lib/audio/tts-providers");
type _AsrProvidersModule = typeof import("../../lib/audio/asr-providers");
type _PdfProvidersModule = typeof import("../../lib/pdf/pdf-providers");
type _LoggerModule = typeof import("../../lib/logger");

type RouteModule = {
  POST?: (request: Request, context?: { params: Record<string, string> }) => Promise<Response>;
};

const projectRoot = path.resolve(__dirname, "../..");
const originalResolveFilename = Module._resolveFilename;
const originalFetch = globalThis.fetch;

function withAliasResolution<T>(fn: () => T): T {
  Module._resolveFilename = function resolveFilename(request, parent, isMain, options) {
    if (request.startsWith("@/")) {
      return originalResolveFilename.call(this, path.resolve(projectRoot, request.slice(2)), parent, isMain, options);
    }
    return originalResolveFilename.call(this, request, parent, isMain, options);
  };

  try {
    return fn();
  } finally {
    Module._resolveFilename = originalResolveFilename;
  }
}

function clearModule(target: string) {
  try {
    delete require.cache[require.resolve(target)];
  } catch {
    // Ignore cache misses.
  }
}

function resetModules() {
  const targets = [
    "../../app/api/web-search/route",
    "../../app/api/verify-image-provider/route",
    "../../app/api/verify-video-provider/route",
    "../../app/api/generate/tts/route",
    "../../app/api/azure-voices/route",
    "../../app/api/transcription/route",
    "../../app/api/parse-pdf/route",
    "../../lib/server/provider-config",
    "../../lib/web-search/tavily",
    "../../lib/media/image-providers",
    "../../lib/media/video-providers",
    "../../lib/audio/tts-providers",
    "../../lib/audio/asr-providers",
    "../../lib/pdf/pdf-providers",
    "../../lib/logger",
  ];

  for (const target of targets) {
    clearModule(target);
  }
}

function setMockModule(modulePath: string, exportsValue: Record<string, unknown>) {
  const resolved = require.resolve(modulePath);
  require.cache[resolved] = {
    id: resolved,
    filename: resolved,
    loaded: true,
    exports: exportsValue,
    children: [],
    path: path.dirname(resolved),
    paths: [],
  } as unknown as NodeModule;
}

function mockLogger() {
  setMockModule("../../lib/logger", {
    createLogger: () => ({
      error: () => {},
      info: () => {},
      warn: () => {},
    }),
  });
}

function createJsonRequest(pathname: string, body: unknown) {
  return new Request(`https://demo.test${pathname}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function createHeaderRequest(pathname: string, headers: Record<string, string>) {
  return new Request(`https://demo.test${pathname}`, {
    method: "POST",
    headers,
  });
}

function createParsePdfRequest(formData: FormData) {
  return new Request("https://demo.test/api/parse-pdf", {
    method: "POST",
    body: formData,
  });
}

function createTranscriptionRequest(formData: FormData) {
  return new Request("https://demo.test/api/transcription", {
    method: "POST",
    body: formData,
  });
}

function loadWebSearchRoute(options?: { allowClientSecrets?: boolean; managedApiKey?: string }) {
  resetModules();
  mockLogger();

  const searchCalls: Array<{ query: string; apiKey: string }> = [];

  setMockModule("../../lib/server/provider-config", {
    getBlockedClientProviderSecretMessage: () => "Client provider secrets are disabled.",
    hasClientProviderSecretOverride: ({ apiKey, baseUrl }: { apiKey?: string; baseUrl?: string }) =>
      Boolean(apiKey || baseUrl),
    resolveWebSearchApiKey: (clientApiKey?: string) => clientApiKey || options?.managedApiKey || "server-tavily-key",
    shouldAllowClientProviderSecrets: () => options?.allowClientSecrets ?? false,
  });

  setMockModule("../../lib/web-search/tavily", {
    formatSearchResultsAsContext: () => "formatted context",
    searchWithTavily: async ({ query, apiKey }: { query: string; apiKey: string }) => {
      searchCalls.push({ query, apiKey });
      return {
        answer: "Found relevant results",
        query,
        responseTime: 12,
        sources: [{ title: "Example", url: "https://example.com" }],
      };
    },
  });

  const route = withAliasResolution(
    () => require("../../app/api/web-search/route") as WebSearchRouteModule & RouteModule,
  );
  return { route, searchCalls };
}

function loadVerifyImageProviderRoute(options?: {
  allowClientSecrets?: boolean;
  managedApiKey?: string;
  managedBaseUrl?: string;
}) {
  resetModules();
  mockLogger();

  const connectivityCalls: Array<Record<string, unknown>> = [];

  setMockModule("../../lib/server/provider-config", {
    getBlockedClientProviderSecretMessage: () => "Client provider secrets are disabled.",
    hasClientProviderSecretOverride: ({ apiKey, baseUrl }: { apiKey?: string; baseUrl?: string }) =>
      Boolean(apiKey || baseUrl),
    resolveImageApiKey: (_providerId: string, clientApiKey?: string) =>
      clientApiKey || options?.managedApiKey || "server-image-key",
    resolveImageBaseUrl: (_providerId: string, clientBaseUrl?: string) =>
      clientBaseUrl || options?.managedBaseUrl || "https://managed-image.example.com",
    shouldAllowClientProviderSecrets: () => options?.allowClientSecrets ?? false,
  });

  setMockModule("../../lib/media/image-providers", {
    testImageConnectivity: async (config: Record<string, unknown>) => {
      connectivityCalls.push(config);
      return { success: true, message: "Image provider is ready" };
    },
  });

  const route = withAliasResolution(
    () => require("../../app/api/verify-image-provider/route") as VerifyImageProviderRouteModule & RouteModule,
  );
  return { route, connectivityCalls };
}

function loadVerifyVideoProviderRoute(options?: {
  allowClientSecrets?: boolean;
  managedApiKey?: string;
  managedBaseUrl?: string;
}) {
  resetModules();
  mockLogger();

  const connectivityCalls: Array<Record<string, unknown>> = [];

  setMockModule("../../lib/server/provider-config", {
    getBlockedClientProviderSecretMessage: () => "Client provider secrets are disabled.",
    hasClientProviderSecretOverride: ({ apiKey, baseUrl }: { apiKey?: string; baseUrl?: string }) =>
      Boolean(apiKey || baseUrl),
    resolveVideoApiKey: (_providerId: string, clientApiKey?: string) =>
      clientApiKey || options?.managedApiKey || "server-video-key",
    resolveVideoBaseUrl: (_providerId: string, clientBaseUrl?: string) =>
      clientBaseUrl || options?.managedBaseUrl || "https://managed-video.example.com",
    shouldAllowClientProviderSecrets: () => options?.allowClientSecrets ?? false,
  });

  setMockModule("../../lib/media/video-providers", {
    testVideoConnectivity: async (config: Record<string, unknown>) => {
      connectivityCalls.push(config);
      return { success: true, message: "Video provider is ready" };
    },
  });

  const route = withAliasResolution(
    () => require("../../app/api/verify-video-provider/route") as VerifyVideoProviderRouteModule & RouteModule,
  );
  return { route, connectivityCalls };
}

function loadTtsRoute(options?: {
  allowClientSecrets?: boolean;
  managedApiKey?: string;
  managedBaseUrl?: string;
}) {
  resetModules();
  mockLogger();

  const generationCalls: Array<{ config: Record<string, unknown>; text: string }> = [];

  setMockModule("../../lib/server/provider-config", {
    getBlockedClientProviderSecretMessage: () => "Client provider secrets are disabled.",
    hasClientProviderSecretOverride: ({ apiKey, baseUrl }: { apiKey?: string; baseUrl?: string }) =>
      Boolean(apiKey || baseUrl),
    resolveTTSApiKey: (_providerId: string, clientApiKey?: string) =>
      clientApiKey || options?.managedApiKey || "server-tts-key",
    resolveTTSBaseUrl: (_providerId: string, clientBaseUrl?: string) =>
      clientBaseUrl || options?.managedBaseUrl || "https://managed-tts.example.com",
    shouldAllowClientProviderSecrets: () => options?.allowClientSecrets ?? false,
  });

  setMockModule("../../lib/audio/tts-providers", {
    generateTTS: async (config: Record<string, unknown>, text: string) => {
      generationCalls.push({ config, text });
      return { audio: Buffer.from("hello"), format: "mp3" };
    },
  });

  const route = withAliasResolution(
    () => require("../../app/api/generate/tts/route") as TtsRouteModule & RouteModule,
  );
  return { route, generationCalls };
}

function loadParsePdfRoute(options?: {
  allowClientSecrets?: boolean;
  managedApiKey?: string;
  managedBaseUrl?: string;
}) {
  resetModules();
  mockLogger();

  const parseCalls: Array<{ config: Record<string, unknown>; buffer: Buffer }> = [];

  setMockModule("../../lib/server/provider-config", {
    getBlockedClientProviderSecretMessage: () => "Client provider secrets are disabled.",
    hasClientProviderSecretOverride: ({ apiKey, baseUrl }: { apiKey?: string; baseUrl?: string }) =>
      Boolean(apiKey || baseUrl),
    resolvePDFApiKey: (_providerId: string, clientApiKey?: string) =>
      clientApiKey || options?.managedApiKey || "server-pdf-key",
    resolvePDFBaseUrl: (_providerId: string, clientBaseUrl?: string) =>
      clientBaseUrl || options?.managedBaseUrl || "https://managed-pdf.example.com",
    shouldAllowClientProviderSecrets: () => options?.allowClientSecrets ?? false,
  });

  setMockModule("../../lib/pdf/pdf-providers", {
    parsePDF: async (config: Record<string, unknown>, buffer: Buffer) => {
      parseCalls.push({ config, buffer });
      return {
        text: "提取到的讲义内容",
        pages: [{ pageNumber: 1, text: "第一页" }],
        metadata: { pageCount: 1 },
      };
    },
  });

  const route = withAliasResolution(
    () => require("../../app/api/parse-pdf/route") as ParsePdfRouteModule & RouteModule,
  );
  return { route, parseCalls };
}

function loadTranscriptionRoute(options?: {
  allowClientSecrets?: boolean;
  managedApiKey?: string;
  managedBaseUrl?: string;
}) {
  resetModules();
  mockLogger();

  const transcriptionCalls: Array<{ config: Record<string, unknown>; buffer: Buffer }> = [];

  setMockModule("../../lib/server/provider-config", {
    getBlockedClientProviderSecretMessage: () => "Client provider secrets are disabled.",
    hasClientProviderSecretOverride: ({ apiKey, baseUrl }: { apiKey?: string; baseUrl?: string }) =>
      Boolean(apiKey || baseUrl),
    resolveASRApiKey: (_providerId: string, clientApiKey?: string) =>
      clientApiKey || options?.managedApiKey || "server-asr-key",
    resolveASRBaseUrl: (_providerId: string, clientBaseUrl?: string) =>
      clientBaseUrl || options?.managedBaseUrl || "https://managed-asr.example.com",
    shouldAllowClientProviderSecrets: () => options?.allowClientSecrets ?? false,
  });

  setMockModule("../../lib/audio/asr-providers", {
    transcribeAudio: async (config: Record<string, unknown>, buffer: Buffer) => {
      transcriptionCalls.push({ config, buffer });
      return { text: "识别出的语音文本" };
    },
  });

  const route = withAliasResolution(
    () => require("../../app/api/transcription/route") as TranscriptionRouteModule & RouteModule,
  );
  return { route, transcriptionCalls };
}

function loadAzureVoicesRoute(options?: {
  allowClientSecrets?: boolean;
  managedApiKey?: string;
  managedBaseUrl?: string;
}) {
  resetModules();
  mockLogger();

  const fetchCalls: Array<{ input: string; init?: RequestInit }> = [];

  setMockModule("../../lib/server/provider-config", {
    getBlockedClientProviderSecretMessage: () => "Client provider secrets are disabled.",
    hasClientProviderSecretOverride: ({ apiKey, baseUrl }: { apiKey?: string; baseUrl?: string }) =>
      Boolean(apiKey || baseUrl),
    resolveTTSApiKey: (_providerId: string, clientApiKey?: string) =>
      clientApiKey || options?.managedApiKey || "server-azure-key",
    resolveTTSBaseUrl: (_providerId: string, clientBaseUrl?: string) =>
      clientBaseUrl || options?.managedBaseUrl || "https://managed-azure.example.com",
    shouldAllowClientProviderSecrets: () => options?.allowClientSecrets ?? false,
  });

  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    fetchCalls.push({ input: String(input), init });
    return new Response(JSON.stringify([{ ShortName: "zh-CN-XiaoxiaoNeural" }]), {
      status: 200,
      headers: {
        "content-type": "application/json",
      },
    });
  }) as typeof fetch;

  const route = withAliasResolution(
    () => require("../../app/api/azure-voices/route") as AzureVoicesRouteModule & RouteModule,
  );
  return { route, fetchCalls };
}

afterEach(() => {
  resetModules();
  globalThis.fetch = originalFetch;
});

test("web search route blocks browser-provided api keys by default", async () => {
  const { route, searchCalls } = loadWebSearchRoute();

  assert.ok(route.POST);
  const response = await route.POST(
    createJsonRequest("/api/web-search", {
      query: "photosynthesis",
      apiKey: "client-tavily-key",
    }),
  );

  assert.equal(response.status, 403);
  assert.equal(searchCalls.length, 0);

  const payload = (await response.json()) as { error?: string; errorCode?: string };
  assert.equal(payload.errorCode, "INVALID_REQUEST");
  assert.match(payload.error ?? "", /disabled/i);
});

test("web search route falls back to the server-managed api key when no client override is sent", async () => {
  const { route, searchCalls } = loadWebSearchRoute({ managedApiKey: "vault-tavily-key" });

  assert.ok(route.POST);
  const response = await route.POST(
    createJsonRequest("/api/web-search", {
      query: "classroom engagement",
    }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(searchCalls, [
    {
      query: "classroom engagement",
      apiKey: "vault-tavily-key",
    },
  ]);

  const payload = (await response.json()) as { success?: boolean; context?: string };
  assert.equal(payload.success, true);
  assert.equal(payload.context, "formatted context");
});

test("verify image provider route blocks browser-provided credentials by default", async () => {
  const { route, connectivityCalls } = loadVerifyImageProviderRoute();

  assert.ok(route.POST);
  const response = await route.POST(
    createHeaderRequest("/api/verify-image-provider", {
      "x-image-provider": "seedream",
      "x-api-key": "client-image-key",
      "x-base-url": "https://client-image.example.com",
    }),
  );

  assert.equal(response.status, 403);
  assert.equal(connectivityCalls.length, 0);

  const payload = (await response.json()) as { error?: string; errorCode?: string };
  assert.equal(payload.errorCode, "INVALID_REQUEST");
  assert.match(payload.error ?? "", /disabled/i);
});

test("verify image provider route uses server-managed credentials when no client override is present", async () => {
  const { route, connectivityCalls } = loadVerifyImageProviderRoute({
    managedApiKey: "vault-image-key",
    managedBaseUrl: "https://vault-image.example.com",
  });

  assert.ok(route.POST);
  const response = await route.POST(
    createHeaderRequest("/api/verify-image-provider", {
      "x-image-provider": "seedream",
      "x-image-model": "seedream-v1",
    }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(connectivityCalls, [
    {
      providerId: "seedream",
      apiKey: "vault-image-key",
      baseUrl: "https://vault-image.example.com",
      model: "seedream-v1",
    },
  ]);

  const payload = (await response.json()) as { success?: boolean; message?: string };
  assert.equal(payload.success, true);
  assert.equal(payload.message, "Image provider is ready");
});

test("verify video provider route blocks browser-provided credentials by default", async () => {
  const { route, connectivityCalls } = loadVerifyVideoProviderRoute();

  assert.ok(route.POST);
  const response = await route.POST(
    createHeaderRequest("/api/verify-video-provider", {
      "x-video-provider": "seedance",
      "x-api-key": "client-video-key",
      "x-base-url": "https://client-video.example.com",
    }),
  );

  assert.equal(response.status, 403);
  assert.equal(connectivityCalls.length, 0);

  const payload = (await response.json()) as { error?: string; errorCode?: string };
  assert.equal(payload.errorCode, "INVALID_REQUEST");
  assert.match(payload.error ?? "", /disabled/i);
});

test("verify video provider route uses server-managed credentials when no client override is present", async () => {
  const { route, connectivityCalls } = loadVerifyVideoProviderRoute({
    managedApiKey: "vault-video-key",
    managedBaseUrl: "https://vault-video.example.com",
  });

  assert.ok(route.POST);
  const response = await route.POST(
    createHeaderRequest("/api/verify-video-provider", {
      "x-video-provider": "seedance",
      "x-video-model": "seedance-v1",
    }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(connectivityCalls, [
    {
      providerId: "seedance",
      apiKey: "vault-video-key",
      baseUrl: "https://vault-video.example.com",
      model: "seedance-v1",
    },
  ]);

  const payload = (await response.json()) as { success?: boolean; message?: string };
  assert.equal(payload.success, true);
  assert.equal(payload.message, "Video provider is ready");
});

test("tts route blocks browser-provided credentials by default", async () => {
  const { route, generationCalls } = loadTtsRoute();

  assert.ok(route.POST);
  const response = await route.POST(
    createJsonRequest("/api/generate/tts", {
      text: "你好，开始上课。",
      audioId: "audio-1",
      ttsProviderId: "openai",
      ttsVoice: "alloy",
      ttsApiKey: "client-tts-key",
      ttsBaseUrl: "https://client-tts.example.com",
    }),
  );

  assert.equal(response.status, 403);
  assert.equal(generationCalls.length, 0);

  const payload = (await response.json()) as { error?: string; errorCode?: string };
  assert.equal(payload.errorCode, "INVALID_REQUEST");
  assert.match(payload.error ?? "", /disabled/i);
});

test("tts route uses server-managed credentials when no client override is present", async () => {
  const { route, generationCalls } = loadTtsRoute({
    managedApiKey: "vault-tts-key",
    managedBaseUrl: "https://vault-tts.example.com",
  });

  assert.ok(route.POST);
  const response = await route.POST(
    createJsonRequest("/api/generate/tts", {
      text: "请跟我一起朗读。",
      audioId: "audio-2",
      ttsProviderId: "openai",
      ttsVoice: "alloy",
      ttsSpeed: 1.2,
    }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(generationCalls, [
    {
      config: {
        providerId: "openai",
        voice: "alloy",
        speed: 1.2,
        apiKey: "vault-tts-key",
        baseUrl: "https://vault-tts.example.com",
      },
      text: "请跟我一起朗读。",
    },
  ]);

  const payload = (await response.json()) as {
    success?: boolean;
    audioId?: string;
    base64?: string;
    format?: string;
  };
  assert.equal(payload.success, true);
  assert.equal(payload.audioId, "audio-2");
  assert.equal(payload.base64, Buffer.from("hello").toString("base64"));
  assert.equal(payload.format, "mp3");
});

test("parse pdf route blocks browser-provided credentials by default", async () => {
  const { route, parseCalls } = loadParsePdfRoute();
  const formData = new FormData();
  formData.set("pdf", new File([Buffer.from("%PDF-1.4")], "lesson.pdf", { type: "application/pdf" }));
  formData.set("providerId", "unpdf");
  formData.set("apiKey", "client-pdf-key");
  formData.set("baseUrl", "https://client-pdf.example.com");

  assert.ok(route.POST);
  const response = await route.POST(createParsePdfRequest(formData));

  assert.equal(response.status, 403);
  assert.equal(parseCalls.length, 0);

  const payload = (await response.json()) as { error?: string; errorCode?: string };
  assert.equal(payload.errorCode, "INVALID_REQUEST");
  assert.match(payload.error ?? "", /disabled/i);
});

test("parse pdf route uses server-managed credentials when no client override is present", async () => {
  const { route, parseCalls } = loadParsePdfRoute({
    managedApiKey: "vault-pdf-key",
    managedBaseUrl: "https://vault-pdf.example.com",
  });
  const formData = new FormData();
  formData.set("pdf", new File([Buffer.from("%PDF-1.4")], "lesson.pdf", { type: "application/pdf" }));
  formData.set("providerId", "unpdf");

  assert.ok(route.POST);
  const response = await route.POST(createParsePdfRequest(formData));

  assert.equal(response.status, 200);
  assert.equal(parseCalls.length, 1);
  assert.deepEqual(parseCalls[0]?.config, {
    providerId: "unpdf",
    apiKey: "vault-pdf-key",
    baseUrl: "https://vault-pdf.example.com",
  });
  assert.equal(parseCalls[0]?.buffer.toString("utf8"), "%PDF-1.4");

  const payload = (await response.json()) as {
    success?: boolean;
    data?: {
      text?: string;
      metadata?: { pageCount?: number; fileName?: string; fileSize?: number };
    };
  };
  assert.equal(payload.success, true);
  assert.equal(payload.data?.text, "提取到的讲义内容");
  assert.equal(payload.data?.metadata?.pageCount, 1);
  assert.equal(payload.data?.metadata?.fileName, "lesson.pdf");
  assert.equal(payload.data?.metadata?.fileSize, Buffer.from("%PDF-1.4").byteLength);
});

test("transcription route blocks browser-provided credentials by default", async () => {
  const { route, transcriptionCalls } = loadTranscriptionRoute();
  const formData = new FormData();
  formData.set("audio", new File([Buffer.from("voice-bytes")], "sample.wav", { type: "audio/wav" }));
  formData.set("providerId", "openai-whisper");
  formData.set("language", "zh");
  formData.set("apiKey", "client-asr-key");
  formData.set("baseUrl", "https://client-asr.example.com");

  assert.ok(route.POST);
  const response = await route.POST(createTranscriptionRequest(formData));

  assert.equal(response.status, 403);
  assert.equal(transcriptionCalls.length, 0);

  const payload = (await response.json()) as { error?: string; errorCode?: string };
  assert.equal(payload.errorCode, "INVALID_REQUEST");
  assert.match(payload.error ?? "", /disabled/i);
});

test("transcription route uses server-managed credentials when no client override is present", async () => {
  const { route, transcriptionCalls } = loadTranscriptionRoute({
    managedApiKey: "vault-asr-key",
    managedBaseUrl: "https://vault-asr.example.com",
  });
  const formData = new FormData();
  formData.set("audio", new File([Buffer.from("voice-bytes")], "sample.wav", { type: "audio/wav" }));
  formData.set("providerId", "openai-whisper");
  formData.set("language", "zh");

  assert.ok(route.POST);
  const response = await route.POST(createTranscriptionRequest(formData));

  assert.equal(response.status, 200);
  assert.equal(transcriptionCalls.length, 1);
  assert.deepEqual(transcriptionCalls[0]?.config, {
    providerId: "openai-whisper",
    language: "zh",
    apiKey: "vault-asr-key",
    baseUrl: "https://vault-asr.example.com",
  });
  assert.equal(transcriptionCalls[0]?.buffer.toString("utf8"), "voice-bytes");

  const payload = (await response.json()) as { success?: boolean; text?: string };
  assert.equal(payload.success, true);
  assert.equal(payload.text, "识别出的语音文本");
});

test("azure voices route blocks browser-provided credentials by default", async () => {
  const { route, fetchCalls } = loadAzureVoicesRoute();

  assert.ok(route.POST);
  const response = await route.POST(
    createJsonRequest("/api/azure-voices", {
      apiKey: "client-azure-key",
      baseUrl: "https://client-azure.example.com",
    }),
  );

  assert.equal(response.status, 403);
  assert.equal(fetchCalls.length, 0);

  const payload = (await response.json()) as { error?: string; errorCode?: string };
  assert.equal(payload.errorCode, "INVALID_REQUEST");
  assert.match(payload.error ?? "", /disabled/i);
});

test("azure voices route uses server-managed credentials when no client override is present", async () => {
  const { route, fetchCalls } = loadAzureVoicesRoute({
    managedApiKey: "vault-azure-key",
    managedBaseUrl: "https://vault-azure.example.com",
  });

  assert.ok(route.POST);
  const response = await route.POST(createJsonRequest("/api/azure-voices", {}));

  assert.equal(response.status, 200);
  assert.deepEqual(fetchCalls, [
    {
      input: "https://vault-azure.example.com/cognitiveservices/voices/list",
      init: {
        method: "GET",
        headers: {
          "Ocp-Apim-Subscription-Key": "vault-azure-key",
        },
        redirect: "manual",
      },
    },
  ]);

  const payload = (await response.json()) as {
    success?: boolean;
    voices?: Array<{ ShortName?: string }>;
  };
  assert.equal(payload.success, true);
  assert.equal(payload.voices?.[0]?.ShortName, "zh-CN-XiaoxiaoNeural");
});

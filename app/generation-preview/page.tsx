'use client';

import { useEffect, useState, Suspense, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, Sparkles, AlertCircle, AlertTriangle, ArrowLeft, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ClassroomBrand } from '@/components/brand/classroom-brand';
import { cn } from '@/lib/utils';
import { useStageStore } from '@/lib/store/stage';
import { useSettingsStore } from '@/lib/store/settings';
import { useAgentRegistry } from '@/lib/orchestration/registry/store';
import { useI18n } from '@/lib/hooks/use-i18n';
import {
  loadImageMapping,
  loadPdfBlob,
  cleanupOldImages,
  storeImages,
} from '@/lib/utils/image-storage';
import { getCurrentModelConfig } from '@/lib/utils/model-config';
import { db } from '@/lib/utils/database';
import { MAX_PDF_CONTENT_CHARS, MAX_VISION_IMAGES } from '@/lib/constants/generation';
import { nanoid } from 'nanoid';
import type { Stage } from '@/lib/types/stage';
import type { SceneOutline, PdfImage, ImageMapping } from '@/lib/types/generation';
import { AgentRevealModal } from '@/components/agent/agent-reveal-modal';
import { createLogger } from '@/lib/logger';
import {
  buildAudienceModeLabel,
  buildClassroomAgents,
  buildLearningModeLabel,
  buildStageClassroomMeta,
  resolveTeacherVoice,
} from '@/lib/classroom-integration';
import { persistClassroomSnapshot } from '@/lib/classroom-persistence-client';
import { SUBJECT_LABELS } from '@/lib/constants';
import { type GenerationSessionState, ALL_STEPS, getActiveSteps } from './types';
import { StepVisualizer } from './components/visualizers';
import {
  classroomHeroPanel,
  classroomInsetPanel,
  classroomOutlineButton,
  classroomPanel,
  classroomSectionPanel,
  classroomSoftButton,
  classroomToneCard,
  classroomTonePill,
} from '@/lib/ui/classroom-theme';

const log = createLogger('GenerationPreview');

type GenerationErrorView = {
  headline: string;
  summary: string;
  suggestion: string;
  recoveryTitle: string;
  primaryActionLabel: string;
  detail: string;
};

function buildGenerationErrorView(error: string | null): GenerationErrorView | null {
  const detail = error?.trim();
  if (!detail) return null;

  const normalized = detail.toLowerCase();

  if (
    normalized.includes('[runtime-guardrails]') ||
    normalized.includes('database_url is required') ||
    normalized.includes('object_storage_root')
  ) {
    return {
      headline: '课堂引擎还在准备环境',
      summary: '当前部署还没有完成课堂运行配置，这节互动课堂暂时不能继续编排。',
      suggestion: '先补齐数据库与对象存储等运行配置，再重新发起这节课的生成。',
      recoveryTitle: '先检查运行环境',
      primaryActionLabel: '返回首页稍后重试',
      detail,
    };
  }

  if (
    normalized.includes('api key') ||
    normalized.includes('server-providers') ||
    normalized.includes('set the appropriate key')
  ) {
    return {
      headline: '课堂模型还没有配置完成',
      summary: '当前环境缺少模型或媒体服务配置，课堂内容和数字人暂时无法继续生成。',
      suggestion: '请先在管理端补齐模型与媒体服务配置，再重新发起课堂。',
      recoveryTitle: '先补齐模型配置',
      primaryActionLabel: '返回首页检查配置',
      detail,
    };
  }

  if (
    normalized.includes('service temporarily unavailable') ||
    normalized.includes('failed to fetch') ||
    normalized.includes('networkerror') ||
    normalized.includes('fetch failed')
  ) {
    return {
      headline: '课堂服务暂时不可用',
      summary: '生成服务刚刚没有响应，这次课堂编排被中断了。',
      suggestion: '稍等片刻后重新发起即可，原来的主题和目标可以继续沿用。',
      recoveryTitle: '稍后重新发起',
      primaryActionLabel: '返回首页后重试',
      detail,
    };
  }

  if (normalized.includes('语音合成失败') || normalized.includes('speech generation failed')) {
    return {
      headline: '数字人语音还没有准备好',
      summary: '课堂主线已经基本就绪，但数字人语音环节这次没有顺利生成。',
      suggestion: '可以稍后重试，或先检查语音服务配置后再重新生成课堂。',
      recoveryTitle: '先检查语音服务',
      primaryActionLabel: '返回首页重新发起',
      detail,
    };
  }

  if (normalized.includes('大纲生成失败') || normalized.includes('outline')) {
    return {
      headline: '课堂主线暂时没有编排完成',
      summary: 'AI 在组织这节课的大纲时中断了，所以还没法进入正式课堂。',
      suggestion: '建议保留当前主题与目标，稍后重新发起一次课堂生成。',
      recoveryTitle: '重新组织课堂主线',
      primaryActionLabel: '返回首页重新发起',
      detail,
    };
  }

  if (
    normalized.includes('场景生成失败') ||
    normalized.includes('scene generation failed') ||
    normalized.includes('request failed')
  ) {
    return {
      headline: '课堂内容正在重新整理',
      summary: '课堂已经进入内容生成阶段，但这一步暂时没有顺利完成。',
      suggestion: '重新发起后系统会继续沿用这次的课堂主题与结构，不需要重新整理思路。',
      recoveryTitle: '重新生成课堂内容',
      primaryActionLabel: '返回首页重新发起',
      detail,
    };
  }

  return {
    headline: '这节互动课堂暂时没有生成完成',
    summary: '课堂编排在中途被打断了，还没有进入可播放状态。',
    suggestion: '请返回首页重新发起；如果问题持续出现，再检查模型、素材和服务配置。',
    recoveryTitle: '返回首页重新发起',
    primaryActionLabel: '返回首页重新发起',
    detail,
  };
}

function GenerationPreviewContent() {
  const router = useRouter();
  const { t } = useI18n();
  const hasStartedRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const [session, setSession] = useState<GenerationSessionState | null>(null);
  const [mounted, setMounted] = useState(false);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [streamingOutlines, setStreamingOutlines] = useState<SceneOutline[] | null>(null);
  const [truncationWarnings, setTruncationWarnings] = useState<string[]>([]);
  const [webSearchSources, setWebSearchSources] = useState<Array<{ title: string; url: string }>>(
    [],
  );
  const [showAgentReveal, setShowAgentReveal] = useState(false);
  const [showRouteDetails, setShowRouteDetails] = useState(false);
  const [generatedAgents, setGeneratedAgents] = useState<
    Array<{
      id: string;
      name: string;
      role: string;
      persona: string;
      avatar: string;
      color: string;
      priority: number;
    }>
  >([]);
  const agentRevealResolveRef = useRef<(() => void) | null>(null);

  // Compute active steps based on session state
  const activeSteps = getActiveSteps(session);

  // Load session from sessionStorage
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    cleanupOldImages(24).catch((e) => log.error(e));

    const saved = sessionStorage.getItem('generationSession');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as GenerationSessionState;
        setSession(parsed);
      } catch (e) {
        log.error('Failed to parse generation session:', e);
      }
    }
    setSessionLoaded(true);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-classroom-focus', 'true');

    return () => {
      root.removeAttribute('data-classroom-focus');
    };
  }, []);

  useEffect(() => {
    if (error) {
      setShowRouteDetails(true);
    }
  }, [error]);

  // Abort all in-flight requests on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  // Get API credentials from localStorage
  const getApiHeaders = () => {
    const modelConfig = getCurrentModelConfig();
    const settings = useSettingsStore.getState();
    return {
      'Content-Type': 'application/json',
      'x-model': modelConfig.modelString,
      'x-provider-type': modelConfig.providerType || '',
      'x-requires-api-key': modelConfig.requiresApiKey ? 'true' : 'false',
      // Image generation provider
      'x-image-provider': settings.imageProviderId || '',
      'x-image-model': settings.imageModelId || '',
      // Video generation provider
      'x-video-provider': settings.videoProviderId || '',
      'x-video-model': settings.videoModelId || '',
      // Media generation toggles
      'x-image-generation-enabled': String(settings.imageGenerationEnabled ?? false),
      'x-video-generation-enabled': String(settings.videoGenerationEnabled ?? false),
    };
  };

  // Auto-start generation when session is loaded
  useEffect(() => {
    if (session && !hasStartedRef.current) {
      hasStartedRef.current = true;
      startGeneration();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  // Main generation flow
  const startGeneration = async () => {
    if (!session) return;

    // Create AbortController for this generation run
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const signal = controller.signal;

    // Use a local mutable copy so we can update it after PDF parsing
    let currentSession = session;

    setError(null);
    setCurrentStepIndex(0);

    try {
      // Compute active steps for this session (recomputed after session mutations)
      let activeSteps = getActiveSteps(currentSession);

      // Determine if we need the PDF analysis step
      const hasPdfToAnalyze = !!currentSession.pdfStorageKey && !currentSession.pdfText;
      // If no PDF to analyze, skip to the next available step
      if (!hasPdfToAnalyze) {
        const firstNonPdfIdx = activeSteps.findIndex((s) => s.id !== 'pdf-analysis');
        setCurrentStepIndex(Math.max(0, firstNonPdfIdx));
      }

      // Step 0: Parse PDF if needed
      if (hasPdfToAnalyze) {
        log.debug('=== Generation Preview: Parsing PDF ===');
        const pdfBlob = await loadPdfBlob(currentSession.pdfStorageKey!);
        if (!pdfBlob) {
          throw new Error(t('generation.pdfLoadFailed'));
        }

        // Ensure pdfBlob is a valid Blob with content
        if (!(pdfBlob instanceof Blob) || pdfBlob.size === 0) {
          log.error('Invalid PDF blob:', {
            type: typeof pdfBlob,
            size: pdfBlob instanceof Blob ? pdfBlob.size : 'N/A',
          });
          throw new Error(t('generation.pdfLoadFailed'));
        }

        // Wrap as a File to guarantee multipart/form-data with correct content-type
        const pdfFile = new File([pdfBlob], currentSession.pdfFileName || 'document.pdf', {
          type: 'application/pdf',
        });

        const parseFormData = new FormData();
        parseFormData.append('pdf', pdfFile);

        if (currentSession.pdfProviderId) {
          parseFormData.append('providerId', currentSession.pdfProviderId);
        }

        const parseResponse = await fetch('/api/parse-pdf', {
          method: 'POST',
          body: parseFormData,
          signal,
        });

        if (!parseResponse.ok) {
          const errorData = await parseResponse.json();
          throw new Error(errorData.error || t('generation.pdfParseFailed'));
        }

        const parseResult = await parseResponse.json();
        if (!parseResult.success || !parseResult.data) {
          throw new Error(t('generation.pdfParseFailed'));
        }

        let pdfText = parseResult.data.text as string;

        // Truncate if needed
        if (pdfText.length > MAX_PDF_CONTENT_CHARS) {
          pdfText = pdfText.substring(0, MAX_PDF_CONTENT_CHARS);
        }

        // Create image metadata and store images
        // Prefer metadata.pdfImages (both parsers now return this)
        const rawPdfImages = parseResult.data.metadata?.pdfImages;
        const images = rawPdfImages
          ? rawPdfImages.map(
              (img: {
                id: string;
                src?: string;
                pageNumber?: number;
                description?: string;
                width?: number;
                height?: number;
              }) => ({
                id: img.id,
                src: img.src || '',
                pageNumber: img.pageNumber || 1,
                description: img.description,
                width: img.width,
                height: img.height,
              }),
            )
          : (parseResult.data.images as string[]).map((src: string, i: number) => ({
              id: `img_${i + 1}`,
              src,
              pageNumber: 1,
            }));

        const imageStorageIds = await storeImages(images);

        const pdfImages: PdfImage[] = images.map(
          (
            img: {
              id: string;
              src: string;
              pageNumber: number;
              description?: string;
              width?: number;
              height?: number;
            },
            i: number,
          ) => ({
            id: img.id,
            src: '',
            pageNumber: img.pageNumber,
            description: img.description,
            width: img.width,
            height: img.height,
            storageId: imageStorageIds[i],
          }),
        );

        // Update session with parsed PDF data
        const updatedSession = {
          ...currentSession,
          pdfText,
          pdfImages,
          imageStorageIds,
          pdfStorageKey: undefined, // Clear so we don't re-parse
        };
        setSession(updatedSession);
        sessionStorage.setItem('generationSession', JSON.stringify(updatedSession));

        // Truncation warnings
        const warnings: string[] = [];
        if ((parseResult.data.text as string).length > MAX_PDF_CONTENT_CHARS) {
          warnings.push(
            t('generation.textTruncated').replace('{n}', String(MAX_PDF_CONTENT_CHARS)),
          );
        }
        if (images.length > MAX_VISION_IMAGES) {
          warnings.push(
            t('generation.imageTruncated')
              .replace('{total}', String(images.length))
              .replace('{max}', String(MAX_VISION_IMAGES)),
          );
        }
        if (warnings.length > 0) {
          setTruncationWarnings(warnings);
        }

        // Reassign local reference for subsequent steps
        currentSession = updatedSession;
        activeSteps = getActiveSteps(currentSession);
      }

      // Step: Web Search (if enabled)
      const webSearchStepIdx = activeSteps.findIndex((s) => s.id === 'web-search');
      if (currentSession.requirements.webSearch && webSearchStepIdx >= 0) {
        setCurrentStepIndex(webSearchStepIdx);
        setWebSearchSources([]);

        const res = await fetch('/api/web-search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: currentSession.requirements.requirement,
          }),
          signal,
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({ error: 'Web search failed' }));
          throw new Error(data.error || t('generation.webSearchFailed'));
        }

        const searchData = await res.json();
        const sources = (searchData.sources || []).map((s: { title: string; url: string }) => ({
          title: s.title,
          url: s.url,
        }));
        setWebSearchSources(sources);

        const updatedSessionWithSearch = {
          ...currentSession,
          researchContext: searchData.context || '',
          researchSources: sources,
        };
        setSession(updatedSessionWithSearch);
        sessionStorage.setItem('generationSession', JSON.stringify(updatedSessionWithSearch));
        currentSession = updatedSessionWithSearch;
        activeSteps = getActiveSteps(currentSession);
      }

      // Load imageMapping early (needed for both outline and scene generation)
      let imageMapping: ImageMapping = {};
      if (currentSession.imageStorageIds && currentSession.imageStorageIds.length > 0) {
        log.debug('Loading images from IndexedDB');
        imageMapping = await loadImageMapping(currentSession.imageStorageIds);
      } else if (
        currentSession.imageMapping &&
        Object.keys(currentSession.imageMapping).length > 0
      ) {
        log.debug('Using imageMapping from session (old format)');
        imageMapping = currentSession.imageMapping;
      }

      // ── Agent generation (before outlines so persona can influence structure) ──
      const settings = useSettingsStore.getState();
      let agents: Array<{
        id: string;
        name: string;
        role: string;
        persona?: string;
      }> = [];

      // Create stage client-side (needed for agent generation stageId)
      const stageId = nanoid(10);
      const stage: Stage = {
        id: stageId,
        name: extractTopicFromRequirement(currentSession.requirements.requirement),
        description: currentSession.classroomContext?.className
          ? `${currentSession.classroomContext.className} · ${currentSession.classroomContext.subject ?? '互动课堂'}`
          : '',
        language: currentSession.requirements.language || 'zh-CN',
        style: 'professional',
        classroomMeta: buildStageClassroomMeta(currentSession.classroomContext),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      if (currentSession.classroomContext?.teacher || currentSession.classroomContext?.learner) {
        const roleBasedAgents = buildClassroomAgents(currentSession.classroomContext);
        const { saveGeneratedAgents } = await import('@/lib/orchestration/registry/store');
        const savedIds = await saveGeneratedAgents(stage.id, roleBasedAgents);
        settings.setSelectedAgentIds(savedIds);
        setGeneratedAgents(roleBasedAgents);

        agents = roleBasedAgents.map((agent) => ({
          id: agent.id,
          name: agent.name,
          role: agent.role,
          persona: agent.persona,
        }));
      } else if (settings.agentMode === 'auto') {
        const agentStepIdx = activeSteps.findIndex((s) => s.id === 'agent-generation');
        if (agentStepIdx >= 0) setCurrentStepIndex(agentStepIdx);

        try {
          const allAvatars = [
            '/avatars/hangke-mentor.svg',
            '/avatars/hangke-assistant.svg',
            '/avatars/hangke-explorer.svg',
            '/avatars/hangke-analyst.svg',
            '/avatars/hangke-builder.svg',
            '/avatars/hangke-reflector.svg',
            '/avatars/hangke-learner.svg',
          ];

          // No outlines yet — agent generation uses only stage name + description
          const agentResp = await fetch('/api/generate/agent-profiles', {
            method: 'POST',
            headers: getApiHeaders(),
            body: JSON.stringify({
              stageInfo: { name: stage.name, description: stage.description },
              language: currentSession.requirements.language || 'zh-CN',
              availableAvatars: allAvatars,
            }),
            signal,
          });

          if (!agentResp.ok) throw new Error('Agent generation failed');
          const agentData = await agentResp.json();
          if (!agentData.success) throw new Error(agentData.error || 'Agent generation failed');

          // Save to IndexedDB and registry
          const { saveGeneratedAgents } = await import('@/lib/orchestration/registry/store');
          const savedIds = await saveGeneratedAgents(stage.id, agentData.agents);
          settings.setSelectedAgentIds(savedIds);

          // Show card-reveal modal, continue generation once all cards are revealed
          setGeneratedAgents(agentData.agents);
          setShowAgentReveal(true);
          await new Promise<void>((resolve) => {
            agentRevealResolveRef.current = resolve;
          });

          agents = savedIds
            .map((id) => useAgentRegistry.getState().getAgent(id))
            .filter(Boolean)
            .map((a) => ({
              id: a!.id,
              name: a!.name,
              role: a!.role,
              persona: a!.persona,
            }));
        } catch (err: unknown) {
          log.warn('[Generation] Agent generation failed, falling back to presets:', err);
          const registry = useAgentRegistry.getState();
          agents = settings.selectedAgentIds
            .map((id) => registry.getAgent(id))
            .filter(Boolean)
            .map((a) => ({
              id: a!.id,
              name: a!.name,
              role: a!.role,
              persona: a!.persona,
            }));
        }
      } else {
        // Preset mode — use selected agents (include persona)
        const registry = useAgentRegistry.getState();
        agents = settings.selectedAgentIds
          .map((id) => registry.getAgent(id))
          .filter(Boolean)
          .map((a) => ({
            id: a!.id,
            name: a!.name,
            role: a!.role,
            persona: a!.persona,
          }));
      }

      // ── Generate outlines (with agent personas for teacher context) ──
      let outlines = currentSession.sceneOutlines;

      const outlineStepIdx = activeSteps.findIndex((s) => s.id === 'outline');
      setCurrentStepIndex(outlineStepIdx >= 0 ? outlineStepIdx : 0);
      if (!outlines || outlines.length === 0) {
        log.debug('=== Generating outlines (SSE) ===');
        setStreamingOutlines([]);

        outlines = await new Promise<SceneOutline[]>((resolve, reject) => {
          const collected: SceneOutline[] = [];

          fetch('/api/generate/scene-outlines-stream', {
            method: 'POST',
            headers: getApiHeaders(),
            body: JSON.stringify({
              requirements: currentSession.requirements,
              pdfText: currentSession.pdfText,
              pdfImages: currentSession.pdfImages,
              imageMapping,
              researchContext: currentSession.researchContext,
              agents,
            }),
            signal,
          })
            .then((res) => {
              if (!res.ok) {
                return res.json().then((d) => {
                  reject(new Error(d.error || t('generation.outlineGenerateFailed')));
                });
              }

              const reader = res.body?.getReader();
              if (!reader) {
                reject(new Error(t('generation.streamNotReadable')));
                return;
              }

              const decoder = new TextDecoder();
              let sseBuffer = '';

              const pump = (): Promise<void> =>
                reader.read().then(({ done, value }) => {
                  if (value) {
                    sseBuffer += decoder.decode(value, { stream: !done });
                    const lines = sseBuffer.split('\n');
                    sseBuffer = lines.pop() || '';

                    for (const line of lines) {
                      if (!line.startsWith('data: ')) continue;
                      try {
                        const evt = JSON.parse(line.slice(6));
                        if (evt.type === 'outline') {
                          collected.push(evt.data);
                          setStreamingOutlines([...collected]);
                        } else if (evt.type === 'retry') {
                          collected.length = 0;
                          setStreamingOutlines([]);
                          setStatusMessage(t('generation.outlineRetrying'));
                        } else if (evt.type === 'done') {
                          resolve(evt.outlines || collected);
                          return;
                        } else if (evt.type === 'error') {
                          reject(new Error(evt.error));
                          return;
                        }
                      } catch (e) {
                        log.error('Failed to parse outline SSE:', line, e);
                      }
                    }
                  }
                  if (done) {
                    if (collected.length > 0) {
                      resolve(collected);
                    } else {
                      reject(new Error(t('generation.outlineEmptyResponse')));
                    }
                    return;
                  }
                  return pump();
                });

              pump().catch(reject);
            })
            .catch(reject);
        });

        const updatedSession = { ...currentSession, sceneOutlines: outlines };
        setSession(updatedSession);
        sessionStorage.setItem('generationSession', JSON.stringify(updatedSession));

        // Outline generation succeeded — clear homepage draft cache
        try {
          localStorage.removeItem('requirementDraft');
        } catch {
          /* ignore */
        }

        // Brief pause to let user see the final outline state
        await new Promise((resolve) => setTimeout(resolve, 800));
      }

      // Move to scene generation step
      setStatusMessage('');
      if (!outlines || outlines.length === 0) {
        throw new Error(t('generation.outlineEmptyResponse'));
      }

      // Store stage and outlines
      const store = useStageStore.getState();
      store.setStage(stage);
      store.setOutlines(outlines);

      // Advance to slide-content step
      const contentStepIdx = activeSteps.findIndex((s) => s.id === 'slide-content');
      if (contentStepIdx >= 0) setCurrentStepIndex(contentStepIdx);

      // Build stageInfo and userProfile for API call
      const stageInfo = {
        name: stage.name,
        description: stage.description,
        language: stage.language,
        style: stage.style,
      };

      const userProfile =
        currentSession.requirements.userNickname || currentSession.requirements.userBio
          ? `Student: ${currentSession.requirements.userNickname || 'Unknown'}${currentSession.requirements.userBio ? ` — ${currentSession.requirements.userBio}` : ''}`
          : undefined;

      // Generate ONLY the first scene
      store.setGeneratingOutlines(outlines);

      const firstOutline = outlines[0];

      // Step 2: Generate content (currentStepIndex is already 2)
      const contentResp = await fetch('/api/generate/scene-content', {
        method: 'POST',
        headers: getApiHeaders(),
        body: JSON.stringify({
          outline: firstOutline,
          allOutlines: outlines,
          pdfImages: currentSession.pdfImages,
          imageMapping,
          stageInfo,
          stageId: stage.id,
          agents,
        }),
        signal,
      });

      if (!contentResp.ok) {
        const errorData = await contentResp.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(errorData.error || t('generation.sceneGenerateFailed'));
      }

      const contentData = await contentResp.json();
      if (!contentData.success || !contentData.content) {
        throw new Error(contentData.error || t('generation.sceneGenerateFailed'));
      }

      // Generate actions (activate actions step indicator)
      const actionsStepIdx = activeSteps.findIndex((s) => s.id === 'actions');
      setCurrentStepIndex(actionsStepIdx >= 0 ? actionsStepIdx : currentStepIndex + 1);

      const actionsResp = await fetch('/api/generate/scene-actions', {
        method: 'POST',
        headers: getApiHeaders(),
        body: JSON.stringify({
          outline: contentData.effectiveOutline || firstOutline,
          allOutlines: outlines,
          content: contentData.content,
          stageId: stage.id,
          agents,
          previousSpeeches: [],
          userProfile,
        }),
        signal,
      });

      if (!actionsResp.ok) {
        const errorData = await actionsResp.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(errorData.error || t('generation.sceneGenerateFailed'));
      }

      const data = await actionsResp.json();
      if (!data.success || !data.scene) {
        throw new Error(data.error || t('generation.sceneGenerateFailed'));
      }

      // Generate TTS for first scene (part of actions step — blocking)
      if (settings.ttsEnabled && settings.ttsProviderId !== 'browser-native-tts') {
        const teacherVoice = resolveTeacherVoice(currentSession.classroomContext);
        const effectiveTTSProviderId = teacherVoice.providerId || settings.ttsProviderId;
        const effectiveTTSVoice = teacherVoice.voiceId || settings.ttsVoice;
        const speechActions = (data.scene.actions || []).filter(
          (a: { type: string; text?: string }) => a.type === 'speech' && a.text,
        );

        let ttsFailCount = 0;
        for (const action of speechActions) {
          const audioId = `tts_${action.id}`;
          action.audioId = audioId;
          try {
            const resp = await fetch('/api/generate/tts', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                text: action.text,
                audioId,
                ttsProviderId: effectiveTTSProviderId,
                ttsVoice: effectiveTTSVoice,
                ttsSpeed: settings.ttsSpeed,
              }),
              signal,
            });
            if (!resp.ok) {
              ttsFailCount++;
              continue;
            }
            const ttsData = await resp.json();
            if (!ttsData.success) {
              ttsFailCount++;
              continue;
            }
            const binary = atob(ttsData.base64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            const blob = new Blob([bytes], { type: `audio/${ttsData.format}` });
            await db.audioFiles.put({
              id: audioId,
              blob,
              format: ttsData.format,
              createdAt: Date.now(),
            });
          } catch (err) {
            log.warn(`[TTS] Failed for ${audioId}:`, err);
            ttsFailCount++;
          }
        }

        if (ttsFailCount > 0 && speechActions.length > 0) {
          log.warn('[GenerationPreview] Managed TTS degraded to browser narration fallback', {
            failedCount: ttsFailCount,
            totalCount: speechActions.length,
            stageId: stage.id,
          });
        }
      }

      // Add scene to store and navigate
      store.addScene(data.scene);
      store.setCurrentSceneId(data.scene.id);

      try {
        await persistClassroomSnapshot({
          stage,
          scenes: useStageStore.getState().scenes,
          signal,
        });
      } catch (persistError) {
        log.warn(
          '[GenerationPreview] Initial classroom persistence failed, will retry after entering classroom:',
          persistError,
        );
      }

      // Set remaining outlines as skeleton placeholders
      const remaining = outlines.filter((o) => o.order !== data.scene.order);
      store.setGeneratingOutlines(remaining);

      // Store generation params for classroom to continue generation
      sessionStorage.setItem(
        'generationParams',
        JSON.stringify({
          pdfImages: currentSession.pdfImages,
          agents,
          userProfile,
        }),
      );

      sessionStorage.removeItem('generationSession');
      await store.saveToStorage();
      router.push(`/classroom/${stage.id}`);
    } catch (err) {
      // AbortError is expected when navigating away — don't show as error
      if (err instanceof DOMException && err.name === 'AbortError') {
        log.info('[GenerationPreview] Generation aborted');
        return;
      }
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const extractTopicFromRequirement = (requirement: string): string => {
    const trimmed = requirement.trim();
    if (trimmed.length <= 500) {
      return trimmed;
    }
    return trimmed.substring(0, 500).trim() + '...';
  };

  const isStudentSelfStudySource = session?.classroomContext?.source === 'student-self-study';
  const goBackHref = isStudentSelfStudySource ? '/student/interactive-classroom' : '/';
  const goBackLabel = isStudentSelfStudySource ? '返回学习工作台' : t('generation.backToHome');

  const goBackToHome = () => {
    abortControllerRef.current?.abort();
    sessionStorage.removeItem('generationSession');
    router.push(goBackHref);
  };

  // Still loading session from sessionStorage
  if (!mounted || !sessionLoaded) {
    return (
      <div className="classroom-page-shell w-full">
        <div className="mx-auto flex min-h-[100dvh] w-full max-w-[920px] items-center justify-center px-4 py-6 md:px-6 md:py-8">
          <Card className={cn(classroomPanel, 'w-full max-w-xl p-6 md:p-7')}>
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-sky-100/90 bg-sky-50/90">
                <Sparkles className="size-5 animate-pulse text-sky-600" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-semibold tracking-[0.12em] text-slate-500">
                  GENERATION PREVIEW
                </div>
                <div className="mt-1 text-xl font-semibold text-slate-900">
                  正在恢复课堂生成上下文
                </div>
                <div className="mt-2 text-sm leading-6 text-slate-600">
                  系统会继续读取这次课堂的主题、角色和生成进度，恢复完成后会自动进入生成舞台。
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // No session found
  if (!session) {
    return (
      <div className="classroom-page-shell w-full">
        <div className="mx-auto flex min-h-[100dvh] w-full max-w-[1160px] flex-col gap-4 px-4 py-6 md:px-6 md:py-8 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(goBackHref)}
              className={cn(classroomSoftButton('slate'), 'h-auto px-4 py-2 text-sm')}
            >
              <ArrowLeft className="mr-2 size-4" />
              {goBackLabel}
            </Button>
            <div className={classroomTonePill('sky', 'py-1.5 font-medium')}>尚未开始生成</div>
          </div>

          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.08fr)_minmax(300px,0.84fr)]">
            <Card className={cn(classroomHeroPanel, 'overflow-hidden px-5 py-5 text-left md:px-6 md:py-6')}>
              <ClassroomBrand size="md" showTagline={false} className="max-w-fit" />
              <h1 className="mt-5 max-w-[15ch] text-balance text-[clamp(1.82rem,3.2vw,2.72rem)] font-semibold leading-[1.06] tracking-tight text-slate-900 dark:text-slate-100">
                先发起一节明确的课堂，再进入生成预览主舞台
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300/85 md:text-[15px]">
                当前还没有可恢复的生成会话。你可以直接重新发起知序课堂，也可以从学生自主学习入口进入预习、巩固、兴趣探索或课堂回看场景。
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className={classroomTonePill('sky', 'font-medium')}>教师开课</span>
                <span className={classroomTonePill('emerald', 'font-medium')}>学生自学</span>
                <span className={classroomTonePill('amber', 'font-medium')}>全班观看与导出</span>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  onClick={() => router.push('/ai-classroom')}
                  className={cn(classroomSoftButton('sky'), 'h-auto px-4 py-2.5 text-sm')}
                >
                  进入互动课堂
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => router.push('/student/interactive-classroom')}
                  className={cn(classroomSoftButton('emerald'), 'h-auto px-4 py-2.5 text-sm')}
                >
                  学生自主学习
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => router.push(goBackHref)}
                  className={cn(classroomSoftButton('slate'), 'h-auto px-4 py-2.5 text-sm')}
                >
                  返回当前工作台
                </Button>
              </div>

              <div className="mt-6 grid gap-2.5 md:grid-cols-3">
                <div className={cn(classroomToneCard('sky', 'px-4 py-4'))}>
                  <div className="text-[11px] font-semibold tracking-[0.12em] text-sky-700/80 dark:text-sky-300/80">
                    教师开课
                  </div>
                  <div className="mt-2 text-base font-semibold text-slate-900 dark:text-slate-100">
                    从教材、班级和数字人老师发起课堂
                  </div>
                  <div className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    适合上课、公开课、复习课和学校级统一分发场景。
                  </div>
                </div>
                <div className={cn(classroomToneCard('emerald', 'px-4 py-4'))}>
                  <div className="text-[11px] font-semibold tracking-[0.12em] text-emerald-700/80 dark:text-emerald-300/80">
                    学生自学
                  </div>
                  <div className="mt-2 text-base font-semibold text-slate-900 dark:text-slate-100">
                    支持预习、巩固、兴趣探索与课堂回看
                  </div>
                  <div className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    学生可以不依赖老师排课，直接围绕目标进入一节完整互动课堂。
                  </div>
                </div>
                <div className={cn(classroomToneCard('amber', 'px-4 py-4'))}>
                  <div className="text-[11px] font-semibold tracking-[0.12em] text-amber-700/80 dark:text-amber-300/80">
                    课堂交付
                  </div>
                  <div className="mt-2 text-base font-semibold text-slate-900 dark:text-slate-100">
                    生成后可全班观看，也可继续沉淀和导出
                  </div>
                  <div className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    把课堂从一次性生成，变成可观看、可复用、可治理的学校级资产。
                  </div>
                </div>
              </div>
            </Card>

            <Card className={cn(classroomPanel, 'p-4 md:p-5')}>
              <div className="text-[11px] font-semibold tracking-[0.12em] text-slate-500 dark:text-slate-400">
                这样进入更顺
              </div>
              <div className="mt-2 text-xl font-semibold text-slate-900 dark:text-slate-100">
                先发起课堂，再看生成舞台
              </div>
              <div className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                生成预览页只负责呈现课堂编排进度和结果，不适合作为直接入口。把启动动作放回前一个场景，用户会更清楚自己为什么来到这里。
              </div>

              <div className="mt-4 grid gap-2.5">
                {[
                  '先在互动课堂入口确认教材主题、班级对象或学生学习目标。',
                  '完成发起后，系统会把数字人老师、互动脚本和导出能力一起编排。',
                  '进入预览页后，只需要等待生成完成并进入课堂舞台即可。',
                ].map((item, index) => (
                  <div
                    key={item}
                    className={cn(classroomInsetPanel, 'flex items-start gap-3 px-3.5 py-3')}
                  >
                    <span className={classroomTonePill(index === 1 ? 'emerald' : index === 2 ? 'amber' : 'sky')}>
                      {index + 1}
                    </span>
                    <span className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                      {item}
                    </span>
                  </div>
                ))}
              </div>

              <div className={cn(classroomToneCard('slate', 'mt-4 px-4 py-4'))}>
                <div className="flex items-start gap-3">
                  <AlertCircle className="mt-0.5 size-4 shrink-0 text-slate-400 dark:text-slate-500" />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {t('generation.sessionNotFound')}
                    </div>
                    <div className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                      {t('generation.sessionNotFoundDesc')}
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  const activeStep =
    activeSteps.length > 0
      ? activeSteps[Math.min(currentStepIndex, activeSteps.length - 1)]
      : ALL_STEPS[0];
  const safeCurrentStepIndex =
    activeSteps.length > 0 ? Math.min(currentStepIndex, activeSteps.length - 1) : 0;
  const currentStepNumber = activeSteps.length > 0 ? safeCurrentStepIndex + 1 : 1;
  const totalSteps = Math.max(activeSteps.length, 1);
  const progressPercent = Math.max(
    8,
    Math.min(100, Math.round((currentStepNumber / totalSteps) * 100)),
  );
  const nextStep =
    safeCurrentStepIndex < activeSteps.length - 1 ? activeSteps[safeCurrentStepIndex + 1] : null;
  const requirementSummary = extractTopicFromRequirement(
    session.requirements.requirement || '互动课堂',
  );
  const previewSubjectLabel = session.classroomContext?.subject
    ? (SUBJECT_LABELS[session.classroomContext.subject] ?? session.classroomContext.subject)
    : null;
  const previewAudienceLabel = session.classroomContext?.audienceMode
    ? buildAudienceModeLabel(session.classroomContext.audienceMode)
    : '单人课堂';
  const previewLearningModeLabel = session.classroomContext?.learningMode
    ? buildLearningModeLabel(session.classroomContext.learningMode)
    : null;
  const previewEntrySceneLabel =
    session.classroomContext?.source === 'student-self-study'
      ? '学生自主互动课堂'
      : session.classroomContext?.audienceMode === 'whole-class'
        ? '全班观看课堂'
        : '正式互动课堂';
  const previewHeadline =
    session.classroomContext?.source === 'student-self-study'
      ? '正在把这次自主学习目标编排成一节可直接进入的互动课堂'
      : '正在把教材、角色和课堂目标编排成一节可直接播放的知序课堂';
  const previewDescription =
    session.classroomContext?.source === 'student-self-study'
      ? '系统会把学习主题、画像薄弱点、课堂节奏和导出能力一起带入，让学生从等待生成到正式开课之间也能保持明确预期。'
      : '系统会把教材内容、班级角色、教师数字人、互动脚本和导出能力一起整理好，生成完成后会直接进入课堂舞台。';
  const activeStepTypeLabel =
    activeStep.type === 'analysis'
      ? '理解上下文'
      : activeStep.type === 'writing'
        ? '组织课堂结构'
        : '生成可播放内容';
  const nextStepTitle = nextStep ? t(nextStep.title) : '即将进入课堂';
  const nextStepDescription = nextStep
    ? t(nextStep.description)
    : '第一屏课堂内容准备完成后会直接打开。';
  const currentModelConfig = getCurrentModelConfig();
  const errorView = buildGenerationErrorView(error);
  const statusHeadline = errorView?.headline ?? t(activeStep.title);
  const statusBody = (errorView?.summary ?? statusMessage) || t(activeStep.description);
  const recoveryTitle = errorView?.recoveryTitle ?? nextStepTitle;
  const recoveryDescription = errorView?.suggestion ?? nextStepDescription;
  const retryButtonLabel = isStudentSelfStudySource
    ? '返回学习工作台后重试'
    : errorView?.primaryActionLabel ?? t('generation.goBackAndRetry');
  const routeToggleLabel = showRouteDetails ? '收起完整生成路线' : '展开完整生成路线';
  const providerManagementLabel = currentModelConfig.isServerConfigured
    ? '后台统一托管模型与密钥'
    : '当前仍允许本地调试配置参与生成';
  const providerManagementDetail = currentModelConfig.isServerConfigured
    ? '本次生成会优先读取管理端后台配置，不依赖浏览器本地密钥。'
    : '当前环境还保留浏览器侧调试兼容链路，正式发布建议继续收口到后台。';
  const generationCapabilities = [
    session.pdfText ? '教材内容已导入' : null,
    session.requirements.webSearch ? '联网补充背景' : null,
    activeSteps.some((step) => step.id === 'agent-generation') ? '智能角色编排' : null,
    previewLearningModeLabel ?? null,
    previewSubjectLabel ?? null,
    currentModelConfig.isServerConfigured ? '后台托管模型' : '本地调试模型',
  ].filter(Boolean) as string[];
  const contextSummaryLines =
    session.classroomContext?.source === 'student-self-study'
      ? [
          session.classroomContext.learner?.name
            ? `当前学习者：${session.classroomContext.learner.name}`
            : '当前学习者：未指定',
          session.classroomContext.focusKnowledgePointTitle
            ? `聚焦知识点：${session.classroomContext.focusKnowledgePointTitle}`
            : session.classroomContext.interestTopic
              ? `兴趣主题：${session.classroomContext.interestTopic}`
              : null,
          session.classroomContext.learnerGoal
            ? `学习目标：${session.classroomContext.learnerGoal}`
            : null,
        ].filter(Boolean)
      : [
          session.classroomContext?.className
            ? `班级上下文：${session.classroomContext.className}`
            : '班级上下文：未指定',
          session.classroomContext?.teacher?.digitalHuman?.displayName ||
          session.classroomContext?.teacher?.name
            ? `主讲身份：${
                session.classroomContext?.teacher?.digitalHuman?.displayName ||
                session.classroomContext?.teacher?.name
              }`
            : null,
          session.classroomContext?.students?.length
            ? `班级学生：${session.classroomContext.students.length} 人`
            : null,
        ].filter(Boolean);
  const currentProgressLabel = `第 ${currentStepNumber} / ${totalSteps} 步`;
  const lessonModeSummary = [previewAudienceLabel, previewLearningModeLabel ?? previewSubjectLabel]
    .filter(Boolean)
    .join(' · ');
  const presenterSummary = isStudentSelfStudySource
    ? session.classroomContext?.learner?.name
      ? `面向 ${session.classroomContext.learner.name} 的个性化学习路径`
      : '将根据学生画像自动匹配讲解深度、互动节奏与反馈'
    : session.classroomContext?.teacher?.digitalHuman?.displayName ||
        session.classroomContext?.teacher?.name
      ? `主讲身份：${
          session.classroomContext?.teacher?.digitalHuman?.displayName ||
          session.classroomContext?.teacher?.name
        }`
      : '真实教务角色、课堂人物与数字人将自动协同';
  const deliverySummary = session.classroomContext?.exportFormats?.length
    ? `支持 ${session.classroomContext.exportFormats.join(' / ')} 导出、回看与整班分享`
    : '支持整班观看、课堂回看与后续沉淀';
  const heroSummaryItems = [
    {
      title: '课堂主线',
      value: requirementSummary,
      helper: session.requirements.webSearch
        ? `${presenterSummary} · 会同步补入联网背景与讲解上下文`
        : `${presenterSummary} · 按当前主题直接组织课堂脚本`,
    },
    {
      title: '进入后体验',
      value: previewEntrySceneLabel,
      helper: error
        ? recoveryDescription
        : `${lessonModeSummary || previewAudienceLabel} · ${deliverySummary}`,
    },
  ];
  const contextPanelTitle = isStudentSelfStudySource ? '已带入学习上下文' : '已带入班级上下文';
  const contextSummaryHeadline =
    contextSummaryLines[0]
    ?? (isStudentSelfStudySource
      ? '学习画像、目标和课堂节奏已准备就绪'
      : '班级角色、主讲身份和课堂对象已准备就绪');
  const contextSummaryHelper =
    contextSummaryLines.length > 1
      ? `还包含 ${contextSummaryLines.length - 1} 条课堂衔接信息，按需展开查看。`
      : '本次课堂的关键上下文已经同步带入，按需展开查看。';
  const visibleContextSummaryLines = contextSummaryLines.slice(0, 2);
  const hiddenContextSummaryLines = contextSummaryLines.slice(2);
  const readinessItems = [
    {
      title: '进入课堂方式',
      description: '生成完成后将直接进入课堂舞台，并继续补全后续内容与可播放动作。',
    },
    {
      title: '课堂输出',
      description: session.classroomContext?.exportFormats?.length
        ? `已准备导出格式：${session.classroomContext.exportFormats.join(' / ')}`
        : '课堂内容会按可回看、可分享、可导出的方式组织。',
    },
    {
      title: '数字人状态',
      description: session.classroomContext?.teacher?.digitalHuman?.voiceLabel
        ? `教师数字人音色已就绪：${session.classroomContext.teacher.digitalHuman.voiceLabel}`
        : isStudentSelfStudySource
          ? '如果配置了学习陪练角色，课堂中会自动启用对应数字人与语音。'
          : '教师数字人、学生角色与教务身份会在课堂中自动对齐。',
    },
    {
      title: '模型与配置',
      description: providerManagementDetail,
    },
  ];
  const secondaryReadinessItems = readinessItems.slice(2);
  const previewHandoffItems = [
    {
      title: '进入后的体验',
      description: isStudentSelfStudySource
        ? '会直接进入学生自主互动课堂，沿着当前主题继续讲解、追问、练习与回看。'
        : '会直接进入正式互动课堂，可继续投屏授课、组织全班观看或按班级节奏推进。',
    },
    {
      title: '最终交付',
      description: deliverySummary,
    },
  ];

  return (
    <div className="classroom-page-shell min-h-[100dvh] w-full overflow-hidden">
      <div className="generation-preview-shell mx-auto flex min-h-[100dvh] w-full max-w-[1344px] flex-col gap-3 px-4 py-5 md:px-6 md:py-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap items-center justify-between gap-3"
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={goBackToHome}
            className={cn(classroomSoftButton('slate'), 'h-auto px-4 py-2 text-sm')}
          >
            <ArrowLeft className="mr-2 size-4" />
            {goBackLabel}
          </Button>
          <div className={classroomTonePill('sky', 'py-1.5 font-medium')}>
            {currentProgressLabel}
          </div>
        </motion.div>

        <div className="generation-preview-main-grid grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_228px] xl:grid-cols-[minmax(0,1fr)_240px]">
          <div className="grid gap-3">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className={cn(classroomHeroPanel, 'overflow-hidden px-4 py-3.5 text-left md:px-5 md:py-4')}
            >
              <div className="flex flex-col gap-2.5 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-3xl">
                  <ClassroomBrand size="md" showTagline={false} className="max-w-fit" />
                  <h1 className="mt-3 max-w-[12ch] text-balance text-[clamp(1.58rem,2.45vw,2.18rem)] font-semibold leading-[1.04] tracking-tight text-slate-900 dark:text-slate-100">
                    {previewHeadline}
                  </h1>
                  <p className="mt-2.5 max-w-3xl text-[13px] leading-[1.6] text-slate-600 dark:text-slate-300/85 md:text-[13.5px]">
                    {previewDescription}
                  </p>

                  <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
                    <span className={classroomTonePill('sky', 'font-medium')}>
                      {previewAudienceLabel}
                    </span>
                    {generationCapabilities.map((item) => (
                      <span key={item} className={classroomTonePill('slate', 'font-medium')}>
                        {item}
                      </span>
                    ))}
                  </div>
                </div>

                <div
                  className={cn(
                    classroomToneCard('sky', 'px-3.5 py-3 lg:min-w-[182px] lg:max-w-[198px]'),
                  )}
                >
                  <div className="text-[11px] font-semibold tracking-[0.12em] text-sky-700/80 dark:text-sky-300/80">
                    当前进度
                  </div>
                  <div className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
                    {`${currentProgressLabel} · ${activeStepTypeLabel}`}
                  </div>
                  <div className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    {error
                      ? errorView?.summary ?? '当前流程已中断，可返回上一页重新发起。'
                      : `${providerManagementLabel}，接下来：${nextStepTitle}`}
                  </div>
                </div>
              </div>

              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {heroSummaryItems.map((item) => (
                  <div key={item.title} className={cn(classroomInsetPanel, 'px-3 py-3')}>
                    <div className="text-xs font-semibold tracking-[0.12em] text-slate-500 dark:text-slate-400">
                      {item.title}
                    </div>
                    <div className="mt-2 text-sm font-semibold leading-6 text-slate-900 dark:text-slate-100">
                      {item.value}
                    </div>
                    <div className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                      {item.helper}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.05 }}
              className="w-full"
            >
              <Card className={cn(classroomHeroPanel, 'relative overflow-hidden p-3.5 md:p-4')}>
                <div className="absolute inset-x-5 top-4 flex gap-2">
                  {activeSteps.map((step, idx) => (
                    <div
                      key={step.id}
                      className={cn(
                        'h-1.5 rounded-full transition-all duration-500',
                        idx < safeCurrentStepIndex
                          ? 'w-8 bg-emerald-400/55'
                          : idx === safeCurrentStepIndex
                            ? 'flex-1 bg-gradient-to-r from-sky-500 via-blue-500 to-cyan-400'
                            : 'w-8 bg-sky-100/90',
                      )}
                    />
                  ))}
                </div>

                <div className="generation-preview-stage-grid mt-5 grid gap-2.5 lg:grid-cols-[minmax(0,1fr)_196px] lg:items-start xl:grid-cols-[minmax(0,1fr)_204px]">
                  <div className="grid gap-3">
                    <div
                      className={cn(
                        classroomInsetPanel,
                        'relative flex min-h-[240px] items-center justify-center overflow-hidden px-4 py-4 md:min-h-[304px] lg:min-h-[352px]',
                      )}
                    >
                      <div className="pointer-events-none absolute inset-0">
                        <div className="absolute left-[10%] top-[12%] h-28 w-28 rounded-full bg-sky-200/35 blur-3xl" />
                        <div className="absolute right-[12%] bottom-[10%] h-32 w-32 rounded-full bg-teal-200/35 blur-3xl" />
                        <div className="absolute inset-x-10 top-0 h-px bg-white/70" />
                      </div>

                      <div className="absolute left-3.5 top-3.5 inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/86 px-2.5 py-1 text-[10px] font-semibold tracking-[0.12em] text-slate-500 shadow-sm">
                        {error ? '流程已中断' : '生成主舞台'}
                      </div>
                      <div className="absolute right-3.5 top-3.5 rounded-full border border-sky-100/90 bg-white/88 px-2.5 py-1 text-[11px] font-semibold text-sky-700 shadow-sm">
                        {progressPercent}%
                      </div>

                      <div className="relative flex w-full items-center justify-center">
                        <AnimatePresence mode="popLayout">
                          {error ? (
                            <motion.div
                              key="error"
                              initial={{ scale: 0.5, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              className="flex size-36 items-center justify-center rounded-[34px] border border-red-300/40 bg-red-50/85 shadow-[0_26px_72px_rgba(239,68,68,0.14)]"
                            >
                              <AlertCircle className="size-16 text-red-500" />
                            </motion.div>
                          ) : (
                            <motion.div
                              key={activeStep.id}
                              initial={{ scale: 0.8, opacity: 0, filter: 'blur(10px)' }}
                              animate={{ scale: 1, opacity: 1, filter: 'blur(0px)' }}
                              exit={{ scale: 1.2, opacity: 0, filter: 'blur(10px)' }}
                              transition={{ duration: 0.4 }}
                              className="absolute inset-0 flex items-center justify-center"
                            >
                              <div className="scale-[1.02] md:scale-[1.1]">
                                <StepVisualizer
                                  stepId={activeStep.id}
                                  outlines={streamingOutlines}
                                  webSearchSources={webSearchSources}
                                />
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>

                  <div className="flex h-full flex-col gap-3 text-left">
                    <div>
                      <div className="text-[11px] font-semibold tracking-[0.12em] text-slate-500 dark:text-slate-400">
                        当前执行步骤
                      </div>
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={error ? 'error' : activeStep.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="mt-2 space-y-2"
                        >
                          <h2 className="text-[clamp(1.5rem,1.7vw,1.95rem)] font-bold tracking-tight text-slate-900 dark:text-slate-100">
                            {statusHeadline}
                          </h2>
                          <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                            {statusBody}
                          </p>
                        </motion.div>
                      </AnimatePresence>
                    </div>

                    <div className={cn(classroomToneCard(error ? 'amber' : 'sky', 'px-3.5 py-3.5'))}>
                      <div className="text-xs font-semibold tracking-[0.12em] text-slate-500 dark:text-slate-400">
                        {error ? '当前中断说明' : '当前生成节奏'}
                      </div>
                      <div className="mt-2 text-sm font-semibold leading-6 text-slate-900 dark:text-slate-100">
                        {error ? recoveryTitle : `${statusHeadline} · ${activeStepTypeLabel}`}
                      </div>
                      <div className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-200">
                        {error
                          ? recoveryDescription
                          : `${statusBody} 第一屏课堂内容准备完成后会直接衔接到 ${nextStepTitle}。`}
                      </div>

                      <div className={cn(classroomInsetPanel, 'mt-3 px-3.5 py-3.5')}>
                        <div className="text-xs font-semibold tracking-[0.12em] text-slate-500 dark:text-slate-400">
                          {error ? '恢复路径' : '下一步'}
                        </div>
                        <div className="mt-2 text-sm font-semibold leading-6 text-slate-900 dark:text-slate-100">
                          {error ? recoveryTitle : nextStepTitle}
                        </div>
                        <div className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                          {error ? recoveryDescription : nextStepDescription}
                        </div>
                      </div>

                      <div className="mt-3 flex items-start gap-2 rounded-[18px] border border-white/65 bg-white/62 px-3.5 py-3 text-xs leading-5 text-slate-600 shadow-[0_10px_24px_rgba(15,23,42,0.04)] dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                        <span className="mt-1 inline-flex h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400" />
                        <span>
                          <span className="font-semibold text-slate-900 dark:text-slate-100">最终交付</span>
                          {' · '}
                          {previewLearningModeLabel ?? previewAudienceLabel}
                          {' · '}
                          {deliverySummary}
                        </span>
                      </div>
                    </div>

                    <AnimatePresence>
                      {truncationWarnings.length > 0 && !error ? (
                        <motion.div
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6 }}
                          className={cn(classroomToneCard('amber', 'px-3.5 py-3'))}
                        >
                          <div className="flex items-start gap-3">
                            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500 dark:text-amber-300" />
                            <div className="space-y-1">
                              <div className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                                输入内容已做轻量收束
                              </div>
                              {truncationWarnings.map((warning) => (
                                <div
                                  key={warning}
                                  className="text-xs leading-5 text-amber-700 dark:text-amber-300/85"
                                >
                                  {warning}
                                </div>
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </div>
                </div>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.08 }}
              className="generation-preview-foyer-grid grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(264px,0.78fr)]"
            >
              <Card className={cn(classroomSectionPanel, 'rounded-[22px] p-4')}>
                <div className="text-[11px] font-semibold tracking-[0.12em] text-slate-500 dark:text-slate-400">
                  {contextPanelTitle}
                </div>
                <div className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {contextSummaryHeadline}
                </div>
                <div className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  {contextSummaryHelper}
                </div>

                <div className="mt-4 grid gap-2">
                  {visibleContextSummaryLines.map((line) => (
                    <div key={line} className={cn(classroomInsetPanel, 'px-3.5 py-3')}>
                      <div className="flex items-start gap-3">
                        <span className="mt-2 inline-flex h-2 w-2 shrink-0 rounded-full bg-sky-400" />
                        <div className="min-w-0 text-sm leading-6 text-slate-700 dark:text-slate-200">
                          {line}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <details className="generation-preview-disclosure">
                  <summary>
                    <span>查看更多课堂准备</span>
                    <span className={classroomTonePill('slate')}>
                      {`${hiddenContextSummaryLines.length + readinessItems.length} 项准备`}
                    </span>
                  </summary>

                  <div className="generation-preview-disclosure-body">
                    <div className="grid gap-2">
                      {hiddenContextSummaryLines.map((line) => (
                        <div key={line} className={cn(classroomInsetPanel, 'px-3.5 py-3')}>
                          <div className="flex items-start gap-3">
                            <span className="mt-2 inline-flex h-2 w-2 shrink-0 rounded-full bg-sky-400" />
                            <div className="min-w-0 text-sm leading-6 text-slate-700 dark:text-slate-200">
                              {line}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="grid gap-2 md:grid-cols-2">
                      {readinessItems.map((item) => (
                        <div key={item.title} className={cn(classroomInsetPanel, 'px-3.5 py-3.5')}>
                          <div className="flex items-start gap-3">
                            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                              <CheckCircle2 className="size-4" />
                            </span>
                            <div>
                              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                {item.title}
                              </div>
                              <div className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                                {item.description}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </details>
              </Card>

              <Card className={cn(classroomSectionPanel, 'rounded-[22px] p-4')}>
                <div className="text-[11px] font-semibold tracking-[0.12em] text-slate-500 dark:text-slate-400">
                  开课前厅
                </div>
                <div className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
                  生成完成后会直接进入 {previewEntrySceneLabel}
                </div>
                <div className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  这里先把“接下来会发生什么”说明白，让用户在等待阶段也知道生成结束后会如何开课、播放、回看和导出。
                </div>

                <div className="mt-4 grid gap-2">
                  {previewHandoffItems.map((item) => (
                    <div key={item.title} className={cn(classroomInsetPanel, 'px-3.5 py-3')}>
                      <div className="text-xs font-semibold tracking-[0.12em] text-slate-500 dark:text-slate-400">
                        {item.title}
                      </div>
                      <div className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-200">
                        {item.description}
                      </div>
                    </div>
                  ))}
                </div>

                <details className="generation-preview-disclosure">
                  <summary>
                    <span>展开能力补充</span>
                    <span className={classroomTonePill('slate')}>
                      {`${secondaryReadinessItems.length} 项补充`}
                    </span>
                  </summary>

                  <div className="generation-preview-disclosure-body">
                    <div className={cn(classroomToneCard('slate', 'px-3.5 py-3.5'))}>
                      <div className="grid gap-2">
                        {secondaryReadinessItems.map((item) => (
                          <div
                            key={item.title}
                            className="flex items-start gap-2 text-[12px] leading-5 text-slate-600 dark:text-slate-300"
                          >
                            <span className="mt-1 inline-flex h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400" />
                            <span>
                              <span className="font-semibold text-slate-900 dark:text-slate-100">
                                {item.title}
                              </span>
                              {' · '}
                              {item.description}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </details>
              </Card>
            </motion.div>
          </div>

            <motion.div
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.12, duration: 0.4, ease: 'easeOut' }}
              className="generation-preview-rail grid gap-2 xl:sticky xl:top-5"
            >
            <Card className={cn(classroomPanel, 'p-3.5 md:p-4')}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold tracking-[0.12em] text-slate-500 dark:text-slate-400">
                    流程总览
                  </div>
                  <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
                    {currentProgressLabel}
                  </div>
                </div>
                {!error ? (
                  <div
                    className={cn(
                      classroomTonePill('sky', 'inline-flex items-center gap-2 py-1.5 font-medium'),
                    )}
                  >
                    <Sparkles className="size-3.5 animate-pulse" />
                    {t('generation.aiWorking')}
                  </div>
                ) : null}
              </div>

              <div className="mt-4 h-2 overflow-hidden rounded-full bg-sky-100/90 dark:bg-slate-800">
                <motion.div
                  className={cn(
                    'h-full rounded-full',
                    error ? 'bg-red-500' : 'bg-gradient-to-r from-sky-500 via-blue-500 to-cyan-400',
                  )}
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                />
              </div>

              <div className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                {error ? recoveryDescription : `当前步骤：${statusHeadline}。完成后会继续进入 ${nextStepTitle}。`}
              </div>

              {errorView ? (
                <div className={cn(classroomToneCard('amber', 'mt-4 px-4 py-3'))}>
                  <div className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                    建议这样继续
                  </div>
                  <div className="mt-1 text-xs leading-5 text-amber-800 dark:text-amber-200/85">
                    {errorView.suggestion}
                  </div>
                </div>
              ) : null}

              <div className="mt-4 grid gap-3">
                <div className={cn(classroomInsetPanel, 'px-3 py-3')}>
                  <div className="text-xs font-semibold tracking-[0.12em] text-slate-500 dark:text-slate-400">
                    课堂主输入
                  </div>
                  <div className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-200">
                    {requirementSummary}
                  </div>
                </div>

                <div className={cn(classroomInsetPanel, 'px-3 py-3')}>
                  <div className="text-xs font-semibold tracking-[0.12em] text-slate-500 dark:text-slate-400">
                    {error ? '建议操作' : '下一步'}
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {error ? recoveryTitle : nextStepTitle}
                  </div>
                  <div className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                    {error ? recoveryDescription : nextStepDescription}
                  </div>
                </div>

                <div className={cn(classroomInsetPanel, 'px-3 py-3')}>
                  <div className="text-xs font-semibold tracking-[0.12em] text-slate-500 dark:text-slate-400">
                    生成完成后
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {previewEntrySceneLabel}
                  </div>
                  <div className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                    {deliverySummary}
                  </div>
                </div>

                <div className="grid gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={cn(
                      classroomSoftButton('slate'),
                      'h-auto w-full justify-center py-2.5 text-sm',
                    )}
                    onClick={() => setShowRouteDetails((prev) => !prev)}
                  >
                    {routeToggleLabel}
                  </Button>
                </div>
              </div>

              <AnimatePresence initial={false}>
                {showRouteDetails ? (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="mt-4 grid gap-2"
                  >
                    {errorView ? (
                      <details className={cn(classroomInsetPanel, 'px-3 py-3')}>
                        <summary className="cursor-pointer text-sm font-semibold text-slate-900 dark:text-slate-100">
                          查看技术详情
                        </summary>
                        <div className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                          {errorView.detail}
                        </div>
                      </details>
                    ) : null}
                    {activeSteps.map((step, idx) => {
                      const StepIcon = step.icon;
                      const state =
                        idx < safeCurrentStepIndex
                          ? 'done'
                          : idx === safeCurrentStepIndex
                            ? 'active'
                            : 'pending';

                      return (
                        <div
                          key={step.id}
                          className={cn(
                            'flex items-start gap-3 rounded-2xl border px-3 py-3 transition-colors',
                            state === 'active'
                              ? 'border-sky-300/80 bg-sky-50/90 dark:border-sky-800/60 dark:bg-sky-950/30'
                              : state === 'done'
                                ? 'border-emerald-200/80 bg-emerald-50/80 dark:border-emerald-900/40 dark:bg-emerald-950/20'
                                : 'border-sky-100/90 bg-white/86 dark:border-slate-800 dark:bg-slate-950/25',
                          )}
                        >
                          <div
                            className={cn(
                              'mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                              state === 'active'
                                ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-200'
                                : state === 'done'
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-200'
                                  : 'bg-sky-50 text-slate-500 dark:bg-slate-800 dark:text-slate-300',
                            )}
                          >
                            {state === 'done' ? (
                              <CheckCircle2 className="size-4" />
                            ) : (
                              <StepIcon className="size-4" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                              {t(step.title)}
                            </div>
                            <div className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                              {t(step.description)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </Card>

            {generatedAgents.length > 0 && !showAgentReveal ? (
              <button
                onClick={() => setShowAgentReveal(true)}
                className={cn(
                  classroomSoftButton('sky'),
                  'inline-flex w-full items-center justify-center gap-1.5 py-2.5 text-sm font-medium',
                )}
              >
                <Bot className="size-3.5" />
                {t('generation.viewAgents')}
              </button>
            ) : null}

            <AnimatePresence mode="wait">
              {error ? (
                <motion.div
                  key="retry"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="w-full"
                >
                  <Button
                    size="lg"
                    variant="outline"
                    className={`${classroomOutlineButton('sky')} h-12 w-full`}
                    onClick={goBackToHome}
                  >
                    {retryButtonLabel}
                  </Button>
                </motion.div>
              ) : (
                <motion.div
                  key="working"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="flex items-center justify-center gap-3 text-sm font-medium text-slate-500"
                >
                  <Sparkles className="size-3.5 animate-pulse text-sky-500" />
                  {t('generation.aiWorking')}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>

      {/* Agent Reveal Modal */}
      <AgentRevealModal
        agents={generatedAgents}
        open={showAgentReveal}
        presentation="dock"
        onClose={() => {
          setShowAgentReveal(false);
          agentRevealResolveRef.current?.();
          agentRevealResolveRef.current = null;
        }}
        onAllRevealed={() => {
          agentRevealResolveRef.current?.();
          agentRevealResolveRef.current = null;
        }}
      />
    </div>
  );
}

export default function GenerationPreviewPage() {
  return (
    <Suspense
      fallback={
        <div className="classroom-page-shell flex min-h-[100dvh] w-full items-center justify-center">
          <div className="animate-pulse space-y-4 text-center">
            <div className="h-8 w-48 bg-muted rounded mx-auto" />
            <div className="h-4 w-64 bg-muted rounded mx-auto" />
          </div>
        </div>
      }
    >
      <GenerationPreviewContent />
    </Suspense>
  );
}

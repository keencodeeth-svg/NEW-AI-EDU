'use client';

import {
  Settings,
  Sun,
  Moon,
  Monitor,
  ArrowLeft,
  Loader2,
  Download,
  FileDown,
  Package,
  Link2,
  Check,
  ChevronDown,
} from 'lucide-react';
import { useI18n } from '@/lib/hooks/use-i18n';
import { useTheme } from '@/lib/hooks/use-theme';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ClassroomBrand } from './brand/classroom-brand';
import { SettingsDialog } from './settings';
import { cn } from '@/lib/utils';
import { useSettingsStore } from '@/lib/store/settings';
import { useStageStore } from '@/lib/store/stage';
import { useMediaGenerationStore } from '@/lib/store/media-generation';
import { useExportPPTX } from '@/lib/export/use-export-pptx';
import { toast } from 'sonner';
import {
  appendClassroomDeliveryRecord,
  buildAudienceModeLabel,
  buildDeliveryFormatLabel,
  buildExportFormatLabel,
  buildLearningModeLabel,
} from '@/lib/classroom-integration';
import { syncClassroomDeliveryAudit } from '@/lib/classroom-delivery-client';
import {
  classroomControlButton,
  classroomControlDivider,
  classroomControlToggle,
  classroomDropdownItem,
  classroomDropdownMenu,
  classroomIconButton,
  classroomInsetPanel,
  classroomPanel,
  classroomTonePill,
  classroomToolbarStrip,
} from '@/lib/ui/classroom-theme';

interface HeaderProps {
  readonly currentSceneTitle: string;
}

const APP_TIME_ZONE = 'Asia/Shanghai';

export function Header({ currentSceneTitle }: HeaderProps) {
  const { t, locale, setLocale } = useI18n();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);

  // Model setup state
  const currentModelId = useSettingsStore((s) => s.modelId);
  const needsSetup = !currentModelId;

  // Export
  const { exporting: isExporting, exportPPTX, exportResourcePack } = useExportPPTX();
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const scenes = useStageStore((s) => s.scenes);
  const stage = useStageStore((s) => s.stage);
  const updateStage = useStageStore((s) => s.updateStage);
  const generatingOutlines = useStageStore((s) => s.generatingOutlines);
  const failedOutlines = useStageStore((s) => s.failedOutlines);
  const mediaTasks = useMediaGenerationStore((s) => s.tasks);
  const [publishingClassroom, setPublishingClassroom] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const pendingSceneGenerationCount = generatingOutlines.length;
  const failedSceneGenerationCount = failedOutlines.length;
  const currentStageMediaTasks = stage
    ? Object.values(mediaTasks).filter((task) => task.stageId === stage.id)
    : [];
  const unsettledCurrentStageMediaTaskCount = currentStageMediaTasks.filter(
    (task) => task.status !== 'done' && task.status !== 'failed',
  ).length;

  const canExport =
    scenes.length > 0 &&
    generatingOutlines.length === 0 &&
    failedOutlines.length === 0 &&
    unsettledCurrentStageMediaTaskCount === 0;
  const canPublish = canExport && !!stage;
  const classroomMeta = stage?.classroomMeta;
  const teacherDisplayName =
    classroomMeta?.teacher?.digitalHuman?.displayName || classroomMeta?.teacher?.name || null;
  const learnerDisplayName = classroomMeta?.learner?.name || null;
  const exportLabel = classroomMeta?.exportFormats?.length
    ? classroomMeta.exportFormats.map((format) => buildExportFormatLabel(format)).join(' / ')
    : 'PPTX / 资源包';
  const deliveryLabel = buildAudienceModeLabel(classroomMeta?.audienceMode);
  const learningLabel = classroomMeta?.learningMode
    ? buildLearningModeLabel(classroomMeta.learningMode)
    : null;
  const digitalHumanLabel =
    classroomMeta?.teacher?.digitalHuman?.displayName ||
    classroomMeta?.teacher?.digitalHuman?.voiceLabel;
  const publishedLabel = classroomMeta?.publishedUrl ? '已发布全班观看' : '可发布全班观看';
  const latestDelivery = classroomMeta?.deliveryRecords?.[0] || null;
  const latestDeliveryFormatLabel = latestDelivery
    ? buildDeliveryFormatLabel(latestDelivery.format)
    : null;
  const deliverySummaryLabel =
    classroomMeta?.deliveryRecords?.length && latestDelivery
      ? `最近交付 ${new Date(latestDelivery.createdAt).toLocaleString('zh-CN', {
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
          timeZone: APP_TIME_ZONE,
        })}`
      : null;
  const publishedStateDescription = classroomMeta?.publishedUrl
    ? '全班观看链接已生成，可直接复制分享给班级或投屏使用。'
    : '课堂生成完成后可一键发布全班观看链接，适合投屏授课与统一观摩。';
  const shareActionLabel = classroomMeta?.publishedUrl ? '复制全班观看地址' : '发布全班观看';
  const shareActionHint = publishingClassroom
    ? '正在生成班级分享链接'
    : shareCopied
      ? '分享地址已复制，可直接发给班级'
      : classroomMeta?.publishedUrl
        ? '适合班级统一观看与投屏播放'
        : failedSceneGenerationCount > 0
          ? `有 ${failedSceneGenerationCount} 个课堂页面生成失败，请重试后再发布`
          : pendingSceneGenerationCount > 0
            ? `仍有 ${pendingSceneGenerationCount} 个课堂页面正在生成`
            : unsettledCurrentStageMediaTaskCount > 0
              ? `仍有 ${unsettledCurrentStageMediaTaskCount} 个课堂资源正在生成`
              : '生成完成后即可一键分享给全班';
  const exportActionLabel = classroomMeta ? '导出课堂课件' : t('export.pptx');
  const exportActionHint = canExport
    ? exportLabel
    : failedSceneGenerationCount > 0
      ? `有 ${failedSceneGenerationCount} 个课堂页面生成失败，请重试后再导出`
      : pendingSceneGenerationCount > 0
        ? `仍有 ${pendingSceneGenerationCount} 个课堂页面正在生成`
      : unsettledCurrentStageMediaTaskCount > 0
        ? `仍有 ${unsettledCurrentStageMediaTaskCount} 个课堂资源正在生成`
        : '课堂生成完成后可导出';
  const sceneProgressLabel = scenes.length ? `共 ${scenes.length} 页课堂内容` : '课堂内容正在编排';
  const sceneGenerationStatusLabel =
    failedSceneGenerationCount > 0
      ? `待重试 ${failedSceneGenerationCount} 页`
      : pendingSceneGenerationCount > 0
        ? `生成中 ${pendingSceneGenerationCount} 页`
        : '当前页已就绪';
  const publishTone =
    classroomMeta?.publishedUrl ? 'emerald' : canPublish ? 'sky' : 'slate';
  const exportTone =
    canExport && !isExporting
      ? 'sky'
      : failedSceneGenerationCount > 0
        ? 'amber'
        : 'slate';
  const deliveryReadinessTone =
    failedSceneGenerationCount > 0
      ? 'amber'
      : pendingSceneGenerationCount > 0 || unsettledCurrentStageMediaTaskCount > 0
        ? 'sky'
        : classroomMeta?.publishedUrl
          ? 'emerald'
          : canExport
            ? 'sky'
            : 'slate';
  const deliveryReadinessLabel =
    failedSceneGenerationCount > 0
      ? '待修复'
      : pendingSceneGenerationCount > 0
        ? '编排中'
        : unsettledCurrentStageMediaTaskCount > 0
          ? '素材中'
          : classroomMeta?.publishedUrl
            ? '已交付'
            : canExport
              ? '可交付'
              : '准备中';
  const deliveryReadinessHint =
    classroomMeta?.publishedUrl && canExport
      ? '课堂已经具备班级分享与课件流转能力，适合直接投屏、发班级群或沉淀归档。'
      : failedSceneGenerationCount > 0
        ? '当前仍有页面生成失败，建议先补齐失败页面，再进行发布与导出。'
        : pendingSceneGenerationCount > 0 || unsettledCurrentStageMediaTaskCount > 0
          ? '课堂还在补全页面或媒体素材，完成后发布和导出会自动变成可用状态。'
          : canExport
          ? '课堂内容已经准备完成，现在可以选择发布给全班，或直接导出课件和资源包。'
            : '课堂生成完成后会自动解锁发布与导出能力。';
  const compactDeliveryHint = classroomMeta?.publishedUrl
    ? '班级观看已就绪'
    : canExport
      ? '现在可直接发布或导出'
      : '资源完成后自动解锁发布与导出';

  const languageRef = useRef<HTMLDivElement>(null);
  const themeRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  const handleClickOutside = useCallback(
    (e: MouseEvent) => {
      if (languageOpen && languageRef.current && !languageRef.current.contains(e.target as Node)) {
        setLanguageOpen(false);
      }
      if (themeOpen && themeRef.current && !themeRef.current.contains(e.target as Node)) {
        setThemeOpen(false);
      }
      if (exportMenuOpen && exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportMenuOpen(false);
      }
    },
    [languageOpen, themeOpen, exportMenuOpen],
  );

  useEffect(() => {
    if (languageOpen || themeOpen || exportMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [languageOpen, themeOpen, exportMenuOpen, handleClickOutside]);

  const buildAudienceShareUrl = useCallback((inputUrl: string) => {
    try {
      const shareUrl = new URL(inputUrl, window.location.origin);
      shareUrl.searchParams.set('audience', '1');
      return shareUrl.toString();
    } catch {
      return inputUrl.includes('?') ? `${inputUrl}&audience=1` : `${inputUrl}?audience=1`;
    }
  }, []);

  const handlePublishClassroom = useCallback(async () => {
    if (!stage) return;

    const publishedUrl = stage.classroomMeta?.publishedUrl
      ? buildAudienceShareUrl(stage.classroomMeta.publishedUrl)
      : null;
    if (publishedUrl) {
      await navigator.clipboard.writeText(publishedUrl);
      setShareCopied(true);
      toast.success('全班观看链接已复制，可直接分享给班级或用于投屏。');
      window.setTimeout(() => setShareCopied(false), 1800);
      return;
    }

    setPublishingClassroom(true);
    try {
      const response = await fetch('/api/classroom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage, scenes }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success || !payload?.url) {
        throw new Error(payload?.error || 'Failed to publish classroom');
      }

      const audienceShareUrl = buildAudienceShareUrl(payload.url);
      await navigator.clipboard.writeText(audienceShareUrl);
      if (stage.classroomMeta) {
        const deliveredAt = new Date().toISOString();
        updateStage({
          classroomMeta: appendClassroomDeliveryRecord(
            {
              ...stage.classroomMeta,
              publishedUrl: audienceShareUrl,
              publishedAt: deliveredAt,
            },
            {
              kind: 'publish',
              format: 'share-link',
              createdAt: deliveredAt,
              audienceMode: stage.classroomMeta.audienceMode,
              publishedUrl: audienceShareUrl,
            },
          ),
        });

        void syncClassroomDeliveryAudit({
          stageId: stage.id,
          stageName: stage.name,
          classroomMeta: {
            ...stage.classroomMeta,
            publishedUrl: audienceShareUrl,
            publishedAt: deliveredAt,
          },
          record: {
            kind: 'publish',
            format: 'share-link',
            createdAt: deliveredAt,
            publishedUrl: audienceShareUrl,
          },
        }).catch(() => undefined);
      }
      setShareCopied(true);
      toast.success('全班观看链接已生成并复制，班级现在可以直接打开观看。');
      window.setTimeout(() => setShareCopied(false), 1800);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '全班观看链接发布失败，请稍后重试。');
    } finally {
      setPublishingClassroom(false);
    }
  }, [buildAudienceShareUrl, scenes, stage, updateStage]);

  return (
    <>
      <header className="z-10 flex flex-wrap items-start justify-between gap-x-3 gap-y-2 bg-transparent px-3.5 py-1.5 lg:px-4">
        <div className="flex min-w-0 flex-1 basis-[420px] items-start gap-2.5">
          <button
            onClick={() => router.push('/')}
            className={cn(classroomIconButton, 'mt-0.5 h-9 w-9 shrink-0')}
            title={t('generation.backToHome')}
          >
            <ArrowLeft className="h-[18px] w-[18px]" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <ClassroomBrand
                size="sm"
                showSubtitle={false}
                className="origin-left scale-[0.84] sm:scale-[0.94]"
              />
              <span className={classroomTonePill('slate', 'px-2 py-0.5 text-[9px] tracking-[0.12em]')}>
                {stage?.classroomMeta?.className
                  ? `${stage.classroomMeta.className} · 当前讲解页`
                  : '当前讲解页'}
              </span>
              {teacherDisplayName || learnerDisplayName ? (
                <span className={classroomTonePill('slate', 'px-2 py-0.5 text-[9px] font-medium tracking-normal normal-case')}>
                  {teacherDisplayName ? '主讲：' : '学习者：'}
                  {teacherDisplayName || learnerDisplayName}
                </span>
              ) : null}
              {classroomMeta ? (
                <details className="group relative">
                  <summary
                    className={cn(
                      classroomTonePill('slate'),
                      'list-none inline-flex cursor-pointer items-center gap-1.5 px-2 py-0.5 text-[9px] font-medium shadow-sm transition hover:bg-white',
                    )}
                  >
                    <span>课堂设定</span>
                    <ChevronDown className="h-3 w-3 transition group-open:rotate-180" />
                  </summary>
                  <div
                    className={cn(
                      classroomPanel,
                      'mt-2 grid w-[min(92vw,420px)] gap-3 p-3 text-left shadow-[0_18px_60px_rgba(15,23,42,0.14)] lg:absolute lg:left-0 lg:top-full lg:z-40',
                    )}
                  >
                    <div className="grid gap-2.5 sm:grid-cols-2">
                      <div className={cn(classroomInsetPanel, 'px-3 py-2.5')}>
                        <div className="text-[11px] font-semibold tracking-[0.12em] text-slate-500 dark:text-slate-400">
                          课堂模式
                        </div>
                        <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {deliveryLabel}
                          {learningLabel ? ` · ${learningLabel}` : ''}
                        </div>
                      </div>
                      <div className={cn(classroomInsetPanel, 'px-3 py-2.5')}>
                        <div className="text-[11px] font-semibold tracking-[0.12em] text-slate-500 dark:text-slate-400">
                          导出与发布
                        </div>
                        <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {exportLabel}
                        </div>
                        <div className="mt-1 text-[12px] leading-5 text-slate-500 dark:text-slate-400">
                          {publishedLabel}
                          {deliverySummaryLabel ? ` · ${deliverySummaryLabel}` : ''}
                        </div>
                      </div>
                      <div className={cn(classroomInsetPanel, 'px-3 py-2.5')}>
                        <div className="text-[11px] font-semibold tracking-[0.12em] text-slate-500 dark:text-slate-400">
                          数字老师
                        </div>
                        <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {digitalHumanLabel || teacherDisplayName || '使用课堂主讲配置'}
                        </div>
                      </div>
                      <div className={cn(classroomInsetPanel, 'px-3 py-2.5')}>
                        <div className="text-[11px] font-semibold tracking-[0.12em] text-slate-500 dark:text-slate-400">
                          当前参与角色
                        </div>
                        <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {teacherDisplayName || learnerDisplayName || '课堂角色已自动带入'}
                        </div>
                      </div>
                    </div>
                    <div className={cn(classroomInsetPanel, 'px-3 py-2.5 text-[12px] leading-5 text-slate-600 dark:text-slate-300')}>
                      {publishedStateDescription}
                    </div>
                  </div>
                </details>
              ) : null}
            </div>

            <div className="mt-1.5 flex flex-wrap items-end gap-x-2.5 gap-y-1">
              <h1
                className="min-w-0 text-[14px] font-semibold tracking-tight text-slate-900 dark:text-slate-100 lg:text-[16px]"
                suppressHydrationWarning
              >
                {currentSceneTitle || t('common.loading')}
              </h1>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] leading-5 text-slate-500 dark:text-slate-400">
                <span>{sceneProgressLabel}</span>
                <span className="hidden sm:inline text-slate-300 dark:text-slate-600">/</span>
                <span>{sceneGenerationStatusLabel}</span>
              </div>
            </div>

            {classroomMeta ? (
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <span className={classroomTonePill('sky', 'px-2 py-0.5 text-[9px]')}>
                  {deliveryLabel}
                </span>
                {learningLabel ? (
                  <span className={classroomTonePill('emerald', 'px-2 py-0.5 text-[9px]')}>
                    {learningLabel}
                  </span>
                ) : null}
                <span
                  className={classroomTonePill(
                    deliveryReadinessTone,
                    'px-2 py-0.5 text-[9px] font-medium tracking-normal normal-case',
                  )}
                >
                  交付{deliveryReadinessLabel}
                </span>
                {latestDeliveryFormatLabel ? (
                  <span className={classroomTonePill('slate', 'px-2 py-0.5 text-[9px] font-medium tracking-normal normal-case')}>
                    最近动作：{latestDeliveryFormatLabel}
                  </span>
                ) : null}
                <span className="text-[10px] text-slate-500 dark:text-slate-400">
                  {compactDeliveryHint}
                </span>
              </div>
            ) : null}
          </div>
        </div>

        <div className="ml-auto flex w-full max-w-full flex-wrap items-start justify-between gap-2 lg:w-auto lg:flex-col lg:items-end">
          <div className={classroomToolbarStrip}>
            {/* Language Selector */}
            <div className="relative" ref={languageRef}>
              <button
                onClick={() => {
                  setLanguageOpen(!languageOpen);
                  setThemeOpen(false);
                }}
                className={classroomControlToggle}
              >
                {locale === 'zh-CN' ? 'CN' : 'EN'}
              </button>
              {languageOpen && (
                <div className={cn(classroomDropdownMenu, 'min-w-[120px]')}>
                  <button
                    onClick={() => {
                      setLocale('zh-CN');
                      setLanguageOpen(false);
                    }}
                    className={classroomDropdownItem(locale === 'zh-CN')}
                  >
                    简体中文
                  </button>
                  <button
                    onClick={() => {
                      setLocale('en-US');
                      setLanguageOpen(false);
                    }}
                    className={classroomDropdownItem(locale === 'en-US')}
                  >
                    English
                  </button>
                </div>
              )}
            </div>

            <div className={classroomControlDivider} />

            {/* Theme Selector */}
            <div className="relative" ref={themeRef}>
              <button
                onClick={() => {
                  setThemeOpen(!themeOpen);
                  setLanguageOpen(false);
                }}
                className={classroomControlButton}
              >
                {theme === 'light' && <Sun className="w-4 h-4" />}
                {theme === 'dark' && <Moon className="w-4 h-4" />}
                {theme === 'system' && <Monitor className="w-4 h-4" />}
              </button>
              {themeOpen && (
                <div className={cn(classroomDropdownMenu, 'min-w-[140px]')}>
                  <button
                    onClick={() => {
                      setTheme('light');
                      setThemeOpen(false);
                    }}
                    className={classroomDropdownItem(theme === 'light')}
                  >
                    <Sun className="w-4 h-4" />
                    {t('settings.themeOptions.light')}
                  </button>
                  <button
                    onClick={() => {
                      setTheme('dark');
                      setThemeOpen(false);
                    }}
                    className={classroomDropdownItem(theme === 'dark')}
                  >
                    <Moon className="w-4 h-4" />
                    {t('settings.themeOptions.dark')}
                  </button>
                  <button
                    onClick={() => {
                      setTheme('system');
                      setThemeOpen(false);
                    }}
                    className={classroomDropdownItem(theme === 'system')}
                  >
                    <Monitor className="w-4 h-4" />
                    {t('settings.themeOptions.system')}
                  </button>
                </div>
              )}
            </div>

            <div className={classroomControlDivider} />

            {/* Settings Button */}
            <div className="relative">
              <button
                onClick={() => setSettingsOpen(true)}
                className={cn(
                  classroomControlButton,
                  needsSetup && 'animate-setup-glow',
                )}
              >
                <Settings className="w-4 h-4 group-hover:rotate-90 transition-transform duration-500" />
              </button>
              {needsSetup && (
                <>
                  <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
                    <span className="animate-setup-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-sky-500" />
                  </span>
                </>
              )}
            </div>
          </div>

          {classroomMeta ? (
            <div className="flex w-full flex-wrap items-center justify-end gap-2 lg:w-auto">
              <div
                className={cn(
                  'inline-flex min-h-[46px] min-w-[164px] items-center gap-2.5 rounded-[18px] border px-3 py-2 text-left transition-all',
                  canPublish && !publishingClassroom
                    ? 'border-sky-200/80 bg-[linear-gradient(180deg,rgba(240,249,255,0.94),rgba(255,255,255,0.92))] text-slate-700 shadow-[0_12px_24px_rgba(14,165,233,0.08)] hover:border-sky-300 hover:bg-white dark:border-sky-900/40 dark:bg-sky-950/25 dark:text-slate-100 dark:hover:border-sky-700 dark:hover:bg-slate-900/90'
                    : 'border-slate-200/70 bg-slate-50/72 text-slate-400 opacity-75 dark:border-slate-800/70 dark:bg-slate-900/62 dark:text-slate-500',
                )}
              >
                <button
                  onClick={() => {
                    if (canPublish && !publishingClassroom) {
                      void handlePublishClassroom();
                    }
                  }}
                  disabled={!canPublish || publishingClassroom}
                  title={
                    classroomMeta.publishedUrl
                      ? '复制全班观看地址'
                      : publishingClassroom
                        ? '发布中'
                        : '发布全班观看地址'
                  }
                  className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                >
                  <span
                    className={cn(
                      classroomIconButton,
                      'h-8 w-8 shrink-0',
                      canPublish && !publishingClassroom
                        ? 'border-sky-200/80 bg-white/90 text-sky-700 dark:border-sky-800/60 dark:bg-slate-900/82 dark:text-sky-200'
                        : 'border-slate-200/80 bg-white/82 text-slate-400 dark:border-slate-800/80 dark:bg-slate-900/82 dark:text-slate-500',
                    )}
                  >
                    {publishingClassroom ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : shareCopied ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Link2 className="h-4 w-4" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="block text-xs font-semibold text-slate-900 dark:text-slate-100">
                        {shareActionLabel}
                      </span>
                      <span className={classroomTonePill(publishTone, 'px-2 py-0.5 text-[10px] font-medium tracking-normal normal-case')}>
                        {classroomMeta.publishedUrl ? '已发布' : canPublish ? '可发布' : '未就绪'}
                      </span>
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-5 text-slate-500 dark:text-slate-400">
                      {shareActionHint}
                    </span>
                  </span>
                </button>
              </div>

              <div
                className={cn(
                  'relative min-w-[164px] flex-1 lg:flex-none',
                  exportMenuOpen && 'basis-full lg:basis-auto',
                )}
                ref={exportRef}
              >
                <button
                  onClick={() => {
                    if (canExport && !isExporting) setExportMenuOpen(!exportMenuOpen);
                  }}
                  disabled={!canExport || isExporting}
                  title={
                    canExport
                      ? isExporting
                        ? t('export.exporting')
                        : t('export.pptx')
                      : t('share.notReady')
                  }
                  className={cn(
                    'group inline-flex min-h-[46px] w-full items-center gap-2.5 rounded-[18px] border px-3 py-2 text-left transition-all',
                    canExport && !isExporting
                      ? 'border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(246,250,255,0.92))] text-slate-700 shadow-[0_12px_24px_rgba(15,23,42,0.05)] hover:border-slate-300 hover:bg-white dark:border-slate-800/80 dark:bg-slate-900/68 dark:text-slate-100 dark:hover:border-slate-700 dark:hover:bg-slate-900/92'
                      : 'cursor-not-allowed border-slate-200/70 bg-slate-50/72 text-slate-400 opacity-75 dark:border-slate-800/70 dark:bg-slate-900/62 dark:text-slate-500',
                  )}
                >
                  <span
                    className={cn(
                      classroomIconButton,
                      'h-8 w-8 shrink-0',
                      canExport && !isExporting
                        ? 'border-slate-200/80 bg-slate-50/90 text-slate-700 dark:border-slate-700/80 dark:bg-slate-800/82 dark:text-slate-100'
                        : 'border-slate-200/80 bg-white/82 text-slate-400 dark:border-slate-800/80 dark:bg-slate-900/82 dark:text-slate-500',
                    )}
                  >
                    {isExporting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="block text-xs font-semibold text-slate-900 dark:text-slate-100">
                        {exportActionLabel}
                      </span>
                      <span className={classroomTonePill(exportTone, 'px-2 py-0.5 text-[10px] font-medium tracking-normal normal-case')}>
                        {isExporting ? '导出中' : canExport ? '可导出' : failedSceneGenerationCount > 0 ? '待修复' : '未完成'}
                      </span>
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-5 text-slate-500 dark:text-slate-400">
                      {exportActionHint}
                    </span>
                  </span>
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 shrink-0 text-slate-400 transition-transform dark:text-slate-500',
                      exportMenuOpen && 'rotate-180',
                    )}
                  />
                </button>
                {exportMenuOpen && (
                  <div
                    className={cn(
                      classroomDropdownMenu,
                      'mt-2 w-full min-w-0 lg:absolute lg:right-0 lg:top-full lg:w-auto lg:min-w-[220px]',
                    )}
                  >
                    <button
                      onClick={() => {
                        setExportMenuOpen(false);
                        exportPPTX();
                      }}
                      className="flex w-full items-center gap-2.5 rounded-[14px] px-3 py-2.5 text-left text-sm transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/80"
                    >
                      <FileDown className="w-4 h-4 shrink-0 text-slate-400 dark:text-slate-500" />
                      <div>
                        <div>{classroomMeta ? '导出班级课件（PPTX）' : t('export.pptx')}</div>
                        {classroomMeta ? (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            适合整班投屏、教研备课与常规课件流转
                          </div>
                        ) : null}
                      </div>
                    </button>
                    <button
                      onClick={() => {
                        setExportMenuOpen(false);
                        exportResourcePack();
                      }}
                      className="flex w-full items-center gap-2.5 rounded-[14px] px-3 py-2.5 text-left text-sm transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/80"
                    >
                      <Package className="w-4 h-4 shrink-0 text-slate-400 dark:text-slate-500" />
                      <div>
                        <div>{classroomMeta ? '导出课堂资源包' : t('export.resourcePack')}</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {classroomMeta
                            ? '包含 PPT、互动页面与课堂说明，便于回看、归档和二次分发'
                            : t('export.resourcePackDesc')}
                        </div>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {classroomMeta ? (
            <div className="w-full text-right text-[11px] leading-5 text-slate-500 dark:text-slate-400 lg:max-w-[520px]">
              {deliveryReadinessHint}
            </div>
          ) : null}
        </div>
      </header>
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}

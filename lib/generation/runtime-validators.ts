import type { SceneOutline } from '@/lib/types/generation';
import type {
  CanonicalQuizQuestionType,
  QuizQuestion,
  QuizQuestionTypeInput,
} from '@/lib/types/stage';
import type { WidgetConfig, WidgetType } from '@/lib/types/widgets';

const SUPPORTED_WIDGET_TYPES = new Set<WidgetType>([
  'simulation',
  'diagram',
  'code',
  'game',
  'visualization3d',
]);

const QUIZ_TYPE_ALIAS_MAP: Record<string, CanonicalQuizQuestionType> = {
  single: 'single',
  multiple: 'multiple',
  text: 'short_answer',
  short_answer: 'short_answer',
};

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export function normalizeQuizQuestionType(
  value: unknown,
): CanonicalQuizQuestionType | undefined {
  const normalized = readString(value)?.toLowerCase().replace(/[\s-]+/gu, '_');
  return normalized ? QUIZ_TYPE_ALIAS_MAP[normalized] : undefined;
}

export function normalizeQuizQuestionTypes(
  questionTypes: QuizQuestionTypeInput[] | undefined,
): CanonicalQuizQuestionType[] {
  const normalized = (questionTypes ?? [])
    .map((item) => normalizeQuizQuestionType(item))
    .filter((item): item is CanonicalQuizQuestionType => Boolean(item));

  return normalized.length ? [...new Set(normalized)] : ['single'];
}

export function normalizeQuizQuestion(question: QuizQuestion): QuizQuestion {
  const normalizedType = normalizeQuizQuestionType(question.type) ?? 'single';
  const isShortAnswer = normalizedType === 'short_answer';

  return {
    ...question,
    type: normalizedType,
    options: isShortAnswer ? undefined : question.options,
    answer: isShortAnswer ? undefined : question.answer,
  };
}

export function normalizeQuizOutline(outline: SceneOutline): SceneOutline {
  if (outline.type !== 'quiz' || !outline.quizConfig) return outline;

  return {
    ...outline,
    quizConfig: {
      ...outline.quizConfig,
      questionTypes: normalizeQuizQuestionTypes(outline.quizConfig.questionTypes),
    },
  };
}

function normalizeWidgetType(value: unknown): WidgetType | undefined {
  const normalized = readString(value) as WidgetType | undefined;
  return normalized && SUPPORTED_WIDGET_TYPES.has(normalized) ? normalized : undefined;
}

function normalizeWidgetOutlineShape(
  widgetOutline: SceneOutline['widgetOutline'],
  widgetType?: WidgetType,
): WidgetConfig | Record<string, unknown> | SceneOutline['widgetOutline'] {
  if (!widgetOutline) return widgetOutline;

  const record = asRecord(widgetOutline);
  if (!record) return widgetOutline;

  const normalizedType = normalizeWidgetType(record.type) ?? widgetType;
  if (!normalizedType) return record;

  return {
    ...record,
    type: normalizedType,
  };
}

export function normalizeInteractiveOutline(outline: SceneOutline): SceneOutline {
  if (outline.type !== 'interactive') return outline;

  const widgetType =
    normalizeWidgetType(outline.widgetType) ??
    normalizeWidgetType(asRecord(outline.widgetOutline)?.type);
  const widgetOutline = normalizeWidgetOutlineShape(outline.widgetOutline, widgetType);
  const interactiveConfig = outline.interactiveConfig
    ? {
        ...outline.interactiveConfig,
        conceptName: readString(outline.interactiveConfig.conceptName) || outline.title,
        conceptOverview:
          readString(outline.interactiveConfig.conceptOverview) || outline.description,
        designIdea: readString(outline.interactiveConfig.designIdea) || outline.description,
        subject: readString(outline.interactiveConfig.subject),
      }
    : outline.interactiveConfig;

  return {
    ...outline,
    widgetType,
    widgetOutline,
    interactiveConfig,
  };
}

export function normalizeSceneOutlineRuntime(outline: SceneOutline): SceneOutline {
  if (outline.type === 'quiz') return normalizeQuizOutline(outline);
  if (outline.type === 'interactive') return normalizeInteractiveOutline(outline);
  return outline;
}

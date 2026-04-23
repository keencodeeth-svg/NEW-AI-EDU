import type { SceneOutline } from '@/lib/types/generation';
import type { WidgetConfig, WidgetType } from '@/lib/types/widgets';

const SUPPORTED_WIDGET_TYPES = new Set<WidgetType>([
  'simulation',
  'diagram',
  'code',
  'game',
  'visualization3d',
]);

export function isDeepInteractiveMode(mode?: string): mode is 'deep-interactive' {
  return mode === 'deep-interactive';
}

export function buildDeepInteractivePromptGuidance(mode?: string): string {
  if (!isDeepInteractiveMode(mode)) return '';

  return `
## Deep Interactive Mode

The user enabled Deep Interactive Mode. Design this course as an interactive-first learning experience inspired by OpenMAIC v0.2:

- Prefer hands-on interactive scenes over passive slides when the concept benefits from exploration.
- Target roughly 60-70% interactive scenes and 30-40% slides/quiz transitions, unless the topic is unsuitable.
- Every interactive scene MUST include both \`widgetType\` and \`widgetOutline\`.
- Supported \`widgetType\`: \`simulation\`, \`diagram\`, \`code\`, \`game\`, \`visualization3d\`.
- Still include \`interactiveConfig\` for backward compatibility. Its \`designIdea\` should summarize the widget interactions.
- Simulations must have adjustable variables, reset behavior, and clear cause/effect feedback.
- Games must be real action/puzzle/strategy learning experiences, not plain multiple-choice quizzes.
- Code widgets must include a starter challenge, language, test cases, hints, and a solution idea.
- 3D visualizations must include objects, camera/lighting, and touch-friendly orbit/zoom interactions.
- All widgets must be mobile-first, touch-friendly, and suitable for rendering inside an iframe.
`.trim();
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function stringifyWidgetOutline(widgetOutline: SceneOutline['widgetOutline']): string {
  if (!widgetOutline) return '{}';
  try {
    return JSON.stringify(widgetOutline, null, 2);
  } catch {
    return String(widgetOutline);
  }
}

function widgetTypeFromOutline(outline: SceneOutline): WidgetType | undefined {
  const explicit = outline.widgetType;
  if (explicit && SUPPORTED_WIDGET_TYPES.has(explicit)) return explicit;

  const fromOutline =
    outline.widgetOutline &&
    typeof outline.widgetOutline === 'object' &&
    !Array.isArray(outline.widgetOutline)
      ? (outline.widgetOutline as Partial<WidgetConfig>).type
      : undefined;
  return fromOutline && SUPPORTED_WIDGET_TYPES.has(fromOutline) ? fromOutline : undefined;
}

function inferConceptName(outline: SceneOutline): string {
  const widget = outline.widgetOutline;
  if (widget && typeof widget === 'object' && !Array.isArray(widget)) {
    const record = widget as Record<string, unknown>;
    return (
      readString(record.concept) ||
      readString(record.title) ||
      readString(record.challenge) ||
      readString(record.description) ||
      outline.title
    );
  }
  return outline.title;
}

function inferConceptOverview(outline: SceneOutline): string {
  const widget = outline.widgetOutline;
  if (widget && typeof widget === 'object' && !Array.isArray(widget)) {
    const description = readString((widget as Record<string, unknown>).description);
    if (description) return description;
  }
  return outline.description;
}

export function normalizeDeepInteractiveOutline(outline: SceneOutline): SceneOutline {
  if (outline.type !== 'interactive') return outline;
  if (outline.interactiveConfig) return outline;

  const widgetType = widgetTypeFromOutline(outline);
  if (!widgetType && !outline.widgetOutline) return outline;

  const widgetJson = stringifyWidgetOutline(outline.widgetOutline);
  const designIdea = [
    `Render this as a ${widgetType || 'interactive'} widget.`,
    'Use the structured widget outline below as the source of truth.',
    'The page must be mobile-first, touch-friendly, resettable, and safe to run in an iframe.',
    widgetType === 'game'
      ? 'If this is a game, students must control meaningful game mechanics instead of only answering questions.'
      : '',
    widgetType === 'code'
      ? 'If this is a code widget, include an editor-like starter challenge, visible tests, hints, and a solution reveal.'
      : '',
    widgetType === 'visualization3d'
      ? 'If this is a 3D widget, use performant geometry, clear lighting, camera controls, and fallback labels.'
      : '',
    `Widget outline JSON:\n${widgetJson}`,
  ]
    .filter(Boolean)
    .join('\n\n');

  return {
    ...outline,
    widgetType,
    interactiveConfig: {
      conceptName: inferConceptName(outline),
      conceptOverview: inferConceptOverview(outline),
      designIdea,
      subject: readString((outline.widgetOutline as Record<string, unknown> | undefined)?.subject),
    },
  };
}

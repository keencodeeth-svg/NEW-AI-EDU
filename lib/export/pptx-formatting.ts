export const DEFAULT_EXPORT_FILENAME_MAX_BYTES = 120;

const MANUAL_BULLET_PREFIX_RE = /^\s*[•·▪◦‣●○■◆\-]\s*/u;
const MANUAL_NUMBER_PREFIX_RE =
  /^\s*(?:\(?\d+\)?[.)、]|[A-Za-z][.)]|[一二三四五六七八九十]+、)\s*/u;
const PPTX_SP_AUTOFIT_RE = /<a:spAutoFit\/>/g;
const PPTX_PARA_SPACE_BEFORE_RE = /<a:spcBef><a:spcPts val="\d+"\/><\/a:spcBef>/g;
const HTML_BREAK_RE = /<br\s*\/?>/giu;
const HTML_BLOCK_END_RE = /<\/(?:p|div|li|ul|ol|h[1-6]|table|tr|section)>/giu;
const HTML_EMPTY_BLOCK_RE = /<(?:p|div)>(?:\s|&nbsp;|<br\s*\/?>)*<\/(?:p|div)>/giu;
const HTML_TAG_RE = /<[^>]+>/gu;

export function sanitizeFileNameSegment(value?: string | null) {
  return (value || '')
    .trim()
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function utf8ByteLength(value: string) {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(value).length;
  }
  return unescape(encodeURIComponent(value)).length;
}

export function truncateUtf8(value: string, maxBytes: number) {
  const trimmed = value.trim();
  if (!trimmed || maxBytes <= 0) return '';
  if (utf8ByteLength(trimmed) <= maxBytes) return trimmed;

  let output = '';
  for (const char of trimmed) {
    const next = `${output}${char}`;
    if (utf8ByteLength(next) > maxBytes) break;
    output = next;
  }

  return output.replace(/[-\s]+$/g, '');
}

export function buildTruncatedExportBaseName(input: {
  className?: string | null;
  subject?: string | null;
  learningModeLabel?: string | null;
  stageName?: string | null;
  fallback: string;
  maxBytes?: number;
}) {
  const {
    className,
    subject,
    learningModeLabel,
    stageName,
    fallback,
    maxBytes = DEFAULT_EXPORT_FILENAME_MAX_BYTES,
  } = input;

  const prefix = [className, subject, learningModeLabel]
    .map((item) => sanitizeFileNameSegment(item))
    .filter(Boolean)
    .join('-');

  const safeFallback = sanitizeFileNameSegment(fallback) || 'export';
  const safeStageName = sanitizeFileNameSegment(stageName);

  if (!prefix && !safeStageName) {
    return safeFallback;
  }

  const reservedBytes = prefix ? utf8ByteLength(`${prefix}-`) : 0;
  const stageNameBudget = Math.max(24, maxBytes - reservedBytes);
  const compactStageName = truncateUtf8(safeStageName, stageNameBudget);
  const combined = [prefix, compactStageName].filter(Boolean).join('-') || prefix || safeFallback;

  return truncateUtf8(combined, maxBytes) || safeFallback;
}

export function detectParagraphListMarker(text: string) {
  const bulletMatch = text.match(MANUAL_BULLET_PREFIX_RE);
  if (bulletMatch) {
    return {
      kind: 'bullet' as const,
      text: text.slice(bulletMatch[0].length).trimStart(),
    };
  }

  const numberMatch = text.match(MANUAL_NUMBER_PREFIX_RE);
  if (numberMatch) {
    return {
      kind: 'number' as const,
      text: text.slice(numberMatch[0].length).trimStart(),
    };
  }

  return null;
}

export function isBoldFontWeight(value?: string | null) {
  if (!value) return false;
  if (value === 'bold' || value === 'bolder') return true;
  const numeric = Number.parseInt(value, 10);
  return Number.isFinite(numeric) && numeric >= 600;
}

export function normalizeLineSpacingMultiple(value?: number, fallback = 1.18) {
  if (!value || Number.isNaN(value)) return fallback;
  return Math.min(1.45, Math.max(1.02, value));
}

function decodeBasicHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/giu, ' ')
    .replace(/&gt;/giu, '>')
    .replace(/&lt;/giu, '<')
    .replace(/&amp;/giu, '&')
    .replace(/&quot;/giu, '"')
    .replace(/&#39;/giu, "'");
}

export function normalizeHtmlForPptxText(value: string) {
  return value
    .replace(HTML_EMPTY_BLOCK_RE, '')
    .replace(/(?:<br\s*\/?>\s*){3,}/giu, '<br />')
    .replace(/<\/p>\s*<p>/giu, '</p><p>')
    .trim();
}

export function extractPlainTextFromHtml(value: string) {
  return decodeBasicHtmlEntities(
    value
      .replace(HTML_BREAK_RE, '\n')
      .replace(HTML_BLOCK_END_RE, '\n')
      .replace(HTML_TAG_RE, ' ')
      .replace(/\r/gu, '')
      .replace(/[ \t]+\n/gu, '\n')
      .replace(/\n[ \t]+/gu, '\n')
      .replace(/[ \t]{2,}/gu, ' ')
      .replace(/\n{3,}/gu, '\n\n'),
  ).trim();
}

export function buildAdaptivePptxTextLayout(input: {
  html: string;
  widthPx: number;
  heightPx: number;
  textType?: string | null;
  baseFontSize: number;
  baseLineSpacing: number;
  baseMargin: number;
  baseParaSpaceAfter: number;
}) {
  const {
    html,
    widthPx,
    heightPx,
    textType,
    baseFontSize,
    baseLineSpacing,
    baseMargin,
    baseParaSpaceAfter,
  } = input;

  const normalizedHtml = normalizeHtmlForPptxText(html);
  const plainText = extractPlainTextFromHtml(normalizedHtml);
  const isHeadline = ['title', 'subtitle', 'header', 'itemTitle'].includes(textType || '');

  if (!plainText) {
    return {
      normalizedHtml,
      plainText,
      fontSize: baseFontSize,
      lineSpacingMultiple: baseLineSpacing,
      margin: baseMargin,
      paraSpaceAfter: baseParaSpaceAfter,
    };
  }

  const charCount = plainText.length;
  const paragraphs = plainText.split(/\n+/u).filter(Boolean);
  const charsPerLineBudget =
    widthPx < 220 ? 10 : widthPx < 320 ? 15 : widthPx < 480 ? 22 : widthPx < 720 ? 30 : 38;
  const approxLineCount = paragraphs.reduce((total, paragraph) => {
    return total + Math.max(1, Math.ceil(paragraph.length / charsPerLineBudget));
  }, 0);
  const density = charCount / Math.max(widthPx * heightPx, 1);

  let fontScale = 1;
  if (!isHeadline && (charCount > 220 || approxLineCount > 8 || density > 0.0026)) {
    fontScale = 0.94;
  }
  if (!isHeadline && (charCount > 320 || approxLineCount > 12 || density > 0.0037 || heightPx < 170)) {
    fontScale = 0.88;
  }
  if (!isHeadline && (charCount > 440 || approxLineCount > 16 || density > 0.0048 || heightPx < 120)) {
    fontScale = 0.82;
  }
  if (isHeadline && (charCount > 80 || approxLineCount > 4 || density > 0.0022)) {
    fontScale = 0.92;
  }

  const lineSpacingMultiple =
    fontScale <= 0.82
      ? Math.max(1.04, Math.min(baseLineSpacing, 1.08))
      : fontScale <= 0.88
        ? Math.max(1.06, Math.min(baseLineSpacing, 1.1))
        : fontScale <= 0.94
          ? Math.max(1.08, Math.min(baseLineSpacing, 1.14))
          : baseLineSpacing;
  const marginScale = fontScale <= 0.88 ? 0.55 : fontScale <= 0.94 ? 0.78 : 1;
  const paraScale = fontScale <= 0.88 ? 0.45 : fontScale <= 0.94 ? 0.72 : 1;

  return {
    normalizedHtml,
    plainText,
    fontSize: Math.max(10, Number((baseFontSize * fontScale).toFixed(2))),
    lineSpacingMultiple: Number(lineSpacingMultiple.toFixed(2)),
    margin: Math.max(0, Number((baseMargin * marginScale).toFixed(2))),
    paraSpaceAfter: Math.max(0.2, Number((baseParaSpaceAfter * paraScale).toFixed(2))),
  };
}

export function cleanupPptxSlideXml(xml: string) {
  return xml
    .replace(PPTX_SP_AUTOFIT_RE, '')
    .replace(PPTX_PARA_SPACE_BEFORE_RE, '');
}

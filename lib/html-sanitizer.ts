const BLOCKED_TAGS = new Set([
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "link",
  "meta",
  "base",
  "form",
  "input",
  "button",
  "textarea",
  "select",
  "option",
  "frame",
  "frameset",
  "applet",
  "portal",
  "template",
  "slot",
  "noscript",
  "svg",
  "canvas",
  "img",
  "audio",
  "video",
  "source",
  "track",
]);

const SELF_CLOSING_TAGS = new Set(["br", "hr", "wbr"]);
const URL_ATTRS = new Set(["href", "src", "xlink:href", "formaction", "poster"]);
const DROP_ATTRS = new Set(["srcset", "srcdoc", "is", "nonce", "integrity", "crossorigin"]);

const COMMENT_RE = /<!--[\s\S]*?-->/g;
const PROCESSING_INSTRUCTION_RE = /<\?[\s\S]*?\?>/g;
const DOCTYPE_RE = /<!DOCTYPE[\s\S]*?>/gi;
const ATTR_RE = /([^\s"'`=<>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'`=<>]+)))?/g;
const TAG_RE = /<\/?[a-zA-Z0-9:-]+\b[^>]*>/g;
const BLOCKED_TAG_PATTERN = Array.from(BLOCKED_TAGS).join("|");
const BLOCKED_TAG_BLOCK_RE = new RegExp(
  `<\\s*(${BLOCKED_TAG_PATTERN})\\b[^>]*>[\\s\\S]*?<\\s*\\/\\s*\\1\\s*>`,
  "gi",
);
const BLOCKED_SINGLE_TAG_RE = new RegExp(`<\\s*(${BLOCKED_TAG_PATTERN})\\b[^>]*\\/??\\s*>`, "gi");
const UNSAFE_STYLE_VALUE_RE =
  /expression\s*\(|javascript:|vbscript:|@import|url\s*\(|-moz-binding|behavior\s*:|behaviour\s*:|data:text\/html/i;
const CONTROL_RE = /[\u0000-\u001F\u007F]+/g;
const CONTROL_AND_SPACE_RE = /[\u0000-\u0020\u007F]+/g;

const HTML_ENTITY_MAP: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  colon: ":",
  tab: "\t",
  newline: "\n",
};

export type SanitizeHtmlOptions = {
  allowDataImage?: boolean;
};

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

function decodeHtmlEntities(value: string): string {
  return value.replace(/&(#(?:x[0-9a-f]+|\d+)|[a-z]+);?/gi, (match, entity: string) => {
    if (entity.startsWith("#x") || entity.startsWith("#X")) {
      const parsed = Number.parseInt(entity.slice(2), 16);
      return Number.isFinite(parsed) ? String.fromCodePoint(parsed) : match;
    }
    if (entity.startsWith("#")) {
      const parsed = Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(parsed) ? String.fromCodePoint(parsed) : match;
    }
    return HTML_ENTITY_MAP[entity.toLowerCase()] ?? match;
  });
}

function sanitizeInlineStyle(style: string): string {
  const safeDeclarations: string[] = [];

  style
    .split(";")
    .map((declaration) => declaration.trim())
    .filter(Boolean)
    .forEach((declaration) => {
      const separatorIndex = declaration.indexOf(":");
      if (separatorIndex <= 0) {
        return;
      }

      const property = declaration.slice(0, separatorIndex).trim().toLowerCase();
      const value = declaration.slice(separatorIndex + 1).trim().replace(/\s+/g, " ");

      if (!property || !value || !/^[a-z-]+$/.test(property)) {
        return;
      }
      if (UNSAFE_STYLE_VALUE_RE.test(value)) {
        return;
      }

      safeDeclarations.push(`${property}: ${value}`);
    });

  return safeDeclarations.join("; ");
}

function isSafeUrl(value: string, options: SanitizeHtmlOptions): boolean {
  const decoded = decodeHtmlEntities(value).replace(CONTROL_AND_SPACE_RE, "").toLowerCase();
  if (!decoded) return true;
  if (
    decoded.startsWith("#") ||
    decoded.startsWith("/") ||
    decoded.startsWith("./") ||
    decoded.startsWith("../") ||
    decoded.startsWith("?")
  ) {
    return true;
  }
  if (
    decoded.startsWith("http://") ||
    decoded.startsWith("https://") ||
    decoded.startsWith("mailto:") ||
    decoded.startsWith("tel:") ||
    decoded.startsWith("blob:")
  ) {
    return true;
  }
  if (options.allowDataImage && decoded.startsWith("data:image/")) {
    return true;
  }
  return false;
}

function sanitizeTag(tag: string, options: SanitizeHtmlOptions): string {
  const trimmed = tag.trim();
  const closingMatch = /^<\s*\/\s*([a-zA-Z0-9:-]+)\s*>$/.exec(trimmed);
  if (closingMatch) {
    const tagName = closingMatch[1].toLowerCase();
    return BLOCKED_TAGS.has(tagName) ? "" : `</${closingMatch[1]}>`;
  }

  const openingMatch = /^<\s*([a-zA-Z0-9:-]+)([\s\S]*?)\/?\s*>$/.exec(trimmed);
  if (!openingMatch) {
    return "";
  }

  const rawTagName = openingMatch[1];
  const tagName = rawTagName.toLowerCase();
  if (BLOCKED_TAGS.has(tagName)) {
    return "";
  }

  const rawAttributes = openingMatch[2] ?? "";
  const attributes: string[] = [];
  const seenAttributes = new Set<string>();
  let targetBlank = false;
  let hasRel = false;

  ATTR_RE.lastIndex = 0;
  let match: RegExpExecArray | null = ATTR_RE.exec(rawAttributes);
  while (match) {
    const rawName = match[1]?.trim();
    if (!rawName) {
      match = ATTR_RE.exec(rawAttributes);
      continue;
    }

    const normalizedName = rawName.replace(/[^\w:-]+/g, "");
    const lowerName = normalizedName.toLowerCase();
    if (
      !normalizedName ||
      seenAttributes.has(lowerName) ||
      lowerName.startsWith("on") ||
      DROP_ATTRS.has(lowerName)
    ) {
      match = ATTR_RE.exec(rawAttributes);
      continue;
    }

    seenAttributes.add(lowerName);

    const hasExplicitValue = match[0].includes("=");
    const rawValue = match[2] ?? match[3] ?? match[4] ?? "";
    const cleanedValue = rawValue.replace(CONTROL_RE, " ").replace(/\s+/g, " ").trim();

    if (!hasExplicitValue) {
      attributes.push(normalizedName);
      match = ATTR_RE.exec(rawAttributes);
      continue;
    }

    if (lowerName === "style") {
      const safeStyle = sanitizeInlineStyle(cleanedValue);
      if (safeStyle) {
        attributes.push(`${normalizedName}="${escapeAttribute(safeStyle)}"`);
      }
      match = ATTR_RE.exec(rawAttributes);
      continue;
    }

    if (URL_ATTRS.has(lowerName)) {
      if (isSafeUrl(cleanedValue, options)) {
        attributes.push(`${normalizedName}="${escapeAttribute(cleanedValue)}"`);
      }
      match = ATTR_RE.exec(rawAttributes);
      continue;
    }

    if (lowerName === "target") {
      if (["_blank", "_self", "_parent", "_top"].includes(cleanedValue)) {
        targetBlank = cleanedValue === "_blank";
        attributes.push(`${normalizedName}="${escapeAttribute(cleanedValue)}"`);
      }
      match = ATTR_RE.exec(rawAttributes);
      continue;
    }

    if (lowerName === "rel") {
      const safeRel = cleanedValue.replace(/[^a-zA-Z0-9\s_-]/g, " ").replace(/\s+/g, " ").trim();
      if (safeRel) {
        hasRel = true;
        attributes.push(`${normalizedName}="${escapeAttribute(safeRel)}"`);
      }
      match = ATTR_RE.exec(rawAttributes);
      continue;
    }

    const safeValue = cleanedValue.replace(/[<>]/g, "");
    attributes.push(`${normalizedName}="${escapeAttribute(safeValue)}"`);
    match = ATTR_RE.exec(rawAttributes);
  }

  if (tagName === "a" && targetBlank && !hasRel) {
    attributes.push('rel="noopener noreferrer"');
  }

  const isSelfClosing = SELF_CLOSING_TAGS.has(tagName) || /\/\s*>$/.test(trimmed);
  return `<${rawTagName}${attributes.length ? ` ${attributes.join(" ")}` : ""}${isSelfClosing ? " />" : ">"}`;
}

export function sanitizeHtmlFragment(input: string, options: SanitizeHtmlOptions = {}): string {
  if (!input) return "";

  return String(input)
    .replace(COMMENT_RE, "")
    .replace(PROCESSING_INSTRUCTION_RE, "")
    .replace(DOCTYPE_RE, "")
    .replace(BLOCKED_TAG_BLOCK_RE, "")
    .replace(BLOCKED_SINGLE_TAG_RE, "")
    .replace(TAG_RE, (tag) => sanitizeTag(tag, options))
    .trim();
}

export function sanitizeMathHtml(input: string): string {
  return sanitizeHtmlFragment(input);
}

export function sanitizeCodeHtml(input: string): string {
  return sanitizeHtmlFragment(input);
}

'use client';

import { useEffect, useMemo, useState } from 'react';
import type { PPTCodeElement } from '@/lib/types/slides';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- shiki highlighter is loaded dynamically
let highlighterPromise: Promise<any> | null = null;

function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = import('shiki').then(({ createHighlighter }) =>
      createHighlighter({
        themes: ['github-light'],
        langs: [
          'plaintext',
          'python',
          'javascript',
          'typescript',
          'json',
          'go',
          'rust',
          'java',
          'c',
          'cpp',
          'html',
          'css',
          'bash',
          'sql',
          'yaml',
          'markdown',
          'jsx',
          'tsx',
        ],
      }),
    );
  }

  return highlighterPromise;
}

function escapeHtml(input: string) {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function parseShikiLines(html: string): string[] {
  const codeMatch = html.match(/<code>([\s\S]*?)<\/code>/);
  if (!codeMatch) return [];

  const parts = codeMatch[1].split('<span class="line">');
  const lines: string[] = [];
  for (const part of parts) {
    if (!part) continue;
    const endIndex = part.lastIndexOf('</span>');
    if (endIndex !== -1) {
      lines.push(part.substring(0, endIndex));
    }
  }
  return lines;
}

function normalizeLanguage(language: string) {
  const normalized = language.trim().toLowerCase();
  if (!normalized) return 'plaintext';
  if (normalized === 'js') return 'javascript';
  if (normalized === 'ts') return 'typescript';
  if (normalized === 'sh' || normalized === 'shell') return 'bash';
  if (normalized === 'yml') return 'yaml';
  return normalized;
}

export interface BaseCodeElementProps {
  elementInfo: PPTCodeElement;
  animate?: boolean;
  target?: string;
  selectElement?: (e: React.MouseEvent | React.TouchEvent, element: PPTCodeElement) => void;
}

export function BaseCodeElement({
  elementInfo,
  target,
  selectElement,
}: BaseCodeElementProps) {
  const [highlightedState, setHighlightedState] = useState<{
    key: string;
    lines: string[];
  } | null>(null);

  const code = useMemo(
    () => elementInfo.lines.map((line) => line.content).join('\n'),
    [elementInfo.lines],
  );
  const fallbackLines = useMemo(
    () => elementInfo.lines.map((line) => escapeHtml(line.content || ' ')),
    [elementInfo.lines],
  );
  const highlightKey = useMemo(
    () => `${normalizeLanguage(elementInfo.language)}::${code}`,
    [code, elementInfo.language],
  );

  useEffect(() => {
    let cancelled = false;

    void getHighlighter()
      .then((highlighter) => {
        const html = highlighter.codeToHtml(code, {
          lang: normalizeLanguage(elementInfo.language),
          theme: 'github-light',
        });
        const parsed = parseShikiLines(html);
        if (!cancelled && parsed.length > 0) {
          setHighlightedState({
            key: highlightKey,
            lines: parsed,
          });
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [code, elementInfo.language, highlightKey]);

  const highlightedLines =
    highlightedState?.key === highlightKey ? highlightedState.lines : fallbackLines;

  const handleSelectElement = (e: React.MouseEvent | React.TouchEvent) => {
    if (!selectElement || elementInfo.lock) return;
    e.stopPropagation();
    selectElement(e, elementInfo);
  };

  const bodyHeight = Math.max(elementInfo.height - 34, 48);
  const isThumbnail = target === 'thumbnail';

  return (
    <div
      className={`absolute ${elementInfo.lock ? 'lock' : ''}`}
      style={{
        top: `${elementInfo.top}px`,
        left: `${elementInfo.left}px`,
        width: `${elementInfo.width}px`,
        height: `${elementInfo.height}px`,
      }}
    >
      <div
        className="w-full h-full"
        style={{ transform: `rotate(${elementInfo.rotate}deg)` }}
        onMouseDown={handleSelectElement}
        onTouchStart={handleSelectElement}
      >
        <div
          className={`relative h-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm ${
            selectElement && !elementInfo.lock ? 'cursor-move' : ''
          } ${isThumbnail ? 'pointer-events-none' : ''}`}
        >
          <div className="flex h-[34px] items-center justify-between border-b border-slate-200 bg-slate-50 px-3">
            <span className="truncate text-[11px] font-medium text-slate-700">
              {elementInfo.fileName || 'snippet'}
            </span>
            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-600">
              {elementInfo.language || 'code'}
            </span>
          </div>

          <div
            className="overflow-hidden bg-slate-950/2"
            style={{
              height: `${bodyHeight}px`,
            }}
          >
            <div
              className="h-full overflow-auto px-0 py-2 font-mono leading-6 text-slate-900"
              style={{
                fontSize: `${elementInfo.fontSize ?? 14}px`,
              }}
            >
              {elementInfo.lines.map((line, index) => (
                <div key={line.id} className="flex min-w-full items-start px-3">
                  {elementInfo.showLineNumbers !== false && (
                    <span className="mr-3 w-7 shrink-0 select-none text-right text-[11px] text-slate-400">
                      {index + 1}
                    </span>
                  )}
                  <span
                    className="block min-w-0 flex-1 whitespace-pre"
                    dangerouslySetInnerHTML={{
                      __html: highlightedLines[index] || escapeHtml(line.content || ' '),
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

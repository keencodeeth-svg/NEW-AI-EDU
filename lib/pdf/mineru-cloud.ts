import JSZip from 'jszip';
import type { PDFParserConfig } from './types';
import type { ParsedPdfContent } from '@/lib/types/pdf';
import { MINERU_CLOUD_DEFAULT_BASE } from './constants';
import { extractMinerUResult } from './mineru-parser';
import { createLogger } from '@/lib/logger';

const log = createLogger('MinerUCloud');

const TIMEOUTS = {
  batch: 60_000,
  upload: 180_000,
  poll: 30_000,
  zip: 180_000,
} as const;

const POLL_INTERVAL_MS = 2_500;
const POLL_MAX_MS = 15 * 60 * 1_000;

const MIME_MAP: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
};

interface MinerUEnvelope<T = unknown> {
  code: number;
  msg: string;
  data: T;
}

interface BatchExtractRow {
  file_name?: string;
  state?: string;
  full_zip_url?: string;
  err_msg?: string;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function extToMime(ext: string) {
  return MIME_MAP[ext.toLowerCase()] ?? 'application/octet-stream';
}

function sanitizeFileName(name: string | undefined): string {
  const fallback = 'document.pdf';
  const raw = (name ?? fallback).split(/[/\\]/).pop()?.trim() ?? fallback;
  const trimmed = raw.slice(0, 240);

  if (!trimmed) return fallback;
  if (trimmed.includes('..')) return fallback;
  if (!trimmed.toLowerCase().endsWith('.pdf')) return fallback;

  return trimmed;
}

function isRetryable(error: unknown) {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return ['fetch failed', 'econnreset', 'etimedout', 'timeout', 'aborted'].some((term) =>
    message.includes(term),
  );
}

async function fetchWithRetry<T>(
  fn: () => Promise<T>,
  context: string,
  attempts = 4,
): Promise<T> {
  let lastError: unknown;

  for (let index = 1; index <= attempts; index++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isRetryable(error) || index === attempts) break;
      log.warn(`[MinerU Cloud] ${context} retry ${index}/${attempts}:`, error);
      await sleep(400 * index);
    }
  }

  const message = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`MinerU Cloud ${context} failed: ${message}`);
}

async function readMinerUJson<T>(response: Response, context: string): Promise<T> {
  const text = await response.text();
  let json: MinerUEnvelope<T>;

  try {
    json = JSON.parse(text) as MinerUEnvelope<T>;
  } catch {
    throw new Error(
      `MinerU Cloud ${context}: invalid JSON (HTTP ${response.status}): ${text.slice(0, 500)}`,
    );
  }

  if (!response.ok) {
    throw new Error(
      `MinerU Cloud ${context}: HTTP ${response.status} - ${json.msg || text.slice(0, 300)}`,
    );
  }

  if (json.code !== 0) {
    throw new Error(`MinerU Cloud ${context}: ${json.msg || 'unknown error'} (code ${json.code})`);
  }

  return json.data;
}

async function parseMinerUZip(zipUrl: string): Promise<ParsedPdfContent> {
  const zipResponse = await fetchWithRetry(
    () => fetch(zipUrl, { signal: AbortSignal.timeout(TIMEOUTS.zip) }),
    'ZIP download',
  );

  if (!zipResponse.ok) {
    const text = await zipResponse.text().catch(() => zipResponse.statusText);
    throw new Error(`MinerU Cloud ZIP download failed (${zipResponse.status}): ${text.slice(0, 300)}`);
  }

  let zip: Awaited<ReturnType<typeof JSZip.loadAsync>>;
  try {
    zip = await JSZip.loadAsync(Buffer.from(await zipResponse.arrayBuffer()));
  } catch (error) {
    throw new Error(
      `MinerU Cloud ZIP parse failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const filePaths = Object.keys(zip.files).filter((filePath) => !zip.files[filePath].dir);
  const fullMarkdownPath = filePaths.find((filePath) => /(^|\/)full\.md$/i.test(filePath));
  const contentListPath = filePaths.find(
    (filePath) =>
      filePath.endsWith('_content_list.json') || /(^|\/)content_list\.json$/i.test(filePath),
  );

  if (!fullMarkdownPath) {
    throw new Error(
      `MinerU Cloud ZIP missing full.md. Files: ${filePaths.slice(0, 10).join(', ')}`,
    );
  }

  const markdown = await zip.file(fullMarkdownPath)!.async('string');
  const dirPrefix = fullMarkdownPath.includes('/')
    ? fullMarkdownPath.slice(0, fullMarkdownPath.lastIndexOf('/') + 1)
    : '';

  let contentList: unknown;
  if (contentListPath) {
    const raw = await zip.file(contentListPath)!.async('string');
    try {
      contentList = JSON.parse(raw);
    } catch {
      log.warn('[MinerU Cloud] content_list JSON parse failed, continuing with markdown only');
    }
  }

  async function readImage(relativePath: string): Promise<string | null> {
    const normalized = relativePath.replace(/^\.?\//, '');
    for (const candidate of [dirPrefix + normalized, normalized]) {
      const entry = zip.file(candidate);
      if (!entry) continue;
      const buffer = await entry.async('nodebuffer');
      const ext = candidate.split('.').pop() ?? 'png';
      return `data:${extToMime(ext)};base64,${buffer.toString('base64')}`;
    }
    return null;
  }

  const imageData: Record<string, string> = {};

  if (Array.isArray(contentList)) {
    for (const item of contentList as Array<Record<string, unknown>>) {
      if (item.type !== 'image' || typeof item.img_path !== 'string') continue;
      const base64 = await readImage(item.img_path);
      if (!base64) continue;
      const basename = item.img_path.split('/').pop() ?? item.img_path;
      imageData[basename] = base64;
    }
  }

  for (const filePath of filePaths) {
    if (!/\.(png|jpe?g|webp|gif)$/i.test(filePath)) continue;
    const basename = filePath.split('/').pop() ?? filePath;
    if (imageData[basename]) continue;
    const base64 = await readImage(filePath);
    if (base64) imageData[basename] = base64;
  }

  return extractMinerUResult(
    {
      md_content: markdown,
      images: imageData,
      content_list: contentList,
    },
    'mineru-cloud',
  );
}

export async function parseWithMinerUCloud(
  config: PDFParserConfig,
  pdfBuffer: Buffer,
  sourceFileName?: string,
): Promise<ParsedPdfContent> {
  const token = config.apiKey;
  if (!token) {
    throw new Error('MinerU Cloud API key is required');
  }

  const apiRoot = (config.baseUrl || MINERU_CLOUD_DEFAULT_BASE).replace(/\/+$/, '');
  const uploadFileName = sanitizeFileName(sourceFileName);

  log.info(`[MinerU Cloud] Starting parse: ${uploadFileName} (${pdfBuffer.byteLength} bytes)`);

  const batchData = await fetchWithRetry(async () => {
    const response = await fetch(`${apiRoot}/file-urls/batch`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        files: [{ name: uploadFileName }],
        enable_formula: true,
        enable_table: true,
        model_version: 'vlm',
        language: 'ch',
      }),
      signal: AbortSignal.timeout(TIMEOUTS.batch),
    });

    return readMinerUJson<{ batch_id: string; file_urls?: string[]; files?: string[] }>(
      response,
      'file-urls/batch',
    );
  }, 'create batch');

  const uploadUrls = batchData.file_urls ?? batchData.files;
  if (!batchData.batch_id || !uploadUrls?.length) {
    throw new Error('MinerU Cloud batch response missing batch_id or upload URLs');
  }

  const uploadResponse = await fetchWithRetry(
    () =>
      fetch(uploadUrls[0], {
        method: 'PUT',
        body: new Uint8Array(pdfBuffer),
        signal: AbortSignal.timeout(TIMEOUTS.upload),
      }),
    'presigned upload',
    5,
  );

  if (!uploadResponse.ok) {
    const text = await uploadResponse.text().catch(() => uploadResponse.statusText);
    throw new Error(`MinerU Cloud upload failed (${uploadResponse.status}): ${text.slice(0, 400)}`);
  }

  await sleep(1_500);

  const deadline = Date.now() + POLL_MAX_MS;
  let lastState = '';

  while (Date.now() < deadline) {
    const statusData = await fetchWithRetry(async () => {
      const response = await fetch(`${apiRoot}/extract-results/batch/${batchData.batch_id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(TIMEOUTS.poll),
      });

      return readMinerUJson<{ extract_result?: BatchExtractRow | BatchExtractRow[] }>(
        response,
        'extract-results/batch',
      );
    }, 'poll batch', 3);

    const rows = statusData.extract_result;
    const list = Array.isArray(rows) ? rows : rows ? [rows] : [];
    const row =
      list.find((item) => item.file_name === uploadFileName) ||
      list.find((item) => item.file_name?.toLowerCase() === uploadFileName.toLowerCase()) ||
      list[0];

    if (!row?.state) {
      await sleep(POLL_INTERVAL_MS);
      continue;
    }

    if (row.state !== lastState) {
      lastState = row.state;
      log.info(`[MinerU Cloud] Batch ${batchData.batch_id} -> ${row.state}`);
    }

    if (row.state === 'failed') {
      throw new Error(`MinerU Cloud parsing failed: ${row.err_msg || 'unknown error'}`);
    }

    if (row.state === 'done' && row.full_zip_url) {
      return parseMinerUZip(row.full_zip_url);
    }

    await sleep(POLL_INTERVAL_MS);
  }

  throw new Error(`MinerU Cloud timed out after ${POLL_MAX_MS / 1000}s (batch: ${batchData.batch_id})`);
}

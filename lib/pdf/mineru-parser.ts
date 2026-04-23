import type { ParsedPdfContent } from '@/lib/types/pdf';
import { createLogger } from '@/lib/logger';

const log = createLogger('MinerUParser');

interface MinerUContentListItem {
  type?: unknown;
  img_path?: unknown;
  page_idx?: unknown;
  bbox?: unknown;
  image_caption?: unknown;
}

/**
 * Shared MinerU result parser used by both the self-hosted and cloud variants.
 */
export function extractMinerUResult(
  fileResult: Record<string, unknown>,
  parserId: 'mineru' | 'mineru-cloud' = 'mineru',
): ParsedPdfContent {
  const markdown = typeof fileResult.md_content === 'string' ? fileResult.md_content : '';
  const imageData: Record<string, string> = {};
  let pageCount = 0;

  if (fileResult.images && typeof fileResult.images === 'object') {
    for (const [key, value] of Object.entries(fileResult.images as Record<string, string>)) {
      imageData[key] = value.startsWith('data:') ? value : `data:image/png;base64,${value}`;
    }
  }

  const imageMetaLookup = new Map<string, { pageIdx: number; bbox: number[]; caption?: string }>();
  let contentList: unknown;

  try {
    contentList =
      typeof fileResult.content_list === 'string'
        ? JSON.parse(fileResult.content_list)
        : fileResult.content_list;
  } catch {
    log.warn('[MinerU] content_list JSON parse failed, continuing without metadata');
  }

  if (Array.isArray(contentList)) {
    const pages = new Set(
      contentList
        .map((item: Record<string, unknown>) => item.page_idx)
        .filter((value: unknown) => value != null),
    );
    pageCount = pages.size;

    for (const item of contentList as MinerUContentListItem[]) {
      if (item.type !== 'image' || typeof item.img_path !== 'string') continue;

      const metaEntry = {
        pageIdx: typeof item.page_idx === 'number' ? item.page_idx : 0,
        bbox: Array.isArray(item.bbox) ? item.bbox : [0, 0, 1000, 1000],
        caption: Array.isArray(item.image_caption) ? item.image_caption[0] : undefined,
      };

      imageMetaLookup.set(item.img_path, metaEntry);
      const basename = item.img_path.split('/').pop();
      if (basename && basename !== item.img_path) {
        imageMetaLookup.set(basename, metaEntry);
      }
    }
  }

  const imageMapping: Record<string, string> = {};
  const pdfImages: Array<{
    id: string;
    src: string;
    pageNumber: number;
    description?: string;
    width?: number;
    height?: number;
  }> = [];

  Object.entries(imageData).forEach(([key, base64Url], index) => {
    const imageId = key.startsWith('img_') ? key : `img_${index + 1}`;
    const meta = imageMetaLookup.get(key) || imageMetaLookup.get(`images/${key}`);

    imageMapping[imageId] = base64Url;
    pdfImages.push({
      id: imageId,
      src: base64Url,
      pageNumber: meta ? meta.pageIdx + 1 : 0,
      description: meta?.caption,
      width: meta ? meta.bbox[2] - meta.bbox[0] : undefined,
      height: meta ? meta.bbox[3] - meta.bbox[1] : undefined,
    });
  });

  const images = Object.values(imageMapping);

  log.info(
    `[MinerU] Parsed successfully: ${images.length} images, ${markdown.length} chars of markdown`,
  );

  return {
    text: markdown,
    images,
    metadata: {
      pageCount,
      parser: parserId,
      imageMapping,
      pdfImages,
    },
  };
}

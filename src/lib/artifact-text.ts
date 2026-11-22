import { inflateSync } from 'node:zlib';
import type { ArtifactType } from '@/types/database';

const TEXT_EXTENSIONS = new Set([
  'md',
  'markdown',
  'mdx',
  'txt',
  'text',
  'json',
  'jsonc',
  'csv',
  'tsv',
  'yaml',
  'yml',
  'toml',
  'ini',
  'cfg',
  'conf',
  'env',
  'xml',
  'html',
  'htm',
  'css',
  'scss',
  'less',
  'js',
  'jsx',
  'ts',
  'tsx',
  'py',
  'rb',
  'go',
  'rs',
  'java',
  'kt',
  'kts',
  'swift',
  'c',
  'h',
  'cc',
  'cpp',
  'hpp',
  'cs',
  'php',
  'sh',
  'bash',
  'zsh',
  'ps1',
  'sql',
  'graphql',
  'gql',
  'dockerfile',
  'gitignore',
  'log',
  'rtf',
]);

const TEXT_MIME_PREFIXES = ['text/'];
const TEXT_MIME_TYPES = new Set([
  'application/json',
  'application/ld+json',
  'application/xml',
  'application/x-yaml',
  'application/yaml',
  'application/toml',
  'application/sql',
  'application/javascript',
  'application/typescript',
  'application/x-sh',
  'application/rtf',
]);

export const MAX_STORED_TEXT_CHARS = 400_000;

export function getFileExtension(fileName: string): string {
  const clean = (fileName || '').split(/[?#]/)[0];
  const last = clean.split(/[\\/]/).pop() || '';
  const dot = last.lastIndexOf('.');
  if (dot <= 0) {
    return last.toLowerCase() === 'dockerfile' ? 'dockerfile' : '';
  }
  return last.slice(dot + 1).toLowerCase();
}

export function isTextLikeFile(fileName: string, mimeType?: string | null): boolean {
  const extension = getFileExtension(fileName);
  if (TEXT_EXTENSIONS.has(extension)) return true;

  const mime = (mimeType || '').toLowerCase();
  if (!mime) return false;
  if (TEXT_MIME_PREFIXES.some((prefix) => mime.startsWith(prefix))) return true;
  if (TEXT_MIME_TYPES.has(mime)) return true;
  if (mime.includes('json') || mime.includes('xml') || mime.includes('yaml')) return true;
  return false;
}

export function isPdfFile(fileName: string, mimeType?: string | null): boolean {
  return (
    getFileExtension(fileName) === 'pdf' ||
    (mimeType || '').toLowerCase() === 'application/pdf'
  );
}

export function detectArtifactType(fileName: string, mimeType?: string | null): ArtifactType {
  const extension = getFileExtension(fileName);
  const mime = (mimeType || '').toLowerCase();

  if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(extension)) {
    return 'image';
  }
  if (mime.startsWith('video/') || ['mp4', 'mov', 'webm', 'avi'].includes(extension)) {
    return 'video';
  }
  if (extension === 'apk' || extension === 'aab' || mime.includes('android.package')) {
    return 'apk';
  }
  if (extension === 'json' && mime.includes('lottie')) return 'lottie';
  if (extension === 'riv') return 'riv';
  if (['ppt', 'pptx', 'key', 'odp'].includes(extension)) return 'presentation';
  if (isPdfFile(fileName, mimeType) || isTextLikeFile(fileName, mimeType)) return 'document';
  return 'other';
}

function normalizeText(input: string): string {
  return input
    .replace(/\u0000/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0001-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}

export function truncateText(text: string, maxChars = MAX_STORED_TEXT_CHARS): string {
  const normalized = normalizeText(text);
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, maxChars).trimEnd()}\n\n[Text truncated at ${maxChars.toLocaleString()} characters]`;
}

/**
 * Very small PDF text extractor used as a fallback when pdf-parse is not
 * available (for example in an edge runtime or a stripped deployment).
 * It handles the common FlateDecode + Tj/TJ operators used by most text PDFs.
 */
function extractPdfTextFallback(buffer: Buffer): string {
  const raw = buffer.toString('latin1');
  const chunks: string[] = [];
  const streamRegex = /stream\r?\n([\s\S]*?)endstream/g;
  let match: RegExpExecArray | null;

  while ((match = streamRegex.exec(raw)) !== null) {
    const stream = Buffer.from(match[1], 'latin1');
    let decoded = '';
    try {
      decoded = inflateSync(stream).toString('latin1');
    } catch {
      decoded = stream.toString('latin1');
    }
    if (!decoded) continue;

    const literalStrings = decoded.match(/\((?:\\.|[^\\()])*\)\s*(?:Tj|'|")/g) || [];
    for (const literal of literalStrings) {
      chunks.push(
        literal
          .replace(/\s*(?:Tj|'|")$/, '')
          .slice(1, -1)
          .replace(/\\([nrtbf()\\])/g, (_m, char: string) => {
            const map: Record<string, string> = {
              n: '\n',
              r: '\n',
              t: '\t',
              b: '',
              f: '',
              '(': '(',
              ')': ')',
              '\\': '\\',
            };
            return map[char] ?? char;
          })
      );
    }

    const arrayStrings = decoded.match(/\[(?:[^\]]*?)\]\s*TJ/g) || [];
    for (const array of arrayStrings) {
      const parts = array.match(/\((?:\\.|[^\\()])*\)/g) || [];
      chunks.push(
        parts
          .map((part) =>
            part
              .slice(1, -1)
              .replace(/\\([nrtbf()\\])/g, (_m, char: string) =>
                char === 'n' || char === 'r' ? '\n' : char === 't' ? '\t' : char
              )
          )
          .join('')
      );
    }
  }

  return chunks.join('\n');
}

export async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    // Import the implementation directly (not the package index) so the
    // package's debug-only test fixture is never read at runtime.
    const mod = await import('pdf-parse/lib/pdf-parse.js');
    const pdfParse = (mod as unknown as {
      default?: (data: Buffer) => Promise<{ text?: string }>;
    }).default;
    if (typeof pdfParse === 'function') {
      const parsed = await pdfParse(buffer);
      const text = normalizeText(parsed?.text || '');
      if (text) return text;
    }
  } catch (error) {
    console.warn('[artifact-text] pdf-parse failed, using fallback:', error);
  }

  return normalizeText(extractPdfTextFallback(buffer));
}

export interface ExtractedArtifactText {
  text: string;
  source: 'text' | 'pdf' | 'none';
}

export async function extractArtifactText(input: {
  buffer: Buffer;
  fileName: string;
  mimeType?: string | null;
}): Promise<ExtractedArtifactText> {
  const { buffer, fileName, mimeType } = input;

  if (isPdfFile(fileName, mimeType)) {
    const text = await extractPdfText(buffer);
    return { text: truncateText(text), source: text ? 'pdf' : 'none' };
  }

  if (isTextLikeFile(fileName, mimeType)) {
    const text = truncateText(buffer.toString('utf8'));
    return { text, source: text ? 'text' : 'none' };
  }

  return { text: '', source: 'none' };
}

export function artifactText(artifact: {
  content?: string | null;
  extracted_text?: string | null;
  metadata?: Record<string, unknown> | null;
}): string {
  const metadataText =
    artifact.metadata && typeof artifact.metadata === 'object'
      ? (artifact.metadata as Record<string, unknown>).text
      : null;
  return String(
    artifact.extracted_text || artifact.content || (typeof metadataText === 'string' ? metadataText : '') || ''
  ).trim();
}

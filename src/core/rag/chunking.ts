interface CodeChunk {
  content: string;
  startLine: number;
  endLine: number;
}

export type ChunkingStrategy = 'fixed' | 'semantic' | 'adaptive';

export function chunkCode(
  content: string,
  maxLines: number = 100,
  strategy: ChunkingStrategy = 'adaptive'
): CodeChunk[] {
  switch (strategy) {
    case 'fixed':
      return chunkFixed(content, maxLines);
    case 'semantic':
      return chunkSemantic(content, maxLines);
    case 'adaptive':
      return chunkAdaptive(content, maxLines);
    default:
      return chunkFixed(content, maxLines);
  }
}

function chunkFixed(content: string, maxLines: number): CodeChunk[] {
  const lines = content.split('\n');
  const chunks: CodeChunk[] = [];

  for (let i = 0; i < lines.length; i += maxLines) {
    const chunkLines = lines.slice(i, i + maxLines);
    const chunkContent = chunkLines.join('\n');

    if (chunkContent.trim().length > 0) {
      chunks.push({
        content: chunkContent,
        startLine: i + 1,
        endLine: Math.min(i + maxLines, lines.length),
      });
    }
  }

  return chunks;
}

function chunkSemantic(content: string, maxLines: number): CodeChunk[] {
  const lines = content.split('\n');
  const chunks: CodeChunk[] = [];
  let currentChunk: string[] = [];
  let currentStartLine = 1;

  const isStructureStart = (line: string): boolean => {
    const trimmed = line.trim();
    return (
      trimmed.startsWith('function ') ||
      trimmed.startsWith('class ') ||
      trimmed.startsWith('export function ') ||
      trimmed.startsWith('export class ') ||
      trimmed.startsWith('export const ') ||
      trimmed.startsWith('const ') ||
      trimmed.startsWith('interface ') ||
      trimmed.startsWith('type ') ||
      trimmed.startsWith('def ') ||
      trimmed.startsWith('async function ') ||
      trimmed.startsWith('async def ')
    );
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const shouldSplit = isStructureStart(line) && currentChunk.length >= maxLines / 2;

    if (shouldSplit && currentChunk.length > 0) {
      chunks.push({
        content: currentChunk.join('\n'),
        startLine: currentStartLine,
        endLine: i,
      });
      currentChunk = [line];
      currentStartLine = i + 1;
    } else {
      currentChunk.push(line);

      if (currentChunk.length >= maxLines) {
        chunks.push({
          content: currentChunk.join('\n'),
          startLine: currentStartLine,
          endLine: i + 1,
        });
        currentChunk = [];
        currentStartLine = i + 2;
      }
    }
  }

  if (currentChunk.length > 0) {
    chunks.push({
      content: currentChunk.join('\n'),
      startLine: currentStartLine,
      endLine: lines.length,
    });
  }

  return chunks;
}

function chunkAdaptive(content: string, maxLines: number): CodeChunk[] {
  const lines = content.split('\n');
  const chunks: CodeChunk[] = [];
  let currentChunk: string[] = [];
  let currentStartLine = 1;
  let braceDepth = 0;

  const updateBraceDepth = (line: string): void => {
    for (const char of line) {
      if (char === '{' || char === '[' || char === '(') braceDepth++;
      if (char === '}' || char === ']' || char === ')') braceDepth--;
    }
  };

  const isGoodSplitPoint = (): boolean => {
    return braceDepth === 0 && currentChunk.length > 0;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    currentChunk.push(line);
    updateBraceDepth(line);

    const shouldSplit =
      currentChunk.length >= maxLines &&
      isGoodSplitPoint() &&
      line.trim().length === 0;

    if (shouldSplit) {
      chunks.push({
        content: currentChunk.join('\n'),
        startLine: currentStartLine,
        endLine: i + 1,
      });
      currentChunk = [];
      currentStartLine = i + 2;
    }
  }

  if (currentChunk.length > 0) {
    chunks.push({
      content: currentChunk.join('\n'),
      startLine: currentStartLine,
      endLine: lines.length,
    });
  }

  return chunks;
}

export function estimateChunkQuality(chunk: CodeChunk): number {
  const lines = chunk.content.split('\n');
  let score = 1.0;

  const hasCompleteFunction = /^(export\s+)?(async\s+)?function\s+\w+/.test(chunk.content) &&
    chunk.content.includes('}');
  if (hasCompleteFunction) score += 0.5;

  const hasCompleteClass = /^(export\s+)?class\s+\w+/.test(chunk.content) &&
    chunk.content.includes('}');
  if (hasCompleteClass) score += 0.5;

  const nonEmptyLines = lines.filter(l => l.trim().length > 0).length;
  const density = nonEmptyLines / lines.length;
  score += density * 0.3;

  const avgLineLength = chunk.content.length / lines.length;
  if (avgLineLength > 20 && avgLineLength < 100) score += 0.2;

  return Math.min(score, 2.0);
}

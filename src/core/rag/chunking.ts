import {
  createParserFactory,
  readDirectoryAndChunk,
  parseCodeAndChunk,
  type BoundaryChunk,
  type ParserFactory,
} from 'code-chopper';

export interface CodeChunk {
  content: string;
  filePath: string;
  startLine: number;
  endLine: number;
  metadata: ChunkMetadata;
}

export interface ChunkMetadata {
  name?: string;
  type: string;
  parent?: string[];
  docs?: string;
  language: string;
}

export type ChunkingStrategy = 'ast' | 'fixed' | 'adaptive';

let parserFactory: ParserFactory | null = null;

async function getParserFactory(): Promise<ParserFactory> {
  if (!parserFactory) {
    parserFactory = createParserFactory();
  }
  return parserFactory;
}

export function disposeParserFactory(): void {
  if (parserFactory) {
    parserFactory.dispose();
    parserFactory = null;
  }
}

const LANGUAGE_MAP: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.py': 'python',
  '.rs': 'rust',
  '.go': 'golang',
  '.java': 'java',
  '.c': 'c',
  '.cpp': 'c++',
  '.h': 'c',
  '.hpp': 'c++',
  '.cs': 'c#',
  '.rb': 'ruby',
  '.sh': 'bash',
};

export function getLanguageFromExtension(ext: string): string | null {
  return LANGUAGE_MAP[ext] || null;
}

export function isASTSupported(ext: string): boolean {
  return ext in LANGUAGE_MAP;
}

function boundaryChunkToCodeChunk(chunk: BoundaryChunk): CodeChunk {
  return {
    content: chunk.content,
    filePath: chunk.filePath || '',
    startLine: chunk.start.row + 1,
    endLine: chunk.end.row + 1,
    metadata: {
      name: chunk.boundary.name,
      type: chunk.boundary.type,
      parent: chunk.boundary.parent,
      docs: chunk.boundary.docs,
      language: chunk.language,
    },
  };
}

export async function chunkDirectory(
  directoryPath: string,
  options: { excludeDirs?: RegExp[] } = {}
): Promise<CodeChunk[]> {
  const factory = await getParserFactory();
  const excludeDirs = options.excludeDirs || [/node_modules/, /\.git/, /dist/, /build/];

  const boundaryChunks = await readDirectoryAndChunk(factory, { excludeDirs }, directoryPath);
  return boundaryChunks.map(boundaryChunkToCodeChunk);
}

export async function chunkFile(
  content: string,
  filePath: string,
  extension: string
): Promise<CodeChunk[]> {
  const language = getLanguageFromExtension(extension);

  if (!language) {
    return chunkFallback(content, filePath);
  }

  try {
    const factory = await getParserFactory();
    const boundaryChunks = await parseCodeAndChunk(content, language as any, factory, {});

    const chunks = boundaryChunks.map((chunk) => ({
      ...boundaryChunkToCodeChunk(chunk),
      filePath,
    }));

    if (chunks.length === 0) {
      return chunkFallback(content, filePath);
    }

    return chunks;
  } catch {
    return chunkFallback(content, filePath);
  }
}

function chunkFallback(content: string, filePath: string): CodeChunk[] {
  const lines = content.split('\n');
  const chunks: CodeChunk[] = [];
  const maxLines = 100;
  let currentChunk: string[] = [];
  let currentStartLine = 1;
  let braceDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    currentChunk.push(line);

    for (const char of line) {
      if (char === '{' || char === '[' || char === '(') braceDepth++;
      if (char === '}' || char === ']' || char === ')') braceDepth--;
    }

    const shouldSplit =
      currentChunk.length >= maxLines && braceDepth === 0 && line.trim().length === 0;

    if (shouldSplit) {
      chunks.push({
        content: currentChunk.join('\n'),
        filePath,
        startLine: currentStartLine,
        endLine: i + 1,
        metadata: { type: 'block', language: 'unknown' },
      });
      currentChunk = [];
      currentStartLine = i + 2;
    }
  }

  if (currentChunk.length > 0) {
    chunks.push({
      content: currentChunk.join('\n'),
      filePath,
      startLine: currentStartLine,
      endLine: lines.length,
      metadata: { type: 'block', language: 'unknown' },
    });
  }

  return chunks;
}

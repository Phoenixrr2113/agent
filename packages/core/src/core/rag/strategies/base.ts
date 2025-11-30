export interface Chunk {
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
  [key: string]: any;
}

export interface ChunkingStrategy {
  name: string;
  supportedExtensions: string[];
  canHandle(filePath: string, extension: string): boolean;
  chunkFile(content: string, filePath: string, extension: string): Promise<Chunk[]>;
  chunkDirectory?(directoryPath: string, options?: any): Promise<Chunk[]>;
}

export abstract class BaseChunkingStrategy implements ChunkingStrategy {
  abstract name: string;
  abstract supportedExtensions: string[];

  canHandle(filePath: string, extension: string): boolean {
    return this.supportedExtensions.includes(extension.toLowerCase());
  }

  abstract chunkFile(content: string, filePath: string, extension: string): Promise<Chunk[]>;

  async chunkDirectory(_directoryPath: string, _options?: any): Promise<Chunk[]> {
    throw new Error(`${this.name} does not support directory chunking`);
  }
}


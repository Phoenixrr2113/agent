export interface GlobOptions {
  pattern: string;
  paths?: string[];
  maxDepth?: number;
  limit?: number;
  timeout?: number;
  hidden?: boolean;
  noIgnore?: boolean;
}

export interface FileMatch {
  path: string;
  mtime: number;
}

export interface GlobResult {
  files: FileMatch[];
  totalFiles: number;
  truncated: boolean;
  error?: string;
}

export interface FileInfo {
  size: number;
  created: Date;
  modified: Date;
  accessed: Date;
  isDirectory: boolean;
  isFile: boolean;
  permissions: string;
}

export interface SearchResult {
  path: string;
  isDirectory: boolean;
}

export interface FileEdit {
  oldText: string;
  newText: string;
}

export interface DirectoryEntry {
  name: string;
  type: 'file' | 'directory' | 'unknown';
  prefix?: string;
  size?: number;
  formattedSize?: string;
}

export interface DirectoryTree {
  name: string;
  type: 'file' | 'directory';
  children?: DirectoryTree[];
}

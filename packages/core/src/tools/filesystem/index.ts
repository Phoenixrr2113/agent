export type {
  FileInfo,
  SearchResult,
  FileEdit,
  DirectoryEntry,
  DirectoryTree,
} from './types.js';

export {
  setAllowedDirectories,
  getAllowedDirectories,
  expandHome,
  normalizePath,
  isPathWithinAllowedDirectories,
  validatePath,
  validateNewPath,
} from './path-security.js';

export {
  readFileContent,
  writeFileContent,
  readMediaFile,
  headFile,
  tailFile,
  getFileStats,
  normalizeLineEndings,
  createUnifiedDiff,
  applyFileEdits,
} from './file-operations.js';

export {
  searchFilesWithValidation,
  buildDirectoryTree,
  formatSize,
} from './directory-operations.js';

export { createFilesystemTools } from './tools.js';

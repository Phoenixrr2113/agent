import { CodeChunkingStrategy } from './strategies/code-strategy.js';
const codeStrategy = new CodeChunkingStrategy();
export function disposeParserFactory() {
    codeStrategy.dispose();
}
export function getLanguageFromExtension(ext) {
    return codeStrategy.getLanguageFromExtension(ext);
}
export function isASTSupported(ext) {
    return codeStrategy.canHandle('', ext);
}
export async function chunkDirectory(directoryPath, options = {}) {
    return codeStrategy.chunkDirectory(directoryPath, options);
}
export async function chunkFile(content, filePath, extension) {
    return codeStrategy.chunkFile(content, filePath, extension);
}

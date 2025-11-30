export class BaseChunkingStrategy {
    canHandle(filePath, extension) {
        return this.supportedExtensions.includes(extension.toLowerCase());
    }
    async chunkDirectory(_directoryPath, _options) {
        throw new Error(`${this.name} does not support directory chunking`);
    }
}

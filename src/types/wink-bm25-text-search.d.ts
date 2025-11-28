declare module 'wink-bm25-text-search' {
  interface BM25Config {
    fldWeights?: Record<string, number>;
    bm25Params?: {
      k1?: number;
      b?: number;
    };
  }

  type PrepTask = (text: string) => string | string[];

  interface BM25Engine {
    defineConfig(config: BM25Config): void;
    definePrepTasks(tasks: PrepTask[]): void;
    addDoc(doc: Record<string, string>, id: string): void;
    consolidate(): void;
    search(query: string, limit?: number): [string, number][];
  }

  function bm25(): BM25Engine;
  export default bm25;
}


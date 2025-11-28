import bm25 from 'wink-bm25-text-search';

export interface BM25Document {
  id: string;
  content: string;
  name?: string;
  filePath?: string;
}

export interface BM25SearchResult {
  id: string;
  score: number;
  rank: number;
}

export interface BM25Index {
  search: (query: string, limit?: number) => BM25SearchResult[];
  addDocument: (doc: BM25Document) => void;
  addDocuments: (docs: BM25Document[]) => void;
  consolidate: () => void;
  getDocumentCount: () => number;
  serialize: () => string;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 1);
}

export function createBM25Index(): BM25Index {
  const engine = bm25();
  let documentCount = 0;
  let isConsolidated = false;

  engine.defineConfig({
    fldWeights: {
      content: 1,
      name: 2,
      filePath: 0.5,
    },
    bm25Params: {
      k1: 1.2,
      b: 0.75,
    },
  });

  engine.definePrepTasks([
    (text: string) => text.toLowerCase(),
    (text: string) => text.replace(/[^\w\s]/g, ' '),
    (text: string) => text.split(/\s+/).filter((t: string) => t.length > 1),
  ]);

  return {
    addDocument(doc: BM25Document): void {
      if (isConsolidated) {
        throw new Error('Cannot add documents after consolidation');
      }
      engine.addDoc(
        {
          content: doc.content,
          name: doc.name || '',
          filePath: doc.filePath || '',
        },
        doc.id
      );
      documentCount++;
    },

    addDocuments(docs: BM25Document[]): void {
      for (const doc of docs) {
        this.addDocument(doc);
      }
    },

    consolidate(): void {
      if (!isConsolidated) {
        engine.consolidate();
        isConsolidated = true;
      }
    },

    search(query: string, limit = 100): BM25SearchResult[] {
      if (!isConsolidated) {
        this.consolidate();
      }

      const results = engine.search(query, limit);
      return results.map(([id, score]: [string, number], index: number) => ({
        id,
        score,
        rank: index + 1,
      }));
    },

    getDocumentCount(): number {
      return documentCount;
    },

    serialize(): string {
      return JSON.stringify({
        documentCount,
        isConsolidated,
      });
    },
  };
}

export function reciprocalRankFusion(
  rankings: Map<string, number>[],
  k = 60
): Map<string, number> {
  const scores = new Map<string, number>();

  for (const ranking of rankings) {
    for (const [docId, rank] of ranking) {
      const current = scores.get(docId) || 0;
      scores.set(docId, current + 1 / (k + rank));
    }
  }

  return scores;
}

export function mergeSearchResults(
  embeddingResults: { id: string; rank: number }[],
  bm25Results: BM25SearchResult[],
  options: { k?: number; embeddingWeight?: number; bm25Weight?: number } = {}
): { id: string; score: number }[] {
  const { k = 60, embeddingWeight = 1.0, bm25Weight = 1.0 } = options;

  const embeddingRanking = new Map<string, number>();
  for (const result of embeddingResults) {
    embeddingRanking.set(result.id, result.rank);
  }

  const bm25Ranking = new Map<string, number>();
  for (const result of bm25Results) {
    bm25Ranking.set(result.id, result.rank);
  }

  const scores = new Map<string, number>();
  const allIds = new Set([...embeddingRanking.keys(), ...bm25Ranking.keys()]);

  for (const id of allIds) {
    let score = 0;

    const embeddingRank = embeddingRanking.get(id);
    if (embeddingRank !== undefined) {
      score += (embeddingWeight * 1) / (k + embeddingRank);
    }

    const bm25Rank = bm25Ranking.get(id);
    if (bm25Rank !== undefined) {
      score += (bm25Weight * 1) / (k + bm25Rank);
    }

    scores.set(id, score);
  }

  return Array.from(scores.entries())
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score);
}


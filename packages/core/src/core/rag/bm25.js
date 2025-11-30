import bm25 from 'wink-bm25-text-search';
export function createBM25Index() {
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
        (text) => text.toLowerCase(),
        (text) => text.replace(/[^\w\s]/g, ' '),
        (text) => text.split(/\s+/).filter((t) => t.length > 1),
    ]);
    return {
        addDocument(doc) {
            if (isConsolidated) {
                throw new Error('Cannot add documents after consolidation');
            }
            engine.addDoc({
                content: doc.content,
                name: doc.name || '',
                filePath: doc.filePath || '',
            }, doc.id);
            documentCount++;
        },
        addDocuments(docs) {
            for (const doc of docs) {
                this.addDocument(doc);
            }
        },
        consolidate() {
            if (!isConsolidated) {
                engine.consolidate();
                isConsolidated = true;
            }
        },
        search(query, limit = 100) {
            if (!isConsolidated) {
                this.consolidate();
            }
            const results = engine.search(query, limit);
            return results.map(([id, score], index) => ({
                id,
                score,
                rank: index + 1,
            }));
        },
        getDocumentCount() {
            return documentCount;
        },
        serialize() {
            return JSON.stringify({
                documentCount,
                isConsolidated,
            });
        },
    };
}
export function reciprocalRankFusion(rankings, k = 60) {
    const scores = new Map();
    for (const ranking of rankings) {
        for (const [docId, rank] of ranking) {
            const current = scores.get(docId) || 0;
            scores.set(docId, current + 1 / (k + rank));
        }
    }
    return scores;
}
export function mergeSearchResults(embeddingResults, bm25Results, options = {}) {
    const { k = 60, embeddingWeight = 1.0, bm25Weight = 1.0 } = options;
    const embeddingRanking = new Map();
    for (const result of embeddingResults) {
        embeddingRanking.set(result.id, result.rank);
    }
    const bm25Ranking = new Map();
    for (const result of bm25Results) {
        bm25Ranking.set(result.id, result.rank);
    }
    const scores = new Map();
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

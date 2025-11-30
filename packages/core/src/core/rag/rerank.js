import { rerank } from 'ai';
import { cohere } from '@ai-sdk/cohere';
export async function rerankDocuments(query, documents, options = {}) {
    const { model = 'rerank-v3.5', topN = 20 } = options;
    if (documents.length === 0) {
        return [];
    }
    if (documents.length <= topN) {
        return documents.map((doc, index) => ({
            id: doc.id,
            score: 1 - index / documents.length,
            rank: index + 1,
        }));
    }
    const { ranking } = await rerank({
        model: cohere.reranking(model),
        query,
        documents: documents.map((doc) => doc.content),
        topN,
    });
    return ranking.map((result, index) => ({
        id: documents[result.originalIndex].id,
        score: result.score,
        rank: index + 1,
    }));
}
export async function rerankWithFallback(query, documents, options = {}) {
    try {
        return await rerankDocuments(query, documents, options);
    }
    catch {
        return documents.slice(0, options.topN || 20).map((doc, index) => ({
            id: doc.id,
            score: 1 - index / documents.length,
            rank: index + 1,
        }));
    }
}

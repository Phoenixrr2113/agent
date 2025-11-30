import { randomUUID } from 'crypto';
export function createGraphitiProvider(graphitiUrl) {
    async function request(path, method, body) {
        const response = await fetch(`${graphitiUrl}${path}`, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: body ? JSON.stringify(body) : undefined,
        });
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Graphiti API error: ${response.status} - ${error}`);
        }
        return response.json();
    }
    return {
        async add(input) {
            const result = await request('/messages', 'POST', {
                group_id: input.groupId || 'default',
                messages: [{
                        uuid: randomUUID(),
                        content: input.content,
                        role: input.role || 'user',
                        role_type: input.role || 'user',
                        name: `memory_${Date.now()}`,
                        timestamp: new Date().toISOString(),
                        source_description: input.source || 'agent_memory',
                    }],
            });
            return {
                factIds: result.facts?.map((f) => f.uuid) || [],
                entityIds: result.entities?.map((e) => e.uuid) || [],
            };
        },
        async search(input) {
            const result = await request('/search', 'POST', {
                query: input.query,
                group_ids: input.groupIds,
                max_facts: input.maxResults || 10,
            });
            const facts = (result.facts || []).map((f) => ({
                id: f.uuid,
                content: f.fact || f.content,
                embedding: [],
                entityIds: [],
                relationIds: [],
                validFrom: new Date(f.valid_at || f.created_at),
                validTo: f.invalid_at ? new Date(f.invalid_at) : null,
                createdAt: new Date(f.created_at),
                source: f.source_description || 'graphiti',
                confidence: 1.0,
            }));
            const entities = (result.entities || []).map((e) => ({
                id: e.uuid,
                name: e.name,
                type: e.entity_type || 'unknown',
                attributes: e.attributes || {},
                createdAt: new Date(e.created_at || Date.now()),
                updatedAt: new Date(e.updated_at || Date.now()),
            }));
            return {
                facts,
                entities,
                relations: [],
                score: result.score || 1.0,
            };
        },
        async getEpisodes(groupId, limit = 10) {
            const result = await request(`/episodes/${groupId}?last_n=${limit}`, 'GET');
            return (result.episodes || result || []).map((e) => ({
                id: e.uuid,
                groupId: e.group_id || groupId,
                content: e.content,
                role: e.role || 'user',
                factIds: e.fact_ids || [],
                entityIds: e.entity_ids || [],
                timestamp: new Date(e.timestamp || e.created_at),
            }));
        },
        async getFact(factId) {
            try {
                const result = await request(`/entity-edge/${factId}`, 'GET');
                return {
                    id: result.uuid,
                    content: result.fact || result.content,
                    embedding: [],
                    entityIds: [],
                    relationIds: [],
                    validFrom: new Date(result.valid_at || result.created_at),
                    validTo: result.invalid_at ? new Date(result.invalid_at) : null,
                    createdAt: new Date(result.created_at),
                    source: result.source_description || 'graphiti',
                    confidence: 1.0,
                };
            }
            catch {
                return null;
            }
        },
        async getEntity(entityId) {
            try {
                const result = await request(`/entity/${entityId}`, 'GET');
                return {
                    id: result.uuid,
                    name: result.name,
                    type: result.entity_type || 'unknown',
                    attributes: result.attributes || {},
                    createdAt: new Date(result.created_at || Date.now()),
                    updatedAt: new Date(result.updated_at || Date.now()),
                };
            }
            catch {
                return null;
            }
        },
        async getRelatedEntities(entityId, depth = 1) {
            try {
                const result = await request(`/entity/${entityId}/related?depth=${depth}`, 'GET');
                return (result.entities || []).map((e) => ({
                    id: e.uuid,
                    name: e.name,
                    type: e.entity_type || 'unknown',
                    attributes: e.attributes || {},
                    createdAt: new Date(e.created_at || Date.now()),
                    updatedAt: new Date(e.updated_at || Date.now()),
                }));
            }
            catch {
                return [];
            }
        },
        async invalidateFact(factId) {
            await request(`/entity-edge/${factId}/invalidate`, 'POST', {
                invalid_at: new Date().toISOString(),
            });
        },
        async close() {
        },
    };
}

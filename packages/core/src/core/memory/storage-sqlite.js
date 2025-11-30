import Database from 'better-sqlite3';
function cosineSimilarity(a, b) {
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
const SCHEMA = `
  CREATE TABLE IF NOT EXISTS entities (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    attributes TEXT NOT NULL,
    embedding TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_entities_name ON entities(name);
  CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(type);

  CREATE TABLE IF NOT EXISTS relations (
    id TEXT PRIMARY KEY,
    from_entity_id TEXT NOT NULL,
    to_entity_id TEXT NOT NULL,
    type TEXT NOT NULL,
    weight REAL NOT NULL,
    attributes TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (from_entity_id) REFERENCES entities(id),
    FOREIGN KEY (to_entity_id) REFERENCES entities(id)
  );
  CREATE INDEX IF NOT EXISTS idx_relations_from ON relations(from_entity_id);
  CREATE INDEX IF NOT EXISTS idx_relations_to ON relations(to_entity_id);

  CREATE TABLE IF NOT EXISTS facts (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    embedding TEXT NOT NULL,
    entity_ids TEXT NOT NULL,
    relation_ids TEXT NOT NULL,
    valid_from TEXT NOT NULL,
    valid_to TEXT,
    created_at TEXT NOT NULL,
    source TEXT NOT NULL,
    confidence REAL NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_facts_valid ON facts(valid_from, valid_to);

  CREATE TABLE IF NOT EXISTS episodes (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL,
    content TEXT NOT NULL,
    role TEXT NOT NULL,
    fact_ids TEXT NOT NULL,
    entity_ids TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    last_processed_message_index INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_episodes_group ON episodes(group_id, timestamp);
`;
export function createSQLiteStorage(dbPath) {
    const db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.exec(SCHEMA);
    const parseEntity = (row) => ({
        id: row.id,
        name: row.name,
        type: row.type,
        attributes: JSON.parse(row.attributes),
        embedding: row.embedding ? JSON.parse(row.embedding) : undefined,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
    });
    const parseFact = (row) => ({
        id: row.id,
        content: row.content,
        embedding: JSON.parse(row.embedding),
        entityIds: JSON.parse(row.entity_ids),
        relationIds: JSON.parse(row.relation_ids),
        validFrom: new Date(row.valid_from),
        validTo: row.valid_to ? new Date(row.valid_to) : null,
        createdAt: new Date(row.created_at),
        source: row.source,
        confidence: row.confidence,
    });
    return {
        entities: {
            async create(entity) {
                db.prepare(`INSERT INTO entities VALUES (?, ?, ?, ?, ?, ?, ?)`).run(entity.id, entity.name, entity.type, JSON.stringify(entity.attributes), entity.embedding ? JSON.stringify(entity.embedding) : null, entity.createdAt.toISOString(), entity.updatedAt.toISOString());
            },
            async update(id, updates) {
                const sets = [];
                const vals = [];
                if (updates.name) {
                    sets.push('name = ?');
                    vals.push(updates.name);
                }
                if (updates.attributes) {
                    sets.push('attributes = ?');
                    vals.push(JSON.stringify(updates.attributes));
                }
                if (updates.embedding) {
                    sets.push('embedding = ?');
                    vals.push(JSON.stringify(updates.embedding));
                }
                sets.push('updated_at = ?');
                vals.push(new Date().toISOString());
                vals.push(id);
                db.prepare(`UPDATE entities SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
            },
            async get(id) {
                const row = db.prepare('SELECT * FROM entities WHERE id = ?').get(id);
                return row ? parseEntity(row) : null;
            },
            async findByName(name) {
                const row = db.prepare('SELECT * FROM entities WHERE LOWER(name) = LOWER(?)').get(name);
                return row ? parseEntity(row) : null;
            },
            async findByType(type) {
                return db.prepare('SELECT * FROM entities WHERE type = ?').all(type).map(parseEntity);
            },
            async search(embedding, limit) {
                const all = db.prepare('SELECT * FROM entities WHERE embedding IS NOT NULL').all().map(parseEntity);
                return all
                    .filter((e) => e.embedding !== undefined && e.embedding !== null)
                    .map((e) => ({ entity: e, score: cosineSimilarity(embedding, e.embedding) }))
                    .sort((a, b) => b.score - a.score)
                    .slice(0, limit);
            },
            async all() {
                return db.prepare('SELECT * FROM entities').all().map(parseEntity);
            },
        },
        relations: {
            async create(r) {
                db.prepare('INSERT INTO relations VALUES (?, ?, ?, ?, ?, ?, ?)').run(r.id, r.fromEntityId, r.toEntityId, r.type, r.weight, JSON.stringify(r.attributes), r.createdAt.toISOString());
            },
            async get(id) {
                const row = db.prepare('SELECT * FROM relations WHERE id = ?').get(id);
                return row ? { ...row, fromEntityId: row.from_entity_id, toEntityId: row.to_entity_id,
                    attributes: JSON.parse(row.attributes), createdAt: new Date(row.created_at) } : null;
            },
            async findByEntity(entityId) {
                return db.prepare('SELECT * FROM relations WHERE from_entity_id = ? OR to_entity_id = ?')
                    .all(entityId, entityId).map((r) => ({
                    ...r, fromEntityId: r.from_entity_id, toEntityId: r.to_entity_id,
                    attributes: JSON.parse(r.attributes), createdAt: new Date(r.created_at)
                }));
            },
            async findBetween(fromId, toId) {
                return db.prepare('SELECT * FROM relations WHERE from_entity_id = ? AND to_entity_id = ?')
                    .all(fromId, toId).map((r) => ({
                    ...r, fromEntityId: r.from_entity_id, toEntityId: r.to_entity_id,
                    attributes: JSON.parse(r.attributes), createdAt: new Date(r.created_at)
                }));
            },
            async all() {
                return db.prepare('SELECT * FROM relations').all().map((r) => ({
                    ...r, fromEntityId: r.from_entity_id, toEntityId: r.to_entity_id,
                    attributes: JSON.parse(r.attributes), createdAt: new Date(r.created_at)
                }));
            },
        },
        facts: {
            async create(f) {
                db.prepare('INSERT INTO facts VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(f.id, f.content, JSON.stringify(f.embedding), JSON.stringify(f.entityIds), JSON.stringify(f.relationIds), f.validFrom.toISOString(), f.validTo?.toISOString() || null, f.createdAt.toISOString(), f.source, f.confidence);
            },
            async update(id, updates) {
                if (updates.validTo) {
                    db.prepare('UPDATE facts SET valid_to = ? WHERE id = ?').run(updates.validTo.toISOString(), id);
                }
            },
            async get(id) {
                const row = db.prepare('SELECT * FROM facts WHERE id = ?').get(id);
                return row ? parseFact(row) : null;
            },
            async findByEntity(entityId) {
                const all = db.prepare('SELECT * FROM facts').all().map(parseFact);
                return all.filter((f) => f.entityIds.includes(entityId));
            },
            async findValid(asOf = new Date()) {
                const iso = asOf.toISOString();
                return db.prepare('SELECT * FROM facts WHERE valid_from <= ? AND (valid_to IS NULL OR valid_to > ?)')
                    .all(iso, iso).map(parseFact);
            },
            async search(embedding, limit, includeExpired = false) {
                const facts = includeExpired
                    ? db.prepare('SELECT * FROM facts').all().map(parseFact)
                    : await this.findValid();
                return facts
                    .map((f) => ({ fact: f, score: cosineSimilarity(embedding, f.embedding) }))
                    .sort((a, b) => b.score - a.score)
                    .slice(0, limit);
            },
            async invalidate(id, validTo) {
                db.prepare('UPDATE facts SET valid_to = ? WHERE id = ?').run(validTo.toISOString(), id);
            },
        },
        episodes: {
            async create(e) {
                db.prepare('INSERT INTO episodes VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(e.id, e.groupId, e.content, e.role, JSON.stringify(e.factIds), JSON.stringify(e.entityIds), e.timestamp.toISOString(), e.lastProcessedMessageIndex);
            },
            async get(id) {
                const row = db.prepare('SELECT * FROM episodes WHERE id = ?').get(id);
                return row ? {
                    ...row,
                    groupId: row.group_id,
                    factIds: JSON.parse(row.fact_ids),
                    entityIds: JSON.parse(row.entity_ids),
                    timestamp: new Date(row.timestamp),
                    lastProcessedMessageIndex: row.last_processed_message_index
                } : null;
            },
            async findByGroup(groupId, limit = 10) {
                return db.prepare('SELECT * FROM episodes WHERE group_id = ? ORDER BY timestamp DESC LIMIT ?')
                    .all(groupId, limit).map((r) => ({
                    ...r,
                    groupId: r.group_id,
                    factIds: JSON.parse(r.fact_ids),
                    entityIds: JSON.parse(r.entity_ids),
                    timestamp: new Date(r.timestamp),
                    lastProcessedMessageIndex: r.last_processed_message_index
                }));
            },
        },
        async transaction(fn) {
            db.exec('BEGIN');
            try {
                const result = await fn();
                db.exec('COMMIT');
                return result;
            }
            catch (e) {
                db.exec('ROLLBACK');
                throw e;
            }
        },
        async close() { db.close(); },
    };
}

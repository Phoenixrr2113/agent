# Memory System - Future Improvements

The current Vectra-based memory is intentionally minimal for portability (zero native deps). This document outlines upgrade paths.

## Current: Vectra (Portable)

```
✅ Zero native dependencies
✅ File-based JSON persistence
✅ Vector similarity search
❌ No graph structure
❌ No temporal tracking
❌ Scales to ~100K vectors
```

---

## Phase 1: Temporal + Observations

Add bi-temporal model and observations (inspired by MCP Memory):

```typescript
interface Entity {
  uuid: string;
  name: string;
  type: string;
  observations: string[];
  embedding?: number[];
  createdAt: Date;
  validAt: Date;      // When fact was true
  invalidAt?: Date;   // When fact became false
}

interface Relation {
  from: string;
  to: string;
  type: string;
  weight: number;
  createdAt: Date;
  validAt: Date;
}
```

**Storage:** JSONL (append-only) with periodic compaction

---

## Phase 2: SQLite Backend

For larger datasets (~1M+ entities), migrate to SQLite:

```sql
CREATE TABLE entities (
  uuid TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  embedding BLOB,
  created_at TEXT,
  valid_at TEXT,
  invalid_at TEXT
);

CREATE TABLE observations (
  uuid TEXT PRIMARY KEY,
  entity_uuid TEXT REFERENCES entities(uuid),
  content TEXT,
  embedding BLOB,
  created_at TEXT
);

CREATE TABLE relations (
  uuid TEXT PRIMARY KEY,
  from_uuid TEXT REFERENCES entities(uuid),
  to_uuid TEXT REFERENCES entities(uuid),
  type TEXT,
  weight REAL,
  created_at TEXT,
  valid_at TEXT
);
```

**Requires:** `better-sqlite3` (native dep)

---

## Phase 3: Graphiti-Compatible

For production scale, integrate with Graphiti/Zep:

- **3 Node Types:** Episodic, Entity, Community
- **Hierarchical Memory:** Episodes → Entities → Communities
- **Hybrid Search:** BM25 + Embeddings + Graph Traversal
- **Backend:** Neo4j, FalkorDB, or Zep Cloud

### References
- [Graphiti](https://github.com/getzep/graphiti) - Temporal KG for agents
- [Zep](https://getzep.com) - Memory service (uses Graphiti)
- [MCP Memory](https://github.com/modelcontextprotocol/servers/blob/main/src/memory/index.ts)

---

## Migration Path

| Phase | Storage | Native Deps | Scale | Time |
|-------|---------|-------------|-------|------|
| Current | Vectra/JSON | ❌ None | ~100K | Now |
| Phase 1 | JSONL Graph | ❌ None | ~100K | 1 week |
| Phase 2 | SQLite | ✅ better-sqlite3 | ~10M | 2 weeks |
| Phase 3 | Neo4j/Zep | ✅ External DB | Billions | TBD |

---

## Decision: Keep Vectra for Now

The current solution prioritizes:
1. **Zero native deps** - Works anywhere
2. **Simple API** - Easy to understand
3. **Portability** - Browser-compatible (future)

Upgrade when:
- Dataset exceeds 100K memories
- Need entity-relationship graph
- Need temporal reasoning (what was true when?)

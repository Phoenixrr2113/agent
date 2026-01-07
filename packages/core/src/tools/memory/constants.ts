/**
 * Memory tool constants
 */

export const MEMORY_DESCRIPTION = `A unified tool for knowledge graph memory operations: adding, searching, and retrieving information.
This tool manages a persistent knowledge base that extracts entities and relationships from content.

When to use this tool:
- Storing important information for later recall
- Searching for previously learned facts
- Looking up entities, facts, or relationships from past conversations
- Building contextual knowledge about users, projects, or topics

When NOT to use this tool:
- Searching the web → use web tool
- Reading local files → use fs tool
- Temporary data that doesn't need persistence

Memory concepts:
- Facts: Individual pieces of information with confidence scores
- Entities: Named things (people, projects, concepts) with attributes
- Relations: Connections between entities (e.g., "Alice works on Project X")
- Groups: Organizational units for related memories
- Episodes: Chronological records of interactions

Actions:
- add: Store new content, automatically extracting entities and relationships
- search: Semantic search across all memory for relevant facts
- episodes: Get recent memories for a specific group
- fact: Get details about a specific fact by ID
- entity: Get details about a specific entity by ID
- related: Get entities related to a given entity

Parameters explained:
- action: Required. One of: add, search, episodes, fact, entity, related
- content: For add. The content to remember.
- role: For add. Speaker role (user/assistant/system).
- groupId: For add/episodes. Group ID to organize memories.
- query: For search. The search query.
- maxResults: For search. Max results to return.
- factId: For fact. The fact ID to retrieve.
- entityId: For entity/related. The entity ID.
- depth: For related. How many relationship hops to traverse.

You should:
1. Add important information that may be useful later
2. Search memory before asking the user for repeated information
3. Use groups to organize memories by context (project, topic, etc.)
4. Retrieve related entities to build context`;

export const DEFAULT_GROUP_ID = 'default';
export const DEFAULT_MAX_RESULTS = 10;
export const DEFAULT_DEPTH = 1;

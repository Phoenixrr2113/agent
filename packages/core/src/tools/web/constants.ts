/**
 * Web tool constants
 */

export const DEFAULT_TIMEOUT = 30000;
export const DEFAULT_MAX_LENGTH = 10000;
export const DEFAULT_MAX_RESULTS = 5;

export const WEB_DESCRIPTION = `A unified tool for web operations: searching and fetching content from the internet.

When to use this tool:
- Researching a topic or finding current information
- Getting content from a specific URL
- Looking up documentation, APIs, or reference material
- Finding news or recent events

When NOT to use this tool:
- Working with local files → use fs tool
- Reading from memory/knowledge graph → use memory tool

Actions:
- search: Search the web using Brave or Tavily search engines
- fetch: Fetch and parse a web page, extracting main content

Search engines:
- tavily: Best for research and fact-finding (includes AI-generated summary)
- brave: Good for general web discovery
- both: Query both engines (slower but more comprehensive)

Parameters explained:
- action: Required. One of: search, fetch
- query: For search. The search query.
- url: For fetch. The URL to fetch and parse.
- engine: For search. Which search engine(s) to use (default: tavily).
- maxResults: For search. Number of results to return (default: 5).
- deep: For search. If true, uses deeper tavily search (slower, more thorough).
- maxLength: For fetch. Maximum content length to return (default: 10000).

You should:
1. Use tavily for research requiring AI summary
2. Use brave for quick general searches  
3. Use fetch to get full content after finding URLs via search
4. Set appropriate maxLength to avoid overwhelming responses`;

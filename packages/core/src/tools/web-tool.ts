import { tool } from 'ai';
import { z } from 'zod';

import { success, error } from './utils/tool-result.js';
import { ToolError, ToolErrorType } from './middleware/index.js';

const DEFAULT_TIMEOUT = 30000;

function fetchWithTimeout(url: string, options: RequestInit = {}, timeout = DEFAULT_TIMEOUT): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => { controller.abort(); }, timeout);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => { clearTimeout(timeoutId); });
}

const DESCRIPTION = `A unified tool for web operations: searching and fetching content from the internet.

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

const webInputSchema = z.object({
  action: z.enum(['search', 'fetch']).describe('Web operation type'),
  
  query: z.string().optional().describe('For search: the search query'),
  engine: z.enum(['brave', 'tavily', 'both']).optional().describe('For search: search engine'),
  maxResults: z.number().min(1).max(50).optional().describe('For search: max results'),
  deep: z.boolean().optional().describe('For search: deep search (tavily only)'),
  
  url: z.string().optional().describe('For fetch: URL to fetch'),
  maxLength: z.number().optional().describe('For fetch: max content length'),
});

interface BraveSearchResult {
  title: string;
  url: string;
  description: string;
}

interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

async function braveSearch(query: string, count = 5): Promise<BraveSearchResult[]> {
  const apiKey = process.env['BRAVE_API_KEY'];
  if (!apiKey) throw new Error('BRAVE_API_KEY not set');

  const response = await fetchWithTimeout(
    `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${count}`,
    {
      headers: {
        'Accept': 'application/json',
        'X-Subscription-Token': apiKey,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Brave search failed: ${response.status}`);
  }

  const data = await response.json() as { web?: { results?: Array<{ title: string; url: string; description: string }> } };
  return (data.web?.results ?? []).map((r) => ({
    title: r.title,
    url: r.url,
    description: r.description,
  }));
}

async function tavilySearch(
  query: string,
  options: { maxResults?: number; searchDepth?: 'basic' | 'advanced' } = {}
): Promise<{ results: TavilySearchResult[]; answer?: string }> {
  const apiKey = process.env['TAVILY_API_KEY'];
  if (!apiKey) throw new Error('TAVILY_API_KEY not set');

  const { maxResults = 5, searchDepth = 'basic' } = options;

  const response = await fetchWithTimeout('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: searchDepth,
      max_results: maxResults,
      include_answer: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`Tavily search failed: ${response.status}`);
  }

  const data = await response.json() as { 
    results?: Array<{ title: string; url: string; content: string; score: number }>; 
    answer?: string 
  };
  
  return {
    results: (data.results ?? []).map((r) => ({
      title: r.title,
      url: r.url,
      content: r.content,
      score: r.score,
    })),
    answer: data.answer,
  };
}

let JSDOM: typeof import('jsdom').JSDOM;

async function getJSDOM() {
  if (!JSDOM) {
    const jsdom = await import('jsdom');
    JSDOM = jsdom.JSDOM;
  }
  return JSDOM;
}

async function fetchAndParsePage(url: string, maxLength: number): Promise<{
  title: string;
  content: string;
  excerpt?: string;
  siteName?: string;
  originalLength: number;
  truncated: boolean;
}> {
  const { Readability } = await import('@mozilla/readability');
  
  const response = await fetchWithTimeout(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; AIAgent/1.0)',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
    throw new Error(`Expected HTML content, got: ${contentType}`);
  }

  const html = await response.text();
  const JSDOMClass = await getJSDOM();
  const dom = new JSDOMClass(html, { url });

  try {
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    let content: string;
    let title: string;
    let excerpt: string | undefined;
    let siteName: string | undefined;
    let originalLength: number;

    if (!article) {
      const textContent = dom.window.document.body?.textContent || '';
      content = textContent.substring(0, maxLength).trim();
      title = dom.window.document.title || url;
      originalLength = textContent.length;
    } else {
      const articleContent = (article.textContent || '').trim();
      content = articleContent.substring(0, maxLength);
      title = article.title || url;
      excerpt = article.excerpt || undefined;
      siteName = article.siteName || undefined;
      originalLength = articleContent.length;
    }

    return {
      title,
      content: originalLength > maxLength ? content + '\n\n[Content truncated...]' : content,
      excerpt,
      siteName,
      originalLength,
      truncated: originalLength > maxLength,
    };
  } finally {
    dom.window.close();
  }
}

export const createWebTool = () => {
  return tool({
    description: DESCRIPTION,
    inputSchema: webInputSchema,
    execute: async (input) => {
      const { action } = input;

      switch (action) {
        case 'search': {
          const { query, engine = 'tavily', maxResults = 5, deep = false } = input;
          
          if (!query) {
            throw new ToolError('query is required for search action', ToolErrorType.INVALID_INPUT);
          }

          const results: {
            brave?: BraveSearchResult[];
            tavily?: TavilySearchResult[];
            answer?: string;
            braveError?: string;
            tavilyError?: string;
          } = {};

          if (engine === 'brave' || engine === 'both') {
            try {
              results.brave = await braveSearch(query, maxResults);
            } catch (err) {
              results.braveError = err instanceof Error ? err.message : String(err);
            }
          }

          if (engine === 'tavily' || engine === 'both') {
            try {
              const tavily = await tavilySearch(query, {
                maxResults,
                searchDepth: deep ? 'advanced' : 'basic',
              });
              results.tavily = tavily.results;
              if (tavily.answer) {
                results.answer = tavily.answer;
              }
            } catch (err) {
              results.tavilyError = err instanceof Error ? err.message : String(err);
            }
          }

          if (!results.brave && !results.tavily) {
            return error('No search results available', {
              braveError: results.braveError,
              tavilyError: results.tavilyError,
            });
          }

          return success({
            query,
            engine,
            ...results,
          });
        }

        case 'fetch': {
          const { url, maxLength = 10000 } = input;
          
          if (!url) {
            throw new ToolError('url is required for fetch action', ToolErrorType.INVALID_INPUT);
          }

          try {
            const page = await fetchAndParsePage(url, maxLength);
            return success({
              url,
              ...page,
            });
          } catch (err) {
            return error(err instanceof Error ? err.message : 'Failed to fetch page', { url });
          }
        }

        default:
          throw new ToolError(`Unknown action: ${action}`, ToolErrorType.INVALID_INPUT);
      }
    },
  });
};

export const webTool = createWebTool();

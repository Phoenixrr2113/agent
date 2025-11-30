import { tool } from 'ai';
import { z } from 'zod';

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

async function braveSearch(query: string, count: number = 5): Promise<BraveSearchResult[]> {
  const apiKey = process.env.BRAVE_API_KEY;
  if (!apiKey) throw new Error('BRAVE_API_KEY not set');

  const response = await fetch(
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

  const data = await response.json();
  return (data.web?.results || []).map((r: any) => ({
    title: r.title,
    url: r.url,
    description: r.description,
  }));
}

async function tavilySearch(
  query: string,
  options: { maxResults?: number; searchDepth?: 'basic' | 'advanced' } = {}
): Promise<{ results: TavilySearchResult[]; answer?: string }> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) throw new Error('TAVILY_API_KEY not set');

  const { maxResults = 5, searchDepth = 'basic' } = options;

  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
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

  const data = await response.json();
  return {
    results: (data.results || []).map((r: any) => ({
      title: r.title,
      url: r.url,
      content: r.content,
      score: r.score,
    })),
    answer: data.answer,
  };
}

export const webSearchTool = tool({
  description: `Search the web. Use 'brave' for general discovery, 'tavily' for research/fact-finding (includes AI summary).`,
  inputSchema: z.object({
    query: z.string().describe('Search query'),
    engine: z.enum(['brave', 'tavily', 'both']).default('tavily').describe('Search engine'),
    maxResults: z.number().optional().default(5).describe('Max results (default: 5)'),
    deep: z.boolean().optional().describe('Deep search for tavily (slower, more thorough)'),
  }),
  execute: async ({ query, engine = 'tavily', maxResults = 5, deep }: { query: string; engine?: string; maxResults?: number; deep?: boolean }) => {
    const results: any = {};

    try {
      if (engine === 'brave' || engine === 'both') {
        try {
          results.brave = await braveSearch(query, maxResults);
        } catch (e: any) {
          results.braveError = e.message;
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
        } catch (e: any) {
          results.tavilyError = e.message;
        }
      }

      if (Object.keys(results).length === 0) {
        return JSON.stringify({ error: 'No search engines available' });
      }

      return JSON.stringify(results);
    } catch (error: any) {
      return JSON.stringify({ error: error.message });
    }
  },
});


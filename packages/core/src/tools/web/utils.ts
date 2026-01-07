import { DEFAULT_TIMEOUT, DEFAULT_MAX_LENGTH } from './constants.js';
import type { BraveSearchResult, TavilySearchResult, FetchResult } from './types.js';

let JSDOM: typeof import('jsdom').JSDOM;

export function fetchWithTimeout(
  url: string, 
  options: RequestInit = {}, 
  timeout = DEFAULT_TIMEOUT
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => { controller.abort(); }, timeout);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => { clearTimeout(timeoutId); });
}

export async function braveSearch(query: string, count = 5): Promise<BraveSearchResult[]> {
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

  const data = await response.json() as { 
    web?: { results?: Array<{ title: string; url: string; description: string }> } 
  };
  
  return (data.web?.results ?? []).map((r) => ({
    title: r.title,
    url: r.url,
    description: r.description,
  }));
}

export async function tavilySearch(
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

async function getJSDOM() {
  if (!JSDOM) {
    const jsdom = await import('jsdom');
    JSDOM = jsdom.JSDOM;
  }
  return JSDOM;
}

export async function fetchAndParsePage(
  url: string, 
  maxLength = DEFAULT_MAX_LENGTH
): Promise<FetchResult> {
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
      url,
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

import { Readability } from '@mozilla/readability';
import { tool } from 'ai';
import { z } from 'zod';

interface ParsedPage {
  title: string;
  content: string;
  excerpt?: string;
  byline?: string;
  siteName?: string;
  length: number;
}

let JSDOM: typeof import('jsdom').JSDOM;

const DEFAULT_TIMEOUT = 30000;

function fetchWithTimeout(url: string, options: RequestInit = {}, timeout = DEFAULT_TIMEOUT): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => { controller.abort(); }, timeout);

  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => { clearTimeout(timeoutId); });
}

async function getJSDOM() {
  if (!JSDOM) {
    const jsdom = await import('jsdom');
    JSDOM = jsdom.JSDOM;
  }
  return JSDOM;
}

async function fetchAndParse(url: string): Promise<ParsedPage> {
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

    if (!article) {
      const textContent = dom.window.document.body?.textContent || '';
      return {
        title: dom.window.document.title || url,
        content: textContent.substring(0, 5000).trim(),
        length: textContent.length,
      };
    }

    return {
      title: article.title || url,
      content: (article.textContent || '').trim(),
      excerpt: article.excerpt || undefined,
      byline: article.byline || undefined,
      siteName: article.siteName || undefined,
      length: (article.textContent || '').length,
    };
  } finally {
    dom.window.close();
  }
}

export const fetchPageTool = tool({
  description: 'Fetch and parse a web page. Extracts main content using readability, removing navigation, ads, etc.',
  inputSchema: z.object({
    url: z.string().url().describe('URL to fetch'),
    maxLength: z.number().optional().default(10000).describe('Max content length (default: 10000)'),
  }),
  execute: async ({ url, maxLength = 10000 }: { url: string; maxLength?: number }) => {
    try {
      const page = await fetchAndParse(url);
      
      let content = page.content;
      if (content.length > maxLength) {
        content = content.substring(0, maxLength) + '\n\n[Content truncated...]';
      }

      return JSON.stringify({
        title: page.title,
        content,
        excerpt: page.excerpt,
        byline: page.byline,
        siteName: page.siteName,
        originalLength: page.length,
        truncated: page.length > maxLength,
      });
    } catch (error: any) {
      return JSON.stringify({
        error: error.message,
        url,
      });
    }
  },
});


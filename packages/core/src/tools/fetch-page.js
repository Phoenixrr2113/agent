import { tool } from 'ai';
import { z } from 'zod';
import { Readability } from '@mozilla/readability';
let JSDOM;
async function getJSDOM() {
    if (!JSDOM) {
        const jsdom = await import('jsdom');
        JSDOM = jsdom.JSDOM;
    }
    return JSDOM;
}
async function fetchAndParse(url) {
    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; AIAgent/1.0)',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
    });
    if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
    }
    const html = await response.text();
    const JSDOMClass = await getJSDOM();
    const dom = new JSDOMClass(html, { url });
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
}
export const fetchPageTool = tool({
    description: 'Fetch and parse a web page. Extracts main content using readability, removing navigation, ads, etc.',
    inputSchema: z.object({
        url: z.string().url().describe('URL to fetch'),
        maxLength: z.number().optional().default(10000).describe('Max content length (default: 10000)'),
    }),
    execute: async ({ url, maxLength = 10000 }) => {
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
        }
        catch (error) {
            return JSON.stringify({
                error: error.message,
                url,
            });
        }
    },
});

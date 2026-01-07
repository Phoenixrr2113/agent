import { z } from 'zod';
import { DEFAULT_MAX_RESULTS } from './constants.js';

export const webInputSchema = z.object({
  action: z.enum(['search', 'fetch']).describe('Web operation type'),
  
  query: z.string().optional().describe('For search: the search query'),
  engine: z.enum(['brave', 'tavily', 'both']).optional().describe('For search: search engine'),
  maxResults: z.number().min(1).max(50).optional().describe('For search: max results'),
  deep: z.boolean().optional().describe('For search: deep search (tavily only)'),
  
  url: z.string().optional().describe('For fetch: URL to fetch'),
  maxLength: z.number().optional().describe('For fetch: max content length'),
});

export type WebInput = z.infer<typeof webInputSchema>;

export interface BraveSearchResult {
  title: string;
  url: string;
  description: string;
}

export interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

export interface SearchResults {
  query: string;
  engine: string;
  brave?: BraveSearchResult[];
  tavily?: TavilySearchResult[];
  answer?: string;
  braveError?: string;
  tavilyError?: string;
}

export interface FetchResult {
  url: string;
  title: string;
  content: string;
  excerpt?: string;
  siteName?: string;
  originalLength: number;
  truncated: boolean;
}

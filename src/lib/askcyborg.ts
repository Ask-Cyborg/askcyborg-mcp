/**
 * Thin client over AskCyborg public surfaces. v0.1 reads preview data from
 * the public JSON files served at /preview_companies_data_N.json. Future
 * versions will hit a dedicated AskCyborg API + Supabase for paid-tier data.
 */
import { askCyborgConfig } from "./config.js";

export interface PreviewQuickData {
  companyName?: string;
  companyType?: string;
  cyborgScore?: { score?: number; rationale?: string };
  industryAnalysis?: { industry?: string };
  metrics?: Record<string, unknown>;
  executiveSummary?: {
    leadParagraph?: string;
    strategicProfile?: string;
  };
  // Each insight is a single sentence/paragraph string, not an object.
  insights?: string[];
  // Competitors are { name, tagline, companyName } objects (the company being competed against).
  competitors?: Array<{ name?: string; tagline?: string; companyName?: string }>;
  // Each development is a string typically prefixed with "(Month YYYY) ..."
  recentDevelopments?: string[];
  entityIdentifiers?: Record<string, unknown>;
}

export interface PreviewEntry {
  company_key: string;
  company_name?: string;
  quick_data?: PreviewQuickData;
}

let _cache: PreviewEntry[] | null = null;
let _cacheTimestamp = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function loadPreviewCorpus(): Promise<PreviewEntry[]> {
  const now = Date.now();
  if (_cache && now - _cacheTimestamp < CACHE_TTL_MS) return _cache;

  const combined: PreviewEntry[] = [];
  const fetches = [1, 2, 3, 4, 5, 6].map((n) =>
    fetch(`${askCyborgConfig.apiBase}/preview_companies_data_${n}.json`),
  );
  const responses = await Promise.all(fetches);
  for (const resp of responses) {
    if (resp.ok) {
      const chunk = (await resp.json()) as PreviewEntry[];
      for (const entry of chunk) combined.push(entry);
    }
  }
  _cache = combined;
  _cacheTimestamp = now;
  return combined;
}

export async function findCompany(slugOrName: string): Promise<PreviewEntry | null> {
  const corpus = await loadPreviewCorpus();
  const lower = slugOrName.toLowerCase().trim();
  const slug = lower.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return (
    corpus.find((e) => e.company_key.toLowerCase() === slug) ??
    corpus.find((e) => (e.company_name ?? "").toLowerCase() === lower) ??
    corpus.find((e) => (e.company_name ?? "").toLowerCase().includes(lower)) ??
    null
  );
}

export async function searchCompanies(
  query: string,
  limit = 10,
): Promise<PreviewEntry[]> {
  const corpus = await loadPreviewCorpus();
  const q = query.toLowerCase().trim();
  const matches: Array<{ entry: PreviewEntry; rank: number }> = [];
  for (const e of corpus) {
    const name = (e.company_name ?? "").toLowerCase();
    const key = e.company_key.toLowerCase();
    let rank = 0;
    if (name === q || key === q) rank = 100;
    else if (name.startsWith(q) || key.startsWith(q)) rank = 50;
    else if (name.includes(q) || key.includes(q)) rank = 25;
    if (rank > 0) matches.push({ entry: e, rank });
  }
  matches.sort((a, b) => b.rank - a.rank);
  return matches.slice(0, limit).map((m) => m.entry);
}

export function previewUrl(slug: string): string {
  return `${askCyborgConfig.apiBase}/preview/${slug}`;
}

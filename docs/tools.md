# AskCyborg MCP Tools — Reference

This document describes each tool the AskCyborg MCP server exposes. Tools follow the [Model Context Protocol spec](https://modelcontextprotocol.io/specification/2025-03-26).

## `search_companies`

Search AskCyborg's corpus by name or industry keyword.

**Parameters:**
- `query` (string, required) — Company name, partial name, or industry keyword.
- `limit` (integer, optional, default 10, max 25) — Max results.

**Returns:** Markdown list of matches with company name, Cyborg Score, one-line strategic profile, and preview URL.

**Example:**
```json
{
  "name": "search_companies",
  "arguments": { "query": "semiconductor", "limit": 5 }
}
```

## `get_company_report`

Fetch a structured research brief for a single company.

**Parameters:**
- `company` (string, required) — Name, ticker, or slug.

**Returns:** Markdown report with executive summary, Cyborg Score + rationale, strategic profile, bull/bear cases, key insights, competitive landscape, recent developments, and a link to the full 30-page report + analyst-debate audio.

**Example:**
```json
{
  "name": "get_company_report",
  "arguments": { "company": "OpenAI" }
}
```

## `get_cyborg_score`

Rating-only lookup.

**Parameters:**
- `company` (string, required).

**Returns:** Cyborg Score (1-10) + rationale + link to full breakdown.

## `compare_companies`

Side-by-side comparison of 2-5 companies.

**Parameters:**
- `companies` (array of strings, required, 2-5 entries).

**Returns:** Markdown table comparing Cyborg Score, industry, and strategic profile, plus per-company top insights.

**Example:**
```json
{
  "name": "compare_companies",
  "arguments": { "companies": ["OpenAI", "Anthropic", "Mistral"] }
}
```

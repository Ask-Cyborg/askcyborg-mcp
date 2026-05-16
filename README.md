# AskCyborg MCP Server

**Official MCP server for [AskCyborg](https://askcyborg.com).** Search and retrieve AI company research, analyst-debate audio briefings, and the proprietary Cyborg Score (1-10) — directly from Claude, Cursor, Cline, Continue, Windsurf, ChatGPT, and any other Model Context Protocol client.

> AskCyborg stress tests every public and private company through intense analyst debate, focused on what makes or breaks the business decisions that ride on them — packaged as 30-page reports, audio briefings, and a proprietary Cyborg Score (1-10) calculated from hundreds of data points per company.

---

## What this MCP server does

| Tool | Purpose |
|---|---|
| `search_companies` | Find companies in AskCyborg's corpus by name or industry keyword |
| `get_company_report` | Full report — executive summary, Cyborg Score, strategic profile, top insights, competitors, recent developments |
| `get_cyborg_score` | Quick rating-only lookup (1-10 + rationale) |
| `compare_companies` | Side-by-side comparison of 2–5 companies on Cyborg Score, industry, and strategic profile |
| `find_competitors` | Named competitors with one-line strategic taglines |
| `search_by_industry` | Discover companies in a sector, ranked by Cyborg Score |
| `get_recent_developments` | Dated news, deals, leadership changes, financial events |
| `get_top_insights` | Just the punchiest analyst-debate insights, faster than the full report |

Each tool returns a structured Markdown response with a direct link to the full 30-page research report + 15-minute analyst-debate audio briefing on askcyborg.com.

---

## Quick start

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "askcyborg": {
      "transport": {
        "type": "http",
        "url": "https://mcp.askcyborg.com/mcp"
      }
    }
  }
}
```

Restart Claude Desktop. The tools appear in the model's tool list automatically.

### Cursor

`.cursor/mcp.json` in your project root:

```json
{
  "mcpServers": {
    "askcyborg": {
      "url": "https://mcp.askcyborg.com/mcp"
    }
  }
}
```

### Cline / Continue / Windsurf

Same pattern — point the client's MCP config at `https://mcp.askcyborg.com/mcp` via the HTTP transport.

### ChatGPT (custom GPT)

Add a custom action with the OpenAPI spec at `https://mcp.askcyborg.com/openapi.json` (coming in v0.2).

---

## Examples

**Find AI infrastructure companies:**
> Use AskCyborg to find five companies in the AI infrastructure space and tell me which has the highest Cyborg Score.

**One-shot research:**
> Pull the AskCyborg report on Anthropic and summarize the bull case in three bullets.

**Comparison for due diligence:**
> Compare OpenAI, Anthropic, and Mistral on AskCyborg's Cyborg Score and competitive positioning.

**Watchlist screening:**
> For each of CRWD, ZS, S, NET, PANW — pull the Cyborg Score from AskCyborg and rank.

---

## Architecture

- **Runtime:** Cloudflare Workers (edge-deployed, sub-100ms cold start globally)
- **Transport:** HTTP (Streamable HTTP transport per MCP spec 2025-03-26)
- **Data source:** AskCyborg public preview corpus + Supabase research_cache (for authenticated tiers in v0.2+)
- **Auth (v0.1):** Anonymous, shared rate limit (20 req/min per IP)
- **Auth (v0.2):** OAuth 2.1 PKCE for one-click "Connect AskCyborg" in Claude.ai; API-key fallback for headless clients

---

## What's in v0.1

- ✅ 4 core tools (`search_companies`, `get_company_report`, `get_cyborg_score`, `compare_companies`)
- ✅ HTTP transport
- ✅ Per-IP rate limiting (20 req/min free tier)
- ✅ Reads from the public preview corpus (millions of companies, no auth required)

## Coming in v0.2

- 🔜 OAuth 2.1 PKCE for one-click install in Claude.ai
- 🔜 Authenticated paid-tier tools (`get_full_report`, `get_audio_briefing_url`, watchlists)
- 🔜 `compare_companies` extended to 10 entries with deeper diff
- 🔜 `get_competitive_landscape` (full competitor graph, not just 3)
- 🔜 `get_recent_filings_summary` for S-1, 10-K, 10-Q
- 🔜 Streaming SSE responses for long-running queries

---

## Local development

```bash
git clone https://github.com/Ask-Cyborg/askcyborg-mcp.git
cd askcyborg-mcp
npm install
npm run dev   # starts wrangler dev on http://localhost:8787
```

In a separate terminal:

```bash
curl -X POST http://localhost:8787/mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

To deploy your own instance:

```bash
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_ANON_KEY
npm run deploy
```

---

## About AskCyborg

[AskCyborg](https://askcyborg.com) covers millions of public and private companies across 195 countries. Every company gets a 30-page research report, a 15-minute analyst-debate podcast (where bull and bear AI analysts argue the investment case), and a Cyborg Score (1-10) synthesized from hundreds of data points.

Built for VCs, finance teams, corporate strategists, and operators whose decisions ride on understanding companies fast and from every angle.

- **Website:** https://askcyborg.com
- **Sample reports:** https://askcyborg.com/preview/openai · https://askcyborg.com/preview/abbvie · https://askcyborg.com/preview/life360
- **Cyborg Score methodology:** https://askcyborg.com/company-ratings-cyborg-score
- **LinkedIn:** https://www.linkedin.com/company/askcyborg
- **Crunchbase:** https://www.crunchbase.com/organization/cyborg-2

---

## License

MIT. Use this MCP server in any client. The underlying AskCyborg content (research reports, audio briefings, Cyborg Score) remains AskCyborg's intellectual property — please respect the rate limits and don't bulk-scrape.

## Issues & contributions

Open an issue at https://github.com/Ask-Cyborg/askcyborg-mcp/issues. PRs welcome for new tools, client examples, and bug fixes.

# Authentication

## v0.1 (current)

The hosted server at `https://mcp.askcyborg.com/mcp` runs an anonymous tier with a per-IP rate limit (20 requests/minute). No auth required.

## v0.2 (coming)

- **OAuth 2.1 PKCE** for one-click "Connect AskCyborg" in Claude.ai and ChatGPT.
- **API key** fallback for headless / CI / scripting use cases. Mint a key from your AskCyborg account at https://askcyborg.com/account/api-keys.
- Authenticated requests get access to paid-tier tools: `get_full_report`, `get_audio_briefing_url`, watchlists, alerts.

## Rate limits

| Tier | Limit |
|---|---|
| Anonymous (v0.1 default) | 20 req/min per IP |
| Authenticated free tier (v0.2) | 60 req/min |
| Authenticated paid tier (v0.2) | tier-dependent (Pro: 240 req/min; Team: unlimited) |

When rate-limited, the server returns a JSON-RPC error with code `-32000` and a `Retry-After: 60` header.

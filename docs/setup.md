# Setup Guide

## Hosted (recommended)

The official AskCyborg MCP server is at `https://mcp.askcyborg.com/mcp`. No installation, no API key for the free tier.

See the example client configs in [/examples](../examples/) for Claude Desktop, Cursor, Cline, Continue, and Windsurf.

## Self-hosted

If you want to run your own instance (for higher rate limits, custom tools, or development):

### Prerequisites
- Node.js 20+
- A Cloudflare account with Workers enabled
- `wrangler` CLI (`npm install -g wrangler`)

### Steps

```bash
git clone https://github.com/Ask-Cyborg/askcyborg-mcp.git
cd askcyborg-mcp
npm install
wrangler login
wrangler secret put SUPABASE_URL          # optional — only needed for paid-tier tools
wrangler secret put SUPABASE_ANON_KEY     # optional
npm run deploy
```

Point your MCP client at `https://<your-worker>.workers.dev/mcp`.

### Local dev

```bash
npm run dev
# Worker runs at http://localhost:8787
```

Test:
```bash
curl -X POST http://localhost:8787/mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

# Deploy

The MCP server is deployed to Cloudflare Workers and live at:

- **https://mcp.askcyborg.com/mcp** — primary public endpoint (custom domain)
- **https://askcyborg-mcp.steve-64e.workers.dev/mcp** — fallback (workers.dev URL)

Both endpoints serve identical content. Clients should prefer `mcp.askcyborg.com`.

## Auto-deploy

Workers Builds is connected to this GitHub repo and rebuilds on every push to `main`. Build history:

https://dash.cloudflare.com/64e88725aa8e331555cc09837bf52b6e/workers/services/view/askcyborg-mcp/production/builds

The custom-domain binding is declared in `wrangler.toml` (`routes = [{ pattern = "mcp.askcyborg.com", custom_domain = true }]`) and is reapplied on each deploy.

## Verifying a successful deploy

```bash
BASE='https://mcp.askcyborg.com'

# /health should include "protocol": "2025-03-26"
curl -sf "$BASE/health" | jq .

# tools/list should return 4 tools
curl -sf -X POST "$BASE/mcp" \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' \
  | jq '.result.tools | length'   # expect 4

# tools/call search_companies
curl -sf -X POST "$BASE/mcp" \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"search_companies","arguments":{"query":"openai","limit":3}}}' \
  | jq '.result.content[0].text' -r
```

## Backup deploy paths (if Workers Builds is paused or broken)

### Option A: Manual redeploy from the Cloudflare dashboard

1. Open https://dash.cloudflare.com/64e88725aa8e331555cc09837bf52b6e/workers/services/view/askcyborg-mcp/production/builds
2. Click the most recent build → **Retry build**, or click **Deployments** → **Deploy latest commit**
3. Wait ~30 seconds for the build to complete

### Option B: Enable GitHub Actions deploy workflow

```bash
# Create a Cloudflare API token: https://dash.cloudflare.com/profile/api-tokens
#   - Use template "Edit Cloudflare Workers"
#   - Permissions: Account.Workers Scripts:Edit, Account.Account Settings:Read

gh secret set CLOUDFLARE_API_TOKEN --repo Ask-Cyborg/askcyborg-mcp
gh secret set CLOUDFLARE_ACCOUNT_ID --repo Ask-Cyborg/askcyborg-mcp --body 64e88725aa8e331555cc09837bf52b6e
gh variable set HAS_CLOUDFLARE_SECRETS --repo Ask-Cyborg/askcyborg-mcp --body true
gh workflow run "Deploy MCP Server to Cloudflare Workers" --repo Ask-Cyborg/askcyborg-mcp --ref main
```

### Option C: Local wrangler deploy from a developer machine

```bash
git clone https://github.com/Ask-Cyborg/askcyborg-mcp.git
cd askcyborg-mcp
npm install -g wrangler
wrangler login
wrangler deploy
```

## Heads-up: build minutes quota

The Cloudflare dashboard previously warned that this account is approaching its monthly Workers Builds minutes quota (2,824 / 3,000 used). If auto-builds pause, use Option A or B above as a fallback.

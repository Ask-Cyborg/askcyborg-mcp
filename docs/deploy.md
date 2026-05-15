# Deploy

The MCP server is deployed to Cloudflare Workers at:

**https://askcyborg-mcp.steve-64e.workers.dev**

## Current state

| Surface | Status |
|---|---|
| Worker exists on Cloudflare | ✅ Yes — created via Workers Builds dashboard on 2026-05-15 |
| First deploy (v0.1 — buggy SDK call) | ✅ Live |
| Latest code on main (v0.1.1 — JSON-RPC dispatcher fix) | ⏳ Pushed to GitHub but **NOT yet redeployed** to Cloudflare |
| `/health` endpoint | ✅ Working — returns server metadata |
| `/mcp` endpoint with v0.1 code | ❌ Returns `server._oncrequest is not a function` (the SDK API bug fixed in v0.1.1) |

## To deploy the latest code on main

Pick whichever is easiest:

### Option A: Manual redeploy from the Cloudflare dashboard (10 seconds, no auth setup)

1. Go to https://dash.cloudflare.com/64e88725aa8e331555cc09837bf52b6e/workers/services/view/askcyborg-mcp/production/builds
2. Click the most recent build → **Retry build**, or click **Deployments** → **Deploy latest commit**
3. Wait ~30 seconds for the build to complete
4. Verify: `curl -sf https://askcyborg-mcp.steve-64e.workers.dev/health | jq .protocol` should return `"2025-03-26"`

### Option B: Enable the GitHub Actions deploy workflow (one-time setup, then automatic forever)

```bash
# Create a Cloudflare API token: https://dash.cloudflare.com/profile/api-tokens
#   - Use template "Edit Cloudflare Workers"
#   - Scope to the AskCyborg account
#   - Permissions: Account.Workers Scripts:Edit, Account.Account Settings:Read

gh secret set CLOUDFLARE_API_TOKEN --repo Ask-Cyborg/askcyborg-mcp
gh secret set CLOUDFLARE_ACCOUNT_ID --repo Ask-Cyborg/askcyborg-mcp --body 64e88725aa8e331555cc09837bf52b6e
gh variable set HAS_CLOUDFLARE_SECRETS --repo Ask-Cyborg/askcyborg-mcp --body true
gh workflow run "Deploy MCP Server to Cloudflare Workers" --repo Ask-Cyborg/askcyborg-mcp --ref main
```

After this, every push to main auto-deploys.

### Option C: Local wrangler deploy from a developer machine

```bash
git clone https://github.com/Ask-Cyborg/askcyborg-mcp.git
cd askcyborg-mcp
npm install -g wrangler
wrangler login
wrangler deploy
```

## Verifying a successful deploy

```bash
BASE='https://askcyborg-mcp.steve-64e.workers.dev'

# /health should include "protocol": "2025-03-26" after v0.1.1 deploys
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

## Cloudflare Workers Builds auto-deploy

The Worker was created via the dashboard's "Continue with GitHub" wizard, which connected the repo. Auto-deploy on push to main *should* work, but didn't trigger on the v0.1.1 push (push at 2026-05-15T21:24:12Z, no corresponding build entry). Possible causes:

1. Build minutes monthly quota close to limit (the dashboard showed a warning about this — 2,824 / 3,000 used)
2. Webhook delivery hiccup on the first auto-trigger attempt
3. Auto-build requires explicit enablement in Settings → Build that wasn't on

If the dashboard manual retry (Option A) works, the auto-build should resume. If not, GH Actions (Option B) is the robust fallback.

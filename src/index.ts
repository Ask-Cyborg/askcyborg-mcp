/**
 * AskCyborg MCP Server — Cloudflare Worker entry point.
 *
 * Exposes Model Context Protocol over Streamable HTTP transport.
 * Compatible with: Claude Desktop, Claude.ai (via OAuth in v2),
 * Cursor, Cline, Continue, Windsurf, ChatGPT, mcp.so, Pulse MCP.
 *
 * Spec: https://modelcontextprotocol.io/specification/2025-03-26
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { searchCompaniesTool, runSearchCompanies } from "./tools/search.js";
import { getCompanyReportTool, runGetCompanyReport } from "./tools/report.js";
import { getCyborgScoreTool, runGetCyborgScore } from "./tools/cyborgScore.js";
import { compareCompaniesTool, runCompareCompanies } from "./tools/compare.js";
import { askCyborgConfig } from "./lib/config.js";

interface Env {
  ASKCYBORG_API_BASE: string;
  RATE_LIMIT_FREE_PER_MIN: string;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
}

function buildServer() {
  const server = new Server(
    {
      name: "askcyborg-mcp",
      version: "0.1.0",
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  // ---- tools/list ----
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      searchCompaniesTool,
      getCompanyReportTool,
      getCyborgScoreTool,
      compareCompaniesTool,
    ],
  }));

  // ---- tools/call ----
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    switch (name) {
      case "search_companies":
        return runSearchCompanies(args ?? {});
      case "get_company_report":
        return runGetCompanyReport(args ?? {});
      case "get_cyborg_score":
        return runGetCyborgScore(args ?? {});
      case "compare_companies":
        return runCompareCompanies(args ?? {});
      default:
        return {
          content: [{ type: "text", text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  });

  return server;
}

/**
 * Per-isolate, approximate rate limiter. Keyed by IP address.
 * Production hardening: replace with Cloudflare Durable Objects or
 * Workers Rate Limiting Rules for cross-isolate accuracy.
 */
const rateLimitState = new Map<string, { windowStart: number; count: number }>();
function isRateLimited(ip: string, maxPerMin: number): boolean {
  if (!ip || ip === "unknown") return false;
  const now = Date.now();
  const entry = rateLimitState.get(ip);
  if (!entry || now - entry.windowStart > 60_000) {
    rateLimitState.set(ip, { windowStart: now, count: 1 });
    return false;
  }
  entry.count++;
  return entry.count > maxPerMin;
}

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    // Propagate env to the tool implementations via a module-level config object.
    // Cloudflare Workers don't allow Node-style globals; this is the simplest
    // pattern for sharing env without threading it through every function.
    askCyborgConfig.apiBase = env.ASKCYBORG_API_BASE;
    askCyborgConfig.supabaseUrl = env.SUPABASE_URL;
    askCyborgConfig.supabaseAnonKey = env.SUPABASE_ANON_KEY;

    const url = new URL(request.url);

    // CORS preflight — MCP clients (especially browser-based Cursor extensions)
    // expect liberal CORS. Tighten in production once auth is in place.
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization, MCP-Session-Id",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    // Health check / discovery endpoint
    if (url.pathname === "/" || url.pathname === "/health") {
      return new Response(
        JSON.stringify({
          name: "askcyborg-mcp",
          version: "0.1.0",
          description:
            "Official MCP server for AskCyborg — search and retrieve AI company research, analyst-debate audio briefings, and Cyborg Score ratings.",
          docs: "https://github.com/Ask-Cyborg/askcyborg-mcp",
          tools: ["search_companies", "get_company_report", "get_cyborg_score", "compare_companies"],
        }),
        {
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Access-Control-Allow-Origin": "*",
          },
        },
      );
    }

    // MCP endpoint — Streamable HTTP transport per spec 2025-03-26.
    // Accepts POST with JSON-RPC payload; returns JSON or SSE.
    if (url.pathname === "/mcp" || url.pathname === "/sse") {
      const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
      const maxPerMin = parseInt(env.RATE_LIMIT_FREE_PER_MIN ?? "20", 10);
      if (isRateLimited(ip, maxPerMin)) {
        return new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            error: { code: -32000, message: "Rate limit exceeded. Try again in 60s." },
            id: null,
          }),
          {
            status: 429,
            headers: {
              "Content-Type": "application/json",
              "Retry-After": "60",
              "Access-Control-Allow-Origin": "*",
            },
          },
        );
      }

      if (request.method !== "POST") {
        return new Response("Method not allowed", { status: 405 });
      }

      // Parse JSON-RPC request, route through MCP server
      const server = buildServer();

      let body: unknown;
      try {
        body = await request.json();
      } catch (e) {
        return new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            error: { code: -32700, message: "Parse error" },
            id: null,
          }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }

      // Handle JSON-RPC request directly via the Server's internal dispatch.
      // This is a simplified single-request handler. For full Streamable HTTP
      // (session management, server-initiated requests, SSE), wire up the
      // MCP SDK's transport layer in a follow-up.
      try {
        // @ts-expect-error — internal API; will switch to official transport in v0.2
        const response = await server._oncrequest(body);
        return new Response(JSON.stringify(response), {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        return new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            error: { code: -32603, message: `Internal error: ${message}` },
            id: (body as { id?: unknown })?.id ?? null,
          }),
          { status: 500, headers: { "Content-Type": "application/json" } },
        );
      }
    }

    return new Response("Not Found", { status: 404 });
  },
};

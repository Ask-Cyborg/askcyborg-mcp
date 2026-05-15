/**
 * AskCyborg MCP Server — Cloudflare Worker entry point.
 *
 * Exposes Model Context Protocol over Streamable HTTP transport.
 * Compatible with: Claude Desktop, Claude.ai (via OAuth in v2),
 * Cursor, Cline, Continue, Windsurf, ChatGPT, mcp.so, Pulse MCP.
 *
 * Spec: https://modelcontextprotocol.io/specification/2025-03-26
 *
 * Note: This deliberately does NOT use the @modelcontextprotocol/sdk's
 * Server class because that SDK ships a transport layer designed for
 * stdio + Node.js. Cloudflare Workers don't have stdio. Instead this
 * file implements the MCP JSON-RPC subset directly: initialize,
 * tools/list, tools/call. The protocol surface is tiny and the SDK
 * value-add is mostly schemas, which we duplicate here as plain JSON
 * Schemas in each tool module.
 */

import { searchCompaniesTool, runSearchCompanies } from "./tools/search.js";
import { getCompanyReportTool, runGetCompanyReport } from "./tools/report.js";
import { getCyborgScoreTool, runGetCyborgScore } from "./tools/cyborgScore.js";
import { compareCompaniesTool, runCompareCompanies } from "./tools/compare.js";
import { askCyborgConfig } from "./lib/config.js";

interface Env {
  ASKCYBORG_API_BASE: string;
  RATE_LIMIT_FREE_PER_MIN: string;
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
}

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: number | string | null;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number | string | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

const SERVER_NAME = "askcyborg-mcp";
const SERVER_VERSION = "0.1.0";
const PROTOCOL_VERSION = "2025-03-26";

const TOOLS = [
  searchCompaniesTool,
  getCompanyReportTool,
  getCyborgScoreTool,
  compareCompaniesTool,
];

async function callTool(name: string, args: Record<string, unknown>) {
  switch (name) {
    case "search_companies":
      return runSearchCompanies(args);
    case "get_company_report":
      return runGetCompanyReport(args);
    case "get_cyborg_score":
      return runGetCyborgScore(args);
    case "compare_companies":
      return runCompareCompanies(args);
    default:
      return {
        content: [{ type: "text", text: `Unknown tool: ${name}` }],
        isError: true,
      };
  }
}

// A JSON-RPC message is a notification iff `id` is absent (per JSON-RPC 2.0).
// Notifications MUST NOT receive a response.
function isNotification(req: JsonRpcRequest): boolean {
  return !("id" in req) || req.id === undefined;
}

async function handleJsonRpc(req: JsonRpcRequest): Promise<JsonRpcResponse | null> {
  // Notifications: process side-effects but return no response.
  if (isNotification(req)) {
    // initialize / initialized / notifications/* — accept silently.
    return null;
  }

  const id = req.id ?? null;
  try {
    switch (req.method) {
      case "initialize":
        return {
          jsonrpc: "2.0",
          id,
          result: {
            protocolVersion: PROTOCOL_VERSION,
            capabilities: { tools: { listChanged: false } },
            serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
          },
        };

      case "initialized":
      case "notifications/initialized":
        // Defensive — these are normally notifications, but tolerate the
        // request form too.
        return { jsonrpc: "2.0", id, result: {} };

      case "tools/list":
        return { jsonrpc: "2.0", id, result: { tools: TOOLS } };

      case "tools/call": {
        const params = req.params ?? {};
        const name = typeof params.name === "string" ? params.name : "";
        const args =
          typeof params.arguments === "object" && params.arguments !== null
            ? (params.arguments as Record<string, unknown>)
            : {};
        const result = await callTool(name, args);
        return { jsonrpc: "2.0", id, result };
      }

      case "ping":
        return { jsonrpc: "2.0", id, result: {} };

      default:
        return {
          jsonrpc: "2.0",
          id,
          error: { code: -32601, message: `Method not found: ${req.method}` },
        };
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return {
      jsonrpc: "2.0",
      id,
      error: { code: -32603, message: `Internal error: ${message}` },
    };
  }
}

// Per-isolate, approximate rate limiter. Keyed by IP. Replace with Durable
// Objects for cross-isolate accuracy in v0.2.
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

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS, DELETE",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Mcp-Session-Id, Last-Event-ID",
  "Access-Control-Expose-Headers": "Mcp-Session-Id",
  "Access-Control-Max-Age": "86400",
};

// Generate a stable-ish session id. We're stateless so the value is purely
// advisory — clients echo it back, but we don't enforce continuity.
function generateSessionId(): string {
  return crypto.randomUUID();
}

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    askCyborgConfig.apiBase = env.ASKCYBORG_API_BASE;
    askCyborgConfig.supabaseUrl = env.SUPABASE_URL ?? "";
    askCyborgConfig.supabaseAnonKey = env.SUPABASE_ANON_KEY ?? "";

    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // Discovery / health
    if (url.pathname === "/" || url.pathname === "/health") {
      return new Response(
        JSON.stringify({
          name: SERVER_NAME,
          version: SERVER_VERSION,
          protocol: PROTOCOL_VERSION,
          description:
            "Official MCP server for AskCyborg — search and retrieve AI company research, analyst-debate audio briefings, and Cyborg Score ratings.",
          docs: "https://github.com/Ask-Cyborg/askcyborg-mcp",
          tools: TOOLS.map((t) => t.name),
          mcp_endpoint: "/mcp",
        }),
        {
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            ...CORS_HEADERS,
          },
        },
      );
    }

    // MCP JSON-RPC endpoint (Streamable HTTP transport)
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
              ...CORS_HEADERS,
            },
          },
        );
      }

      // GET: client opens an SSE stream for server-initiated messages.
      // We're stateless and never push, so return an immediately-closed stream.
      if (request.method === "GET") {
        const stream = new ReadableStream({
          start(controller) {
            // Single comment line keeps some SSE parsers happy, then close.
            controller.enqueue(new TextEncoder().encode(": stream open\n\n"));
            controller.close();
          },
        });
        return new Response(stream, {
          status: 200,
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
            ...CORS_HEADERS,
          },
        });
      }

      // DELETE: client asks to terminate a session. We have no session state,
      // so just acknowledge.
      if (request.method === "DELETE") {
        return new Response(null, { status: 204, headers: CORS_HEADERS });
      }

      if (request.method !== "POST") {
        return new Response("Method not allowed. POST a JSON-RPC body.", {
          status: 405,
          headers: { ...CORS_HEADERS, Allow: "GET, POST, DELETE, OPTIONS" },
        });
      }

      let body: unknown;
      try {
        body = await request.json();
      } catch (_e) {
        return new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            error: { code: -32700, message: "Parse error" },
            id: null,
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json", ...CORS_HEADERS },
          },
        );
      }

      const sessionId =
        request.headers.get("Mcp-Session-Id") ??
        request.headers.get("mcp-session-id") ??
        generateSessionId();

      // Build the response. Notifications-only POSTs return 202.
      // Batch with mixed notifications: drop nulls (notification responses).
      if (Array.isArray(body)) {
        const responses = (
          await Promise.all(body.map((r) => handleJsonRpc(r as JsonRpcRequest)))
        ).filter((r): r is JsonRpcResponse => r !== null);

        if (responses.length === 0) {
          return new Response(null, {
            status: 202,
            headers: { "Mcp-Session-Id": sessionId, ...CORS_HEADERS },
          });
        }
        return new Response(JSON.stringify(responses), {
          headers: {
            "Content-Type": "application/json",
            "Mcp-Session-Id": sessionId,
            ...CORS_HEADERS,
          },
        });
      }

      const response = await handleJsonRpc(body as JsonRpcRequest);
      if (response === null) {
        // Notification — return 202 Accepted with no body per JSON-RPC 2.0.
        return new Response(null, {
          status: 202,
          headers: { "Mcp-Session-Id": sessionId, ...CORS_HEADERS },
        });
      }
      return new Response(JSON.stringify(response), {
        headers: {
          "Content-Type": "application/json",
          "Mcp-Session-Id": sessionId,
          ...CORS_HEADERS,
        },
      });
    }

    return new Response("Not Found. See / for discovery.", {
      status: 404,
      headers: CORS_HEADERS,
    });
  },
};

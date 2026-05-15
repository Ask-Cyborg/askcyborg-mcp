import { searchCompanies, previewUrl } from "../lib/askcyborg.js";

export const searchCompaniesTool = {
  name: "search_companies",
  description:
    "Search AskCyborg's corpus of company research by name or industry keyword. Returns up to N matches with company name, Cyborg Score, one-line strategic profile, and the URL to the full preview report. Use this first when the user mentions a company you want to research, or to discover companies in a category.",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description:
          "Company name (e.g. 'OpenAI', 'Stripe'), partial name, or industry keyword (e.g. 'semiconductor', 'biotech').",
      },
      limit: {
        type: "integer",
        description: "Max results to return. Default 10, max 25.",
        minimum: 1,
        maximum: 25,
      },
    },
    required: ["query"],
  },
};

export async function runSearchCompanies(args: Record<string, unknown>) {
  const query = typeof args.query === "string" ? args.query : "";
  const limit = Math.min(
    typeof args.limit === "number" ? args.limit : 10,
    25,
  );
  if (!query.trim()) {
    return {
      content: [{ type: "text", text: "Error: 'query' parameter is required." }],
      isError: true,
    };
  }

  const results = await searchCompanies(query, limit);
  if (results.length === 0) {
    return {
      content: [
        {
          type: "text",
          text: `No companies found matching "${query}". AskCyborg covers millions of public + private companies; try a different spelling or check the company's legal name.`,
        },
      ],
    };
  }

  const lines = [
    `Found ${results.length} ${results.length === 1 ? "match" : "matches"} for "${query}":\n`,
  ];
  for (const entry of results) {
    const name = entry.company_name ?? entry.company_key;
    const score = entry.quick_data?.cyborgScore?.score;
    const strategic = entry.quick_data?.executiveSummary?.strategicProfile ?? "";
    const trimmed = strategic.length > 200 ? strategic.slice(0, 197) + "..." : strategic;
    lines.push(
      `- ${name}${score !== undefined ? ` (Cyborg Score ${score}/10)` : ""}\n  ${trimmed}\n  Preview: ${previewUrl(entry.company_key)}\n`,
    );
  }
  return { content: [{ type: "text", text: lines.join("\n") }] };
}

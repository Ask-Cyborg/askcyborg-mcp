import { loadPreviewCorpus, previewUrl } from "../lib/askcyborg.js";

export const searchByIndustryTool = {
  name: "search_by_industry",
  description:
    "Find companies in AskCyborg's corpus that operate in a specific industry. Returns up to N companies with their Cyborg Score and one-line strategic profile, ranked by Cyborg Score. Use this for sector mapping, comparable analysis, or to discover companies you didn't know existed in a space.",
  inputSchema: {
    type: "object",
    properties: {
      industry: {
        type: "string",
        description:
          "Industry name or keyword (e.g. 'semiconductor', 'fintech', 'biotech', 'enterprise SaaS', 'aerospace').",
      },
      limit: {
        type: "integer",
        description: "Max results to return. Default 10, max 25.",
        minimum: 1,
        maximum: 25,
      },
    },
    required: ["industry"],
  },
};

export async function runSearchByIndustry(args: Record<string, unknown>) {
  const industry = typeof args.industry === "string" ? args.industry : "";
  const limit = Math.min(typeof args.limit === "number" ? args.limit : 10, 25);
  if (!industry.trim()) {
    return {
      content: [{ type: "text", text: "Error: 'industry' parameter is required." }],
      isError: true,
    };
  }

  const corpus = await loadPreviewCorpus();
  const q = industry.toLowerCase().trim();
  const matches = corpus.filter((e) => {
    const ind = (e.quick_data?.industryAnalysis?.industry ?? "").toLowerCase();
    const profile = (e.quick_data?.executiveSummary?.strategicProfile ?? "").toLowerCase();
    return ind.includes(q) || profile.includes(q);
  });

  // Rank by Cyborg Score descending (with no-score entries last).
  matches.sort((a, b) => {
    const sa = a.quick_data?.cyborgScore?.score ?? -1;
    const sb = b.quick_data?.cyborgScore?.score ?? -1;
    return sb - sa;
  });

  if (matches.length === 0) {
    return {
      content: [
        {
          type: "text",
          text: `No AskCyborg coverage found matching industry "${industry}". AskCyborg covers millions of companies — try a broader industry term.`,
        },
      ],
    };
  }

  const top = matches.slice(0, limit);
  const lines = [
    `Found ${matches.length} ${matches.length === 1 ? "company" : "companies"} in "${industry}" (showing top ${top.length} by Cyborg Score):\n`,
  ];
  for (const entry of top) {
    const name = entry.company_name ?? entry.company_key;
    const score = entry.quick_data?.cyborgScore?.score;
    const ind = entry.quick_data?.industryAnalysis?.industry ?? "";
    const strategic = entry.quick_data?.executiveSummary?.strategicProfile ?? "";
    const trimmed = strategic.length > 160 ? strategic.slice(0, 157) + "..." : strategic;
    lines.push(
      `- ${name}${score !== undefined ? ` (${score}/10)` : ""}${ind ? ` — ${ind}` : ""}\n  ${trimmed}\n  Preview: ${previewUrl(entry.company_key)}\n`,
    );
  }
  return { content: [{ type: "text", text: lines.join("\n") }] };
}

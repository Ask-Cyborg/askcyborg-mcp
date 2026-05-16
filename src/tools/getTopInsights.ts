import { findCompany, previewUrl } from "../lib/askcyborg.js";

export const getTopInsightsTool = {
  name: "get_top_insights",
  description:
    "Retrieve just the top analyst-debate insights for a company — the punchiest, decision-relevant claims that AskCyborg's analyst panel surfaced after stress-testing the company. Faster and more focused than get_company_report when you just need 'what should I know about this company in 60 seconds'.",
  inputSchema: {
    type: "object",
    properties: {
      company: {
        type: "string",
        description: "Company name, ticker, or slug.",
      },
    },
    required: ["company"],
  },
};

export async function runGetTopInsights(args: Record<string, unknown>) {
  const company = typeof args.company === "string" ? args.company : "";
  if (!company.trim()) {
    return {
      content: [{ type: "text", text: "Error: 'company' parameter is required." }],
      isError: true,
    };
  }

  const entry = await findCompany(company);
  if (!entry) {
    return {
      content: [
        { type: "text", text: `No AskCyborg coverage found for "${company}".` },
      ],
    };
  }

  const name = entry.company_name ?? entry.company_key;
  const insights = entry.quick_data?.insights ?? [];
  const score = entry.quick_data?.cyborgScore?.score;
  if (insights.length === 0) {
    return {
      content: [
        {
          type: "text",
          text: `**${name}** — no top-line insights captured yet. Full report: ${previewUrl(entry.company_key)}`,
        },
      ],
    };
  }

  const lines = [`**${name}**${score !== undefined ? ` (Cyborg Score ${score}/10)` : ""} — top analyst insights:\n`];
  for (const insight of insights) {
    lines.push(`- ${insight}`);
  }
  lines.push(`\nFull report: ${previewUrl(entry.company_key)}`);
  return { content: [{ type: "text", text: lines.join("\n") }] };
}

import { findCompany, previewUrl } from "../lib/askcyborg.js";

export const getCyborgScoreTool = {
  name: "get_cyborg_score",
  description:
    "Retrieve just the Cyborg Score (1-10) for a company. The Cyborg Score is AskCyborg's proprietary rating, synthesized from hundreds of data points across business model, financials, leadership, competitive position, technology, marketing, and ESG. Use this when the user wants a quick rating without the full report context.",
  inputSchema: {
    type: "object",
    properties: {
      company: {
        type: "string",
        description: "Company name or ticker.",
      },
    },
    required: ["company"],
  },
};

export async function runGetCyborgScore(args: Record<string, unknown>) {
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
        {
          type: "text",
          text: `No AskCyborg coverage found for "${company}".`,
        },
      ],
    };
  }

  const name = entry.company_name ?? entry.company_key;
  const score = entry.quick_data?.cyborgScore?.score;
  const rationale = entry.quick_data?.cyborgScore?.rationale ?? "";

  if (score === undefined) {
    return {
      content: [
        {
          type: "text",
          text: `${name} is in AskCyborg's corpus but doesn't yet have a published Cyborg Score. Full report: ${previewUrl(entry.company_key)}`,
        },
      ],
    };
  }

  return {
    content: [
      {
        type: "text",
        text: `**${name}** — Cyborg Score: **${score}/10**\n\n${rationale}\n\nFull rating breakdown: ${previewUrl(entry.company_key)}`,
      },
    ],
  };
}

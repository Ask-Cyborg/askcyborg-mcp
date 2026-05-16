import { findCompany, previewUrl } from "../lib/askcyborg.js";

export const findCompetitorsTool = {
  name: "find_competitors",
  description:
    "Find the named competitors of a company that AskCyborg's analyst panel identified as material to the target's strategic position. Returns each competitor with the one-line strategic tagline AskCyborg uses to characterize them. Useful for competitive landscape analysis, M&A short-listing, or pricing reference checks.",
  inputSchema: {
    type: "object",
    properties: {
      company: {
        type: "string",
        description: "Company name, ticker, or slug (e.g. 'OpenAI', 'AAPL', 'spacex').",
      },
    },
    required: ["company"],
  },
};

export async function runFindCompetitors(args: Record<string, unknown>) {
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
  const competitors = entry.quick_data?.competitors ?? [];
  if (competitors.length === 0) {
    return {
      content: [
        {
          type: "text",
          text: `**${name}** — no named competitors recorded in AskCyborg's current strategic profile. Full report: ${previewUrl(entry.company_key)}`,
        },
      ],
    };
  }

  const lines = [`**${name}** — competitors named in AskCyborg's strategic profile:\n`];
  for (const c of competitors) {
    const cname = c.name || c.companyName || "Unknown";
    const tagline = c.tagline ? ` — ${c.tagline}` : "";
    lines.push(`- ${cname}${tagline}`);
  }
  lines.push(`\nFull strategic profile: ${previewUrl(entry.company_key)}`);
  return { content: [{ type: "text", text: lines.join("\n") }] };
}

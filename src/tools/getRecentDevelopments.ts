import { findCompany, previewUrl } from "../lib/askcyborg.js";

export const getRecentDevelopmentsTool = {
  name: "get_recent_developments",
  description:
    "Retrieve the most recent material developments (news, deals, leadership changes, product launches, financial events) that AskCyborg's analyst panel flagged as decision-relevant for this company. Each entry is dated and concise. Use this for news catch-up before a meeting, for monitoring portfolio companies, or to spot recent strategic shifts.",
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

export async function runGetRecentDevelopments(args: Record<string, unknown>) {
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
  const developments = entry.quick_data?.recentDevelopments ?? [];
  if (developments.length === 0) {
    return {
      content: [
        {
          type: "text",
          text: `**${name}** — no recent developments captured in AskCyborg's current profile. Full report (may include older history): ${previewUrl(entry.company_key)}`,
        },
      ],
    };
  }

  const lines = [`**${name}** — recent material developments:\n`];
  for (const d of developments) {
    lines.push(`- ${d}`);
  }
  lines.push(`\nFull report: ${previewUrl(entry.company_key)}`);
  return { content: [{ type: "text", text: lines.join("\n") }] };
}

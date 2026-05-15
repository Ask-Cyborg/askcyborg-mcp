import { findCompany, previewUrl } from "../lib/askcyborg.js";

export const getCompanyReportTool = {
  name: "get_company_report",
  description:
    "Retrieve AskCyborg's structured research report for a single company. Includes executive summary, Cyborg Score with rationale, strategic profile, top insights, competitive positioning, and recent developments. Returns a paywall-aware summary; the full 30-page report and analyst-debate audio are available at the returned URL.",
  inputSchema: {
    type: "object",
    properties: {
      company: {
        type: "string",
        description:
          "Company name or ticker (e.g. 'OpenAI', 'AAPL', 'SpaceX'). Slug form accepted (e.g. 'openai').",
      },
    },
    required: ["company"],
  },
};

export async function runGetCompanyReport(args: Record<string, unknown>) {
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
          text: `No AskCyborg research found for "${company}". Try search_companies with a partial name to discover the correct entity. AskCyborg covers millions of public + private companies; some entities (newer private companies, foreign issuers) may not yet have a published preview.`,
        },
      ],
    };
  }

  const qd = entry.quick_data ?? {};
  const name = entry.company_name ?? entry.company_key;
  const score = qd.cyborgScore?.score;
  const scoreRationale = qd.cyborgScore?.rationale ?? "";
  const lead = qd.executiveSummary?.leadParagraph ?? "";
  const strategic = qd.executiveSummary?.strategicProfile ?? "";
  const bull = qd.executiveSummary?.bullCase ?? "";
  const bear = qd.executiveSummary?.bearCase ?? "";
  const industry = qd.industryAnalysis?.industry ?? "";

  const blocks: string[] = [];
  blocks.push(`# ${name} — AskCyborg Research Brief`);
  if (industry) blocks.push(`**Industry:** ${industry}`);
  if (score !== undefined) {
    blocks.push(
      `**Cyborg Score:** ${score}/10${scoreRationale ? ` — ${scoreRationale}` : ""}`,
    );
  }
  if (lead) blocks.push(`## Executive Summary\n${lead}`);
  if (strategic) blocks.push(`## Strategic Profile\n${strategic}`);
  if (bull) blocks.push(`## Bull Case\n${bull}`);
  if (bear) blocks.push(`## Bear Case\n${bear}`);

  const insights = qd.insights ?? [];
  if (insights.length > 0) {
    blocks.push(
      `## Key Insights\n${insights
        .map((i, idx) => `${idx + 1}. ${i.insight ?? ""}${i.category ? ` _(${i.category})_` : ""}`)
        .join("\n")}`,
    );
  }

  const competitors = qd.competitors ?? [];
  if (competitors.length > 0) {
    blocks.push(
      `## Competitive Landscape\n${competitors
        .map((c) => `- **${c.name ?? ""}** — ${c.positioning ?? ""}`)
        .join("\n")}`,
    );
  }

  const developments = qd.recentDevelopments ?? [];
  if (developments.length > 0) {
    blocks.push(
      `## Recent Developments\n${developments
        .slice(0, 5)
        .map((d) => `- ${d.date ? `**${d.date}** — ` : ""}${d.summary ?? ""}`)
        .join("\n")}`,
    );
  }

  blocks.push(
    `\n---\n**Full report + analyst-debate audio:** ${previewUrl(entry.company_key)}\n\n*This summary is the AskCyborg free-tier preview. The full 30-page report and 15-minute analyst-debate podcast — where bull and bear AI analysts argue the investment case — are available on the report page above.*`,
  );

  return { content: [{ type: "text", text: blocks.join("\n\n") }] };
}

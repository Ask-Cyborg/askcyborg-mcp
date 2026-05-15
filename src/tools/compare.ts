import { findCompany, previewUrl } from "../lib/askcyborg.js";

export const compareCompaniesTool = {
  name: "compare_companies",
  description:
    "Compare 2-5 companies side by side on Cyborg Score, industry, key insights, and competitive positioning. Useful for portfolio decisions, M&A short-listing, or competitive analysis.",
  inputSchema: {
    type: "object",
    properties: {
      companies: {
        type: "array",
        description: "List of 2-5 company names or slugs to compare.",
        items: { type: "string" },
        minItems: 2,
        maxItems: 5,
      },
    },
    required: ["companies"],
  },
};

export async function runCompareCompanies(args: Record<string, unknown>) {
  const companies = Array.isArray(args.companies) ? args.companies : [];
  if (companies.length < 2 || companies.length > 5) {
    return {
      content: [{ type: "text", text: "Error: 'companies' must contain 2-5 entries." }],
      isError: true,
    };
  }

  const entries = await Promise.all(
    companies.map(async (c) => ({ requested: String(c), entry: await findCompany(String(c)) })),
  );

  const found = entries.filter((e) => e.entry !== null);
  const missing = entries.filter((e) => e.entry === null);

  const lines: string[] = [];
  lines.push(`# Comparison: ${found.map((e) => e.entry!.company_name ?? e.entry!.company_key).join(" vs. ")}\n`);
  if (missing.length > 0) {
    lines.push(
      `_Not found in AskCyborg corpus: ${missing.map((m) => m.requested).join(", ")}_\n`,
    );
  }

  // Header row
  lines.push("| Company | Cyborg Score | Industry | Strategic Profile |");
  lines.push("|---|---|---|---|");
  for (const { entry } of found) {
    if (!entry) continue;
    const name = entry.company_name ?? entry.company_key;
    const qd = entry.quick_data ?? {};
    const score = qd.cyborgScore?.score;
    const industry = qd.industryAnalysis?.industry ?? "—";
    const strategic = (qd.executiveSummary?.strategicProfile ?? "")
      .replace(/\n/g, " ")
      .slice(0, 200);
    lines.push(
      `| [${name}](${previewUrl(entry.company_key)}) | ${score ?? "—"}/10 | ${industry} | ${strategic} |`,
    );
  }

  lines.push("\n---\n");
  for (const { entry } of found) {
    if (!entry) continue;
    const name = entry.company_name ?? entry.company_key;
    const insights = entry.quick_data?.insights ?? [];
    if (insights.length === 0) continue;
    lines.push(`## ${name} — Top Insights`);
    for (const i of insights.slice(0, 3)) {
      lines.push(`- ${i}`);
    }
    lines.push("");
  }

  lines.push(
    `*Full reports + analyst-debate audio for each company are at the linked URLs.*`,
  );
  return { content: [{ type: "text", text: lines.join("\n") }] };
}

import { App, TFile, normalizePath } from "obsidian";
import { LLMClient, extractJson } from "./llm";
import type { LLMWikiSettings, LintIssue } from "./types";

const LINT_SYSTEM = `You are a wiki quality auditor. Review the wiki pages for issues.

Check for:
1. **Contradictions**: Pages that make conflicting claims
2. **Orphan pages**: Pages with no incoming [[wiki links]] from other pages
3. **Stale claims**: Information that may be outdated based on dates or context
4. **Missing cross-references**: Pages that discuss related topics but don't link to each other
5. **Gaps**: Important topics mentioned but lacking their own page

Respond with a JSON object (no markdown fences):
{
  "issues": [
    {
      "type": "contradiction" | "orphan" | "stale" | "missing_crossref" | "gap",
      "description": "Clear description of the issue",
      "pages": ["wiki/page1.md", "wiki/page2.md"],
      "suggestion": "How to fix this"
    }
  ],
  "healthScore": 0-100,
  "summary": "Brief overall assessment"
}`;

export interface LintResult {
  issues: LintIssue[];
  healthScore: number;
  summary: string;
}

export async function lintWiki(
  app: App,
  settings: LLMWikiSettings
): Promise<LintResult> {
  const llm = new LLMClient(settings);

  const wikiFiles = app.vault.getFiles().filter((f) =>
    f.path.startsWith(settings.wikiDir + "/")
  );

  if (wikiFiles.length === 0) {
    return {
      issues: [],
      healthScore: 100,
      summary: "Wiki is empty — nothing to lint.",
    };
  }

  const pages: string[] = [];
  for (const f of wikiFiles) {
    const content = await app.vault.read(f);
    pages.push(`--- ${f.path} ---\n${content}`);
  }

  // Read index for cross-reference check
  const indexPath = normalizePath(settings.indexFile);
  let indexContent = "";
  try {
    const indexFile = app.vault.getAbstractFileByPath(indexPath);
    if (indexFile instanceof TFile) indexContent = await app.vault.read(indexFile);
  } catch { /* ok */ }

  const userMessage = `## Wiki Pages
${pages.join("\n\n")}

## Index
${indexContent || "(no index)"}

Please audit this wiki for issues.`;

  const response = await llm.call(LINT_SYSTEM, userMessage);

  let parsed: any;
  try {
    parsed = JSON.parse(response);
  } catch {
    // 思考タグ除去 + JSON 抽出フォールバック
    parsed = extractJson(response);
    if (!parsed) {
      return {
        issues: [],
        healthScore: 0,
        summary: "Failed to parse lint results: " + response.slice(0, 200),
      };
    }
  }

  return {
    issues: parsed.issues || [],
    healthScore: parsed.healthScore ?? 0,
    summary: parsed.summary || "",
  };
}

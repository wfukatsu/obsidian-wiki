import { App, TFile, normalizePath } from "obsidian";
import { LLMClient, extractJson } from "./llm";
import type { LLMWikiSettings, QueryResult } from "./types";

const QUERY_SYSTEM = `You are a wiki assistant. You answer questions by searching through the personal wiki pages provided.

Respond with a JSON object (no markdown fences):
{
  "answer": "Your detailed answer in markdown, using [[wiki links]] to reference pages",
  "citations": ["wiki/page1.md", "wiki/page2.md"],
  "shouldSave": true/false,
  "suggestedFilename": "descriptive-name.md"
}

Rules:
- Ground your answer in the wiki content provided. If the wiki doesn't have enough info, say so.
- Use [[wiki links]] to reference wiki pages
- Set shouldSave=true if the answer synthesizes information worth preserving as a new wiki page
- suggestedFilename should be kebab-case, descriptive, without the directory prefix`;

export async function queryWiki(
  app: App,
  settings: LLMWikiSettings,
  question: string
): Promise<QueryResult> {
  const llm = new LLMClient(settings);

  // Gather all wiki content
  const wikiFiles = app.vault.getFiles().filter((f) =>
    f.path.startsWith(settings.wikiDir + "/")
  );

  const pages: string[] = [];
  for (const f of wikiFiles) {
    const content = await app.vault.read(f);
    pages.push(`--- ${f.path} ---\n${content}`);
  }

  // Read schema for context
  const schemaPath = normalizePath(settings.schemaFile);
  let schema = "";
  try {
    const schemaFile = app.vault.getAbstractFileByPath(schemaPath);
    if (schemaFile instanceof TFile) schema = await app.vault.read(schemaFile);
  } catch { /* no schema */ }

  const userMessage = `## Schema
${schema || "(none)"}

## Wiki Pages
${pages.length > 0 ? pages.join("\n\n") : "(empty wiki — no pages yet)"}

## Question
${question}`;

  const response = await llm.call(QUERY_SYSTEM, userMessage);

  let parsed: any;
  try {
    parsed = JSON.parse(response);
  } catch {
    // 思考タグ除去 + JSON 抽出フォールバック
    parsed = extractJson(response);
    if (!parsed) {
      // 完全に失敗したら、応答を答えとして返す
      return {
        answer: response,
        citations: [],
        shouldSave: false,
      };
    }
  }

  return {
    answer: parsed.answer,
    citations: parsed.citations || [],
    shouldSave: parsed.shouldSave || false,
    suggestedFilename: parsed.suggestedFilename,
  };
}

export async function saveQueryAsPage(
  app: App,
  settings: LLMWikiSettings,
  question: string,
  result: QueryResult
): Promise<string> {
  const filename = result.suggestedFilename || "query-result.md";
  const pagePath = normalizePath(`${settings.wikiDir}/${filename}`);
  const today = new Date().toISOString().split("T")[0];

  const content = `---
title: "${question}"
type: synthesis
date: ${today}
sources: [${result.citations.map((c) => `"${c}"`).join(", ")}]
---

# ${question}

${result.answer}
`;

  const dir = pagePath.substring(0, pagePath.lastIndexOf("/"));
  if (dir && !app.vault.getAbstractFileByPath(dir)) {
    await app.vault.createFolder(dir);
  }

  await app.vault.create(pagePath, content);

  // Update index
  const indexPath = normalizePath(settings.indexFile);
  const indexFile = app.vault.getAbstractFileByPath(indexPath);
  if (indexFile instanceof TFile) {
    const current = await app.vault.read(indexFile);
    await app.vault.modify(
      indexFile,
      current.trimEnd() + `\n- [[${filename.replace(".md", "")}]] — ${question}\n`
    );
  }

  // Update log
  const logPath = normalizePath(settings.logFile);
  const logFile = app.vault.getAbstractFileByPath(logPath);
  if (logFile instanceof TFile) {
    const current = await app.vault.read(logFile);
    await app.vault.modify(
      logFile,
      current + `\n## [${today}] query | ${question}\n`
    );
  }

  return pagePath;
}

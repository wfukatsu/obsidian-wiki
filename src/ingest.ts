import { App, TFile, Notice, normalizePath } from "obsidian";
import { LLMClient } from "./llm";
import type { LLMWikiSettings, IngestResult } from "./types";

const INGEST_SYSTEM = `You are a wiki maintainer. You receive a source document and the current state of a personal wiki.
Your job is to ingest the source into the wiki by:
1. Writing a summary page for the source
2. Creating or updating entity/concept pages that the source touches
3. Adding cross-references ([[wiki links]]) between pages
4. Keeping pages factual and well-structured in markdown

Respond with a JSON object (no markdown fences) with this exact structure:
{
  "summary": "Brief description of what was ingested",
  "pages": [
    {
      "path": "wiki/page-name.md",
      "action": "create" | "update",
      "content": "Full markdown content of the page including frontmatter"
    }
  ],
  "indexEntry": "Single line to add to index.md under the appropriate category",
  "logEntry": "Single line for log.md in format: ingest | Source Title — brief description"
}

Rules:
- Use [[wiki links]] for cross-references between pages
- Each page should have YAML frontmatter with: title, type (summary|entity|concept|comparison), source, date
- Keep pages concise but informative
- If updating an existing page, merge new information rather than replacing
- The path must be within the wiki directory`;

export async function ingestSource(
  app: App,
  settings: LLMWikiSettings,
  sourceFile: TFile
): Promise<IngestResult> {
  const llm = new LLMClient(settings);
  const sourceContent = await app.vault.read(sourceFile);

  // Gather existing wiki pages for context
  const wikiFiles = app.vault.getFiles().filter((f) =>
    f.path.startsWith(settings.wikiDir + "/")
  );
  const wikiIndex: string[] = [];
  for (const f of wikiFiles) {
    const content = await app.vault.read(f);
    const firstLines = content.split("\n").slice(0, 10).join("\n");
    wikiIndex.push(`--- ${f.path} ---\n${firstLines}`);
  }

  // Read existing index and schema
  const indexPath = normalizePath(settings.indexFile);
  const schemaPath = normalizePath(settings.schemaFile);
  let existingIndex = "";
  let schema = "";
  try {
    const indexFile = app.vault.getAbstractFileByPath(indexPath);
    if (indexFile instanceof TFile) existingIndex = await app.vault.read(indexFile);
  } catch { /* no index yet */ }
  try {
    const schemaFile = app.vault.getAbstractFileByPath(schemaPath);
    if (schemaFile instanceof TFile) schema = await app.vault.read(schemaFile);
  } catch { /* no schema yet */ }

  const userMessage = `## Schema
${schema || "(no schema defined yet)"}

## Current Wiki Pages (first 10 lines each)
${wikiIndex.length > 0 ? wikiIndex.join("\n\n") : "(empty wiki)"}

## Current Index
${existingIndex || "(empty)"}

## Source to Ingest
Filename: ${sourceFile.name}
Path: ${sourceFile.path}

${sourceContent}`;

  new Notice("LLM Wiki: Ingesting source...");
  const response = await llm.call(INGEST_SYSTEM, userMessage);

  let parsed;
  try {
    parsed = JSON.parse(response);
  } catch {
    throw new Error("LLM returned invalid JSON. Response:\n" + response.slice(0, 500));
  }

  const result: IngestResult = {
    summary: parsed.summary,
    pagesCreated: [],
    pagesUpdated: [],
  };

  // Write/update wiki pages
  for (const page of parsed.pages) {
    const pagePath = normalizePath(page.path);
    const existing = app.vault.getAbstractFileByPath(pagePath);

    if (existing instanceof TFile && page.action === "update") {
      const oldContent = await app.vault.read(existing);
      // For updates, ask LLM to merge
      const merged = await mergeContent(llm, oldContent, page.content);
      await app.vault.modify(existing, merged);
      result.pagesUpdated.push(pagePath);
    } else {
      // Ensure directory exists
      const dir = pagePath.substring(0, pagePath.lastIndexOf("/"));
      if (dir && !app.vault.getAbstractFileByPath(dir)) {
        await app.vault.createFolder(dir);
      }
      await app.vault.create(pagePath, page.content);
      result.pagesCreated.push(pagePath);
    }
  }

  // Update index.md
  if (parsed.indexEntry) {
    const idxFile = app.vault.getAbstractFileByPath(indexPath);
    if (idxFile instanceof TFile) {
      const current = await app.vault.read(idxFile);
      await app.vault.modify(idxFile, current.trimEnd() + "\n" + parsed.indexEntry + "\n");
    }
  }

  // Append to log.md
  if (parsed.logEntry) {
    const logPath = normalizePath(settings.logFile);
    const today = new Date().toISOString().split("T")[0];
    const entry = `\n## [${today}] ${parsed.logEntry}\n`;
    const logFile = app.vault.getAbstractFileByPath(logPath);
    if (logFile instanceof TFile) {
      const current = await app.vault.read(logFile);
      await app.vault.modify(logFile, current + entry);
    }
  }

  new Notice(`LLM Wiki: Ingested! ${result.pagesCreated.length} created, ${result.pagesUpdated.length} updated`);
  return result;
}

async function mergeContent(
  llm: LLMClient,
  existing: string,
  newContent: string
): Promise<string> {
  const system = `You merge wiki page content. Given existing page content and new content, produce a single merged page.
Preserve existing information while incorporating new facts. Resolve contradictions by preferring newer information.
Respond with ONLY the merged markdown content, no JSON wrapping.`;

  return await llm.call(system, `## Existing Content\n${existing}\n\n## New Content\n${newContent}`);
}

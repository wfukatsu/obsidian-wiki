import { Plugin, Modal, App, TFile, Notice, Setting, normalizePath } from "obsidian";
import { DEFAULT_SETTINGS } from "./types";
import type { LLMWikiSettings, QueryResult } from "./types";
import { LLMWikiSettingTab } from "./settings";
import { ingestSource } from "./ingest";
import { queryWiki, saveQueryAsPage } from "./query";
import { lintWiki } from "./lint";
import type { LintResult } from "./lint";

export default class LLMWikiPlugin extends Plugin {
  settings: LLMWikiSettings = DEFAULT_SETTINGS;

  async onload() {
    await this.loadSettings();
    this.addSettingTab(new LLMWikiSettingTab(this.app, this));

    this.addCommand({
      id: "llm-wiki-ingest",
      name: "Ingest current file as source",
      checkCallback: (checking: boolean) => {
        const file = this.app.workspace.getActiveFile();
        if (!file) return false;
        if (checking) return true;
        this.runIngest(file);
      },
    });

    this.addCommand({
      id: "llm-wiki-ingest-select",
      name: "Ingest: select source file",
      callback: () => {
        new SourceSelectModal(this.app, this, async (file) => {
          await this.runIngest(file);
        }).open();
      },
    });

    this.addCommand({
      id: "llm-wiki-query",
      name: "Query the wiki",
      callback: () => {
        new QueryModal(this.app, this).open();
      },
    });

    this.addCommand({
      id: "llm-wiki-lint",
      name: "Lint the wiki",
      callback: () => {
        this.runLint();
      },
    });

    this.addCommand({
      id: "llm-wiki-init",
      name: "Initialize wiki structure",
      callback: () => {
        this.initVault();
      },
    });
  }

  private async ensureApiKey(): Promise<boolean> {
    if (!this.settings.apiKey) {
      new Notice("LLM Wiki: Please set your Anthropic API key in settings.");
      return false;
    }
    return true;
  }

  async runIngest(file: TFile) {
    if (!(await this.ensureApiKey())) return;
    try {
      const result = await ingestSource(this.app, this.settings, file);
      new Notice(`Ingest complete: ${result.summary}`);
    } catch (e) {
      new Notice(`Ingest failed: ${(e as Error).message}`);
      console.error("LLM Wiki ingest error:", e);
    }
  }

  async runLint() {
    if (!(await this.ensureApiKey())) return;
    new Notice("LLM Wiki: Running lint...");
    try {
      const result = await lintWiki(this.app, this.settings);
      new LintResultModal(this.app, result).open();
    } catch (e) {
      new Notice(`Lint failed: ${(e as Error).message}`);
      console.error("LLM Wiki lint error:", e);
    }
  }

  async initVault() {
    const dirs = [this.settings.wikiDir, this.settings.sourcesDir];
    for (const dir of dirs) {
      const path = normalizePath(dir);
      if (!this.app.vault.getAbstractFileByPath(path)) {
        await this.app.vault.createFolder(path);
      }
    }

    const files: Record<string, string> = {
      [this.settings.schemaFile]: SCHEMA_TEMPLATE,
      [this.settings.indexFile]: INDEX_TEMPLATE,
      [this.settings.logFile]: LOG_TEMPLATE,
    };

    for (const [name, content] of Object.entries(files)) {
      const path = normalizePath(name);
      if (!this.app.vault.getAbstractFileByPath(path)) {
        await this.app.vault.create(path, content);
      }
    }

    new Notice("LLM Wiki: Vault structure initialized!");
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

// --- Modals ---

class QueryModal extends Modal {
  plugin: LLMWikiPlugin;
  resultContainer: HTMLElement | null = null;
  lastResult: QueryResult | null = null;
  lastQuestion: string = "";

  constructor(app: App, plugin: LLMWikiPlugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.addClass("llm-wiki-modal");
    contentEl.createEl("h3", { text: "Query Wiki" });

    const textarea = contentEl.createEl("textarea", {
      attr: { placeholder: "Ask a question about your knowledge base..." },
    });

    const buttonRow = contentEl.createDiv({ cls: "llm-wiki-progress" });

    const askBtn = buttonRow.createEl("button", { text: "Ask" });
    askBtn.addEventListener("click", async () => {
      const question = textarea.value.trim();
      if (!question) return;
      if (!this.plugin.settings.apiKey) {
        new Notice("Set your API key in LLM Wiki settings first.");
        return;
      }

      askBtn.disabled = true;
      askBtn.textContent = "Thinking...";
      this.lastQuestion = question;

      try {
        const result = await queryWiki(this.app, this.plugin.settings, question);
        this.lastResult = result;
        this.showResult(result);
      } catch (e) {
        new Notice(`Query failed: ${(e as Error).message}`);
      } finally {
        askBtn.disabled = false;
        askBtn.textContent = "Ask";
      }
    });

    this.resultContainer = contentEl.createDiv({ cls: "result-container" });
    this.resultContainer.style.display = "none";
  }

  private showResult(result: QueryResult) {
    if (!this.resultContainer) return;
    this.resultContainer.style.display = "block";
    this.resultContainer.empty();

    this.resultContainer.createEl("div", { text: result.answer });

    if (result.citations.length > 0) {
      const citDiv = this.resultContainer.createDiv();
      citDiv.createEl("strong", { text: "Sources: " });
      citDiv.createEl("span", { text: result.citations.join(", ") });
    }

    if (result.shouldSave) {
      const saveBtn = this.resultContainer.createEl("button", {
        text: "Save as wiki page",
      });
      saveBtn.style.marginTop = "0.5em";
      saveBtn.addEventListener("click", async () => {
        const path = await saveQueryAsPage(
          this.app,
          this.plugin.settings,
          this.lastQuestion,
          result
        );
        new Notice(`Saved to ${path}`);
        saveBtn.disabled = true;
        saveBtn.textContent = "Saved!";
      });
    }
  }

  onClose() {
    this.contentEl.empty();
  }
}

class SourceSelectModal extends Modal {
  plugin: LLMWikiPlugin;
  onChoose: (file: TFile) => void;

  constructor(app: App, plugin: LLMWikiPlugin, onChoose: (file: TFile) => void) {
    super(app);
    this.plugin = plugin;
    this.onChoose = onChoose;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.addClass("llm-wiki-modal");
    contentEl.createEl("h3", { text: "Select source file to ingest" });

    const sourcesDir = this.plugin.settings.sourcesDir;
    const files = this.app.vault
      .getFiles()
      .filter((f) => f.path.startsWith(sourcesDir + "/"));

    if (files.length === 0) {
      contentEl.createEl("p", {
        text: `No files found in ${sourcesDir}/. Add source documents there first.`,
      });
      return;
    }

    const list = contentEl.createEl("div");
    for (const file of files) {
      const btn = list.createEl("button", {
        text: file.path,
        cls: "mod-cta",
      });
      btn.style.display = "block";
      btn.style.marginBottom = "0.3em";
      btn.style.width = "100%";
      btn.addEventListener("click", () => {
        this.close();
        this.onChoose(file);
      });
    }
  }

  onClose() {
    this.contentEl.empty();
  }
}

class LintResultModal extends Modal {
  result: LintResult;

  constructor(app: App, result: LintResult) {
    super(app);
    this.result = result;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.addClass("llm-wiki-modal");
    contentEl.createEl("h3", { text: "Wiki Lint Report" });

    const scoreEl = contentEl.createEl("p");
    scoreEl.createEl("strong", { text: `Health Score: ${this.result.healthScore}/100` });

    contentEl.createEl("p", { text: this.result.summary });

    if (this.result.issues.length === 0) {
      contentEl.createEl("p", {
        text: "No issues found!",
        cls: "llm-wiki-status",
      });
      return;
    }

    const issueList = contentEl.createDiv();
    for (const issue of this.result.issues) {
      const el = issueList.createDiv({ cls: "llm-wiki-lint-issue" });
      el.createEl("strong", { text: `[${issue.type}] ` });
      el.createEl("span", { text: issue.description });
      if (issue.pages.length > 0) {
        el.createEl("div", {
          text: `Pages: ${issue.pages.join(", ")}`,
          cls: "llm-wiki-status",
        });
      }
      el.createEl("div", {
        text: `Fix: ${issue.suggestion}`,
        cls: "llm-wiki-status",
      });
    }
  }

  onClose() {
    this.contentEl.empty();
  }
}

// --- Templates ---

const SCHEMA_TEMPLATE = `---
title: Wiki Schema
---

# Wiki Schema

This document defines the structure and conventions for this LLM-maintained wiki.

## Directory Structure

- \`sources/\` — Raw, immutable source documents (articles, papers, notes)
- \`wiki/\` — LLM-generated and maintained wiki pages

## Page Types

| Type | Description |
|------|-------------|
| summary | Summary of a single source document |
| entity | Page about a person, organization, project, or tool |
| concept | Page about an idea, technique, or theory |
| comparison | Side-by-side analysis of related topics |
| synthesis | Answer to a query that synthesizes multiple sources |

## Conventions

- All wiki pages use YAML frontmatter with: title, type, date, source(s)
- Cross-references use Obsidian \`[[wiki links]]\`
- One topic per page — split if a page covers multiple distinct concepts
- Prefer updating existing pages over creating near-duplicates

## Ingest Workflow

1. Place source document in \`sources/\`
2. Run "LLM Wiki: Ingest" command
3. LLM reads the source, creates/updates wiki pages, updates index and log

## Quality Standards

- Claims should cite their source page
- No orphan pages (every page should be linked from at least one other)
- Contradictions between pages should be resolved promptly
`;

const INDEX_TEMPLATE = `---
title: Wiki Index
---

# Index

Content catalog organized by category. Updated on every ingest.

## Summaries

## Entities

## Concepts

## Comparisons

## Syntheses
`;

const LOG_TEMPLATE = `---
title: Wiki Log
---

# Log

Chronological record of wiki operations.
`;

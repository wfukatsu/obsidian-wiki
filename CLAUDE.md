# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Obsidian plugin implementing Karpathy's "LLM Wiki" pattern — an LLM-maintained personal knowledge base with three core operations: **ingest** (process source documents into wiki pages), **query** (answer questions from wiki content), and **lint** (audit wiki quality).

## Build & Development

```bash
npm install
npm run dev          # Watch mode (esbuild)
npm run build        # Type-check + production build
```

Output: `main.js` in project root (Obsidian loads this directly).

### Installing in Obsidian

1. Build the plugin
2. Copy `main.js`, `manifest.json`, `styles.css` to your vault's `.obsidian/plugins/llm-wiki/`
3. Enable "LLM Wiki" in Obsidian Settings > Community Plugins

### Development workflow

Symlink for live reload:
```bash
ln -s /path/to/obsidian-wiki /path/to/vault/.obsidian/plugins/llm-wiki
```
Then `npm run dev` and reload Obsidian (Cmd+R) after changes.

## Architecture

```
src/
├── main.ts       # Plugin entry: commands, modals (QueryModal, SourceSelectModal, LintResultModal), vault init templates
├── settings.ts   # PluginSettingTab — API key, model, directory config
├── llm.ts        # Anthropic SDK wrapper (single call method)
├── ingest.ts     # Ingest pipeline: reads source → gathers wiki context → LLM generates pages → writes to vault
├── query.ts      # Query pipeline: reads wiki → LLM answers → optional save as synthesis page
├── lint.ts       # Lint pipeline: reads all wiki pages → LLM audits for issues → returns scored report
└── types.ts      # Shared types and DEFAULT_SETTINGS
```

### Data flow

All three operations follow the same pattern:
1. Gather vault context (wiki pages, index, schema)
2. Build a structured prompt with system instructions requesting JSON output
3. Call Claude API via `LLMClient.call()`
4. Parse JSON response and write back to vault (create/modify files)

### Vault structure (created by "Initialize wiki structure" command)

- `vault/sources/` — Raw immutable source documents
- `vault/wiki/` — LLM-generated wiki pages with YAML frontmatter
- `vault/schema.md` — Wiki conventions and page type definitions
- `vault/index.md` — Category-organized content catalog
- `vault/log.md` — Append-only chronological operation record

### LLM integration

The plugin calls the Anthropic API directly from Obsidian (desktop only). All LLM prompts request structured JSON responses. The `ingest` operation may make a second LLM call for content merging when updating existing pages.

## Claude Code Skills

Four slash commands in `.claude/commands/`:

- `/wiki-init` — Initialize vault directory structure
- `/wiki-ingest <filepath>` — Ingest a source document into the wiki
- `/wiki-query <question>` — Answer a question from wiki content
- `/wiki-lint` — Audit wiki for contradictions, orphans, gaps

These operate on `vault/` subdirectory and follow the same three-layer pattern (sources → wiki → schema) as the Obsidian plugin.

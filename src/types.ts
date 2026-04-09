export interface LLMWikiSettings {
  apiKey: string;
  model: string;
  wikiDir: string;
  sourcesDir: string;
  indexFile: string;
  logFile: string;
  schemaFile: string;
  maxTokens: number;
}

export const DEFAULT_SETTINGS: LLMWikiSettings = {
  apiKey: "",
  model: "claude-sonnet-4-20250514",
  wikiDir: "wiki",
  sourcesDir: "sources",
  indexFile: "index.md",
  logFile: "log.md",
  schemaFile: "schema.md",
  maxTokens: 4096,
};

export interface WikiPage {
  path: string;
  title: string;
  content: string;
}

export interface IngestResult {
  summary: string;
  pagesCreated: string[];
  pagesUpdated: string[];
}

export interface QueryResult {
  answer: string;
  citations: string[];
  shouldSave: boolean;
  suggestedFilename?: string;
}

export interface LintIssue {
  type: "contradiction" | "orphan" | "stale" | "missing_crossref" | "gap";
  description: string;
  pages: string[];
  suggestion: string;
}

export type LLMProvider = "anthropic" | "ollama";

export interface LLMWikiSettings {
  // Provider 選択
  provider: LLMProvider;
  // Anthropic 設定
  apiKey: string;
  anthropicModel: string;
  // Ollama 設定 (OpenAI 互換 API)
  ollamaBaseUrl: string;
  ollamaModel: string;
  // Ollama 用詳細制御 (Qwen 3 系の Thinking モード抑制等)
  disableThinking: boolean; // true なら system プロンプト先頭に /no_think を自動付与
  ollamaNumCtx: number;     // コンテキスト窓 (デフォルト 8192、Ollama 既定 4096 では不足)
  ollamaNumPredict: number; // 生成トークン上限 (0 で無制限、暴走防止に有用)
  // 共通
  wikiDir: string;
  sourcesDir: string;
  indexFile: string;
  logFile: string;
  schemaFile: string;
  maxTokens: number;
  // 旧フィールド (後方互換、非推奨。anthropicModel に移行)
  /** @deprecated use anthropicModel */
  model?: string;
}

export const DEFAULT_SETTINGS: LLMWikiSettings = {
  provider: "ollama",
  apiKey: "",
  anthropicModel: "claude-sonnet-4-20250514",
  ollamaBaseUrl: "http://localhost:11434/v1",
  ollamaModel: "qwen3.5:4b",
  disableThinking: true,    // Qwen 3 系の Thinking モードはデフォルト OFF (実用速度確保)
  ollamaNumCtx: 8192,       // 4096 では Ingest プロンプトが溢れる
  ollamaNumPredict: 0,      // 0 = 無制限 (Ingest で長い応答が必要な場合あり)
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

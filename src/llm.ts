import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import type { LLMWikiSettings } from "./types";

/**
 * LLM クライアント (Anthropic / Ollama 切替対応)。
 *
 * - settings.provider が "anthropic" なら Anthropic SDK を使う
 * - settings.provider が "ollama" なら OpenAI 互換 API (http://localhost:11434/v1) を使う
 *
 * Ollama (特に Qwen 3 系) の Thinking モード対策:
 *   - settings.disableThinking が true なら system プロンプト先頭に /no_think を自動付与
 *   - 応答中の <think>...</think> タグを除去
 *   - JSON 抽出ヘルパー (extractJson) を export し、ingest/query/lint 側で使う
 */
export class LLMClient {
  private settings: LLMWikiSettings;

  constructor(settings: LLMWikiSettings) {
    this.settings = settings;
  }

  async call(system: string, userMessage: string): Promise<string> {
    if (this.settings.provider === "anthropic") {
      return this.callAnthropic(system, userMessage);
    }
    return this.callOllama(system, userMessage);
  }

  private async callAnthropic(system: string, user: string): Promise<string> {
    if (!this.settings.apiKey) {
      throw new Error(
        "Anthropic API key is not set. Open settings and configure it."
      );
    }
    const client = new Anthropic({
      apiKey: this.settings.apiKey,
      dangerouslyAllowBrowser: true,
    });
    const modelName = this.settings.model ?? this.settings.anthropicModel;
    const response = await client.messages.create({
      model: modelName,
      max_tokens: this.settings.maxTokens,
      system,
      messages: [{ role: "user", content: user }],
    });
    const textBlock = response.content.find(
      (b): b is Anthropic.TextBlock => b.type === "text"
    );
    return textBlock ? textBlock.text : "";
  }

  private async callOllama(system: string, user: string): Promise<string> {
    const baseURL = this.settings.ollamaBaseUrl || "http://localhost:11434/v1";
    const model = this.settings.ollamaModel || "qwen3.5:4b";

    // Thinking モード抑制: system 先頭に /no_think を自動付与
    const sysWithNoThink = this.settings.disableThinking
      ? `/no_think\n\n${system}`
      : system;

    const client = new OpenAI({
      baseURL,
      apiKey: "ollama",
      dangerouslyAllowBrowser: true,
    });

    // OpenAI 互換 API では num_ctx / num_predict は extra_body 経由で渡す
    // (Ollama 側の独自パラメータ)
    const extraBody: Record<string, unknown> = {};
    if (this.settings.ollamaNumCtx && this.settings.ollamaNumCtx > 0) {
      extraBody.num_ctx = this.settings.ollamaNumCtx;
    }
    if (
      this.settings.ollamaNumPredict !== undefined &&
      this.settings.ollamaNumPredict > 0
    ) {
      extraBody.num_predict = this.settings.ollamaNumPredict;
    }

    // OpenAI SDK は OpenAI 拡張パラメータ (num_ctx 等) を型で受け付けないが、
    // Ollama は OpenAI 互換 API でこれらを解釈するため、any キャストで通す
    const completion = await client.chat.completions.create({
      model,
      max_tokens: this.settings.maxTokens,
      messages: [
        { role: "system", content: sysWithNoThink },
        { role: "user", content: user },
      ],
      ...extraBody,
    } as any);

    const raw = completion.choices[0]?.message?.content || "";
    return stripThinkTags(raw);
  }
}

/**
 * Qwen 3 系の応答に含まれる <think>...</think> タグや "Thinking..." セクションを除去。
 *
 * 例:
 *   "<think>Let me reason...</think>\n{\"a\":1}" → "{\"a\":1}"
 *   "Thinking...\n[reasoning]\n...done thinking.\n{\"a\":1}" → "{\"a\":1}"
 */
export function stripThinkTags(text: string): string {
  let result = text;
  // <think>...</think> タグの除去 (multi-line)
  result = result.replace(/<think>[\s\S]*?<\/think>/g, "");
  // "Thinking..." から "...done thinking." までの除去
  result = result.replace(/Thinking\.\.\.[\s\S]*?\.\.\.done thinking\.?/g, "");
  // 開いた <think> だけがあって閉じてないケース (応答途中で打ち切られた等)
  result = result.replace(/<think>[\s\S]*$/g, "");
  return result.trim();
}

/**
 * 応答テキストから JSON オブジェクトを抽出。
 * 通常の JSON.parse(text) が失敗した時のフォールバックとして使う。
 *
 * 戦略:
 *   1. テキスト中の最初の { から対応する } までを取り出して JSON.parse
 *   2. 失敗したら最後の {...} を試す
 *   3. それでも失敗したら ```json ... ``` ブロックを試す
 *
 * 戻り値: パース成功なら object、すべて失敗なら null。
 */
export function extractJson(text: string): unknown | null {
  const cleaned = stripThinkTags(text);

  // 1. そのまま試す
  try {
    return JSON.parse(cleaned);
  } catch {
    /* fall through */
  }

  // 2. 最初の { から最後の } まで
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const candidate = cleaned.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(candidate);
    } catch {
      /* fall through */
    }
  }

  // 3. ```json ... ``` フェンス
  const fenceMatch = cleaned.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1]);
    } catch {
      /* fall through */
    }
  }

  return null;
}

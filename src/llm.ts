import Anthropic from "@anthropic-ai/sdk";
import type { LLMWikiSettings } from "./types";

export class LLMClient {
  private client: Anthropic;
  private model: string;
  private maxTokens: number;

  constructor(settings: LLMWikiSettings) {
    this.client = new Anthropic({ apiKey: settings.apiKey });
    this.model = settings.model;
    this.maxTokens = settings.maxTokens;
  }

  async call(system: string, userMessage: string): Promise<string> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: this.maxTokens,
      system,
      messages: [{ role: "user", content: userMessage }],
    });

    const textBlock = response.content.find(
      (b): b is Anthropic.TextBlock => b.type === "text"
    );
    return textBlock ? textBlock.text : "";
  }
}

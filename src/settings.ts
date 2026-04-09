import { App, PluginSettingTab, Setting } from "obsidian";
import type LLMWikiPlugin from "./main";

export class LLMWikiSettingTab extends PluginSettingTab {
  plugin: LLMWikiPlugin;

  constructor(app: App, plugin: LLMWikiPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "LLM Wiki Settings" });

    new Setting(containerEl)
      .setName("Anthropic API Key")
      .setDesc("Claude API key for LLM operations")
      .addText((text) =>
        text
          .setPlaceholder("sk-ant-...")
          .setValue(this.plugin.settings.apiKey)
          .onChange(async (value) => {
            this.plugin.settings.apiKey = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Model")
      .setDesc("Claude model to use")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("claude-sonnet-4-20250514", "Claude Sonnet 4")
          .addOption("claude-opus-4-20250514", "Claude Opus 4")
          .addOption("claude-haiku-4-5-20251001", "Claude Haiku 4.5")
          .setValue(this.plugin.settings.model)
          .onChange(async (value) => {
            this.plugin.settings.model = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Wiki directory")
      .setDesc("Directory for LLM-generated wiki pages")
      .addText((text) =>
        text
          .setPlaceholder("wiki")
          .setValue(this.plugin.settings.wikiDir)
          .onChange(async (value) => {
            this.plugin.settings.wikiDir = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Sources directory")
      .setDesc("Directory for raw source documents")
      .addText((text) =>
        text
          .setPlaceholder("sources")
          .setValue(this.plugin.settings.sourcesDir)
          .onChange(async (value) => {
            this.plugin.settings.sourcesDir = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Max tokens")
      .setDesc("Maximum tokens per LLM response")
      .addText((text) =>
        text
          .setPlaceholder("4096")
          .setValue(String(this.plugin.settings.maxTokens))
          .onChange(async (value) => {
            const num = parseInt(value, 10);
            if (!isNaN(num) && num > 0) {
              this.plugin.settings.maxTokens = num;
              await this.plugin.saveSettings();
            }
          })
      );
  }
}

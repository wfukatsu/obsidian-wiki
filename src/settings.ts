import { App, PluginSettingTab, Setting } from "obsidian";
import type LLMWikiPlugin from "./main";
import type { LLMProvider } from "./types";

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

    // ── Provider 選択 ────────────────────────────────
    containerEl.createEl("h3", { text: "LLM Provider" });

    new Setting(containerEl)
      .setName("Provider")
      .setDesc(
        "公開データなら Anthropic も可。実データ・機密ロジックを扱う場合は必ず Ollama (ローカル) を使うこと。"
      )
      .addDropdown((dropdown) =>
        dropdown
          .addOption("ollama", "Ollama (ローカル / 機密データ可)")
          .addOption("anthropic", "Anthropic (クラウド / 公開データのみ)")
          .setValue(this.plugin.settings.provider ?? "ollama")
          .onChange(async (value) => {
            this.plugin.settings.provider = value as LLMProvider;
            await this.plugin.saveSettings();
            this.display(); // UI を再描画して該当 Provider の設定を強調
          })
      );

    // ── Ollama 設定 ────────────────────────────────
    containerEl.createEl("h3", { text: "Ollama (ローカル)" });

    new Setting(containerEl)
      .setName("Ollama base URL")
      .setDesc("OpenAI 互換エンドポイント。通常はそのままで OK。")
      .addText((text) =>
        text
          .setPlaceholder("http://localhost:11434/v1")
          .setValue(this.plugin.settings.ollamaBaseUrl ?? "")
          .onChange(async (value) => {
            this.plugin.settings.ollamaBaseUrl = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Ollama model")
      .setDesc("使用するモデル名 (例: qwen3.5:4b)")
      .addText((text) =>
        text
          .setPlaceholder("qwen3.5:4b")
          .setValue(this.plugin.settings.ollamaModel ?? "")
          .onChange(async (value) => {
            this.plugin.settings.ollamaModel = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Disable Thinking モード")
      .setDesc(
        "Qwen 3 系の <think> タグ思考プロセスを抑制 (system 先頭に /no_think を自動付与)。実用速度に必須。"
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.disableThinking ?? true)
          .onChange(async (value) => {
            this.plugin.settings.disableThinking = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Ollama context size (num_ctx)")
      .setDesc(
        "コンテキスト窓トークン数。Ollama 既定 4096 では Ingest プロンプトが溢れる場合あり。8192 推奨。"
      )
      .addText((text) =>
        text
          .setPlaceholder("8192")
          .setValue(String(this.plugin.settings.ollamaNumCtx ?? 8192))
          .onChange(async (value) => {
            const num = parseInt(value, 10);
            if (!isNaN(num) && num > 0) {
              this.plugin.settings.ollamaNumCtx = num;
              await this.plugin.saveSettings();
            }
          })
      );

    new Setting(containerEl)
      .setName("Ollama 生成トークン上限 (num_predict)")
      .setDesc(
        "0 で無制限。暴走防止に正の値を設定可。Ingest では長い応答が必要なため通常 0。"
      )
      .addText((text) =>
        text
          .setPlaceholder("0")
          .setValue(String(this.plugin.settings.ollamaNumPredict ?? 0))
          .onChange(async (value) => {
            const num = parseInt(value, 10);
            if (!isNaN(num) && num >= 0) {
              this.plugin.settings.ollamaNumPredict = num;
              await this.plugin.saveSettings();
            }
          })
      );

    // ── Anthropic 設定 ────────────────────────────────
    containerEl.createEl("h3", { text: "Anthropic (クラウド)" });

    new Setting(containerEl)
      .setName("Anthropic API Key")
      .setDesc(
        "Claude API キー。実データ・機密ロジックには使わないこと。data.json は .gitignore で除外済み。"
      )
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
      .setName("Anthropic model")
      .setDesc("使用する Claude モデル")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("claude-sonnet-4-20250514", "Claude Sonnet 4")
          .addOption("claude-opus-4-20250514", "Claude Opus 4")
          .addOption("claude-haiku-4-5-20251001", "Claude Haiku 4.5")
          .setValue(
            this.plugin.settings.anthropicModel ??
              this.plugin.settings.model ??
              "claude-sonnet-4-20250514"
          )
          .onChange(async (value) => {
            this.plugin.settings.anthropicModel = value;
            // 旧フィールド model も更新 (後方互換)
            this.plugin.settings.model = value;
            await this.plugin.saveSettings();
          })
      );

    // ── ディレクトリ設定 ────────────────────────────────
    containerEl.createEl("h3", { text: "ディレクトリ" });

    new Setting(containerEl)
      .setName("Wiki directory")
      .setDesc("LLM が生成する wiki ページの格納先")
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
      .setDesc("生のソースドキュメントの格納先")
      .addText((text) =>
        text
          .setPlaceholder("sources")
          .setValue(this.plugin.settings.sourcesDir)
          .onChange(async (value) => {
            this.plugin.settings.sourcesDir = value;
            await this.plugin.saveSettings();
          })
      );

    // ── 出力設定 ────────────────────────────────
    containerEl.createEl("h3", { text: "出力" });

    new Setting(containerEl)
      .setName("Max tokens")
      .setDesc("LLM レスポンスの最大トークン数")
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

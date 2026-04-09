# LLM Wiki — Obsidian Plugin

[Andrej Karpathy の LLM Wiki パターン](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)を Obsidian プラグインとして実装したものです。

LLM がソースドキュメントを読み取り、構造化された wiki ページを自動生成・維持します。人間はソースのキュレーションと戦略的思考に集中し、面倒な「帳簿付け」は LLM に任せます。

## 三層アーキテクチャ

```
sources/          ← 生のソースドキュメント（記事、論文、メモなど）。不変。
wiki/             ← LLM が生成・維持する wiki ページ群
schema.md         ← wiki の構造・規約・ワークフローを定義する設定ドキュメント
index.md          ← カテゴリ別のコンテンツカタログ
log.md            ← 操作の時系列ログ
```

## 三つの操作

| 操作 | 説明 |
|------|------|
| **Ingest** | ソースを1つずつ取り込み、要約ページ・エンティティページ・コンセプトページを生成。1つのソースで10〜15ページに波及 |
| **Query** | wiki を検索して質問に回答。有用な回答は synthesis ページとして保存可能 |
| **Lint** | wiki 全体の品質監査 — 矛盾、孤立ページ、リンク欠落、知識ギャップを検出 |

## インストール

### ビルド

```bash
git clone <this-repo>
cd obsidian-wiki
npm install
npm run build
```

### Obsidian に配置

```bash
# 方法1: コピー
mkdir -p /path/to/vault/.obsidian/plugins/llm-wiki
cp main.js manifest.json styles.css /path/to/vault/.obsidian/plugins/llm-wiki/

# 方法2: シンボリックリンク（開発用）
ln -s $(pwd) /path/to/vault/.obsidian/plugins/llm-wiki
```

Obsidian を開き、**Settings → Community Plugins** で「LLM Wiki」を有効化してください。

### API キーの設定

**Settings → LLM Wiki** で Anthropic API キーを入力してください。

## 使い方

すべてのコマンドはコマンドパレット（`Cmd+P` / `Ctrl+P`）から実行できます。

### 1. Wiki の初期化

`LLM Wiki: Initialize wiki structure` を実行すると、vault 内に以下が生成されます:

- `sources/` と `wiki/` ディレクトリ
- `schema.md` — wiki の規約定義
- `index.md` — コンテンツカタログ
- `log.md` — 操作ログ

### 2. ソースの取り込み (Ingest)

1. `sources/` にドキュメント（記事、論文、メモなど）を配置
2. 以下のいずれかを実行:
   - そのファイルを開いた状態で `LLM Wiki: Ingest current file as source`
   - `LLM Wiki: Ingest: select source file` でファイル一覧から選択
3. LLM が自動的に:
   - ソースの要約ページを作成
   - 関連するエンティティ・コンセプトページを作成 or 更新
   - `[[wiki links]]` で相互参照を追加
   - `index.md` と `log.md` を更新

### 3. Wiki への質問 (Query)

1. `LLM Wiki: Query the wiki` を実行
2. モーダルに質問を入力して「Ask」をクリック
3. wiki の内容に基づいた回答が表示される
4. 有用な回答は「Save as wiki page」で synthesis ページとして保存可能

### 4. 品質監査 (Lint)

`LLM Wiki: Lint the wiki` を実行すると、以下をチェックしたレポートが表示されます:

- **Contradictions** — ページ間の矛盾する主張
- **Orphan pages** — 他のページからリンクされていない孤立ページ
- **Stale claims** — 古くなった可能性のある情報
- **Missing cross-references** — 関連しているがリンクのないページ
- **Gaps** — 言及されているが専用ページのないトピック

## 設定

| 項目 | デフォルト | 説明 |
|------|-----------|------|
| Anthropic API Key | — | Claude API キー（必須） |
| Model | Claude Sonnet 4 | 使用する Claude モデル |
| Wiki directory | `wiki` | wiki ページの格納先 |
| Sources directory | `sources` | ソースドキュメントの格納先 |
| Max tokens | 4096 | LLM レスポンスの最大トークン数 |

## Wiki ページの種類

| type | 用途 |
|------|------|
| `summary` | 単一ソースの要約 |
| `entity` | 人物、組織、プロジェクト、ツール |
| `concept` | アイデア、技法、理論 |
| `comparison` | 関連トピックの比較分析 |
| `synthesis` | 複数ソースを統合した質問への回答 |

すべての wiki ページは YAML frontmatter（`title`, `type`, `date`, `source`）を持ち、Obsidian の `[[wiki links]]` で相互参照されます。

## Claude Code スキル

Claude Code CLI からも同じ操作を実行できます:

```
/wiki-init                     # vault 構造の初期化
/wiki-ingest vault/sources/article.md  # ソース取り込み
/wiki-query "Transformerとは何か？"      # wiki への質問
/wiki-lint                     # 品質監査
```

## 開発

```bash
npm run dev    # watch モード（ファイル変更時に自動ビルド）
npm run build  # 型チェック + プロダクションビルド
```

## ライセンス

MIT

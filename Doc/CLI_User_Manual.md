# NeoCEG CLI User Manual / NeoCEG CLI ユーザーマニュアル

**Version**: 1.0
**Date**: 2026-04-04
**Status**: Initial release / 初版

---

## 1. Overview / 概要

The NeoCEG CLI is a command-line tool that processes `.nceg` files and outputs decision tables, coverage tables, and graph images. It is designed to be embedded in CI/CD pipelines and orchestration workflows as a UNIX filter.

NeoCEG CLI は `.nceg` ファイルを処理し、デシジョンテーブル、カバレッジ表、グラフ画像を出力するコマンドラインツールです。UNIX フィルタとして、CI/CD パイプラインやオーケストレーションワークフローへの組み込みを想定しています。

### Typical Workflow / 典型的なワークフロー

1. A test designer creates and reviews a cause-effect graph using the NeoCEG GUI application
2. The finalized `.nceg` file is committed to version control
3. The CLI generates artifacts (decision tables, coverage tables, graph images) in an automated pipeline
4. The generated decision table is fed into a data-driven testing framework

テスト設計者が NeoCEG GUI で原因結果グラフを作成・レビューし、確定した `.nceg` ファイルをバージョン管理にコミットします。CLI は自動パイプラインでデシジョンテーブル、カバレッジ表、グラフ画像を生成し、生成されたデシジョンテーブルをデータ駆動テストフレームワークに投入します。

---

## 2. Installation / インストール

### Prerequisites / 前提条件

- Node.js v18 or later / Node.js v18 以降

### From the repository / リポジトリから

```bash
git clone https://github.com/sho1884/NeoCEG.git
cd NeoCEG
npm install
```

After installation, the CLI is available via:

インストール後、CLI は以下で利用できます：

```bash
node bin/neoceg.mjs [options] [input-file]
```

### Global installation (future) / グローバルインストール（将来）

```bash
npm install -g neoceg    # Not yet published to npm
npx neoceg [options]     # Not yet published to npm
```

---

## 3. Usage / 使い方

### Basic Syntax / 基本構文

```
neoceg [options] [input-file]
```

- If `input-file` is specified, reads from that file
- If omitted, reads from standard input (stdin)
- Output is written to standard output (stdout) by default

`input-file` を指定するとそのファイルから読み込みます。省略すると標準入力（stdin）から読み込みます。出力はデフォルトで標準出力（stdout）に書き出されます。

### Options / オプション

| Option | Description / 説明 |
|--------|----------|
| `-o FILE`, `--output FILE` | Write output to FILE instead of stdout / stdout の代わりに FILE に出力 |
| `--coverage` | Output coverage table CSV instead of decision table / デシジョンテーブルの代わりにカバレッジ表 CSV を出力 |
| `--svg` | Output cause-effect graph as SVG / 原因結果グラフを SVG として出力 |
| `-h`, `--help` | Show help message / ヘルプメッセージを表示 |
| `--version` | Show version number / バージョン番号を表示 |

---

## 4. Examples / 使用例

### 4.1 Decision Table to stdout / デシジョンテーブルを標準出力へ

```bash
node bin/neoceg.mjs input.nceg
```

Output / 出力:
```csv
ID,Classification (分類),Observable (観測可能),Logical Statement (論理言明),#1,#2,#3
p1,Cause (原因),-,A,T,F,T
p2,Cause (原因),-,B,T,T,F
p3,Effect (結果),Yes,C,T,F,F
```

### 4.2 Decision Table to file / デシジョンテーブルをファイルへ

```bash
node bin/neoceg.mjs -o decision_table.csv input.nceg
```

### 4.3 Coverage Table / カバレッジ表

```bash
node bin/neoceg.mjs --coverage input.nceg
```

Output / 出力:
```csv
Expr. (論理式),p1: A,p2: B,p3: C,#1,#2,#3,Status (状態),Reason (理由)
Expr.1,T,T,T,#,,,,
Expr.2,F,T,F,,#,,,
Expr.3,T,F,F,,,#,,
```

### 4.4 Graph SVG / グラフ SVG

```bash
node bin/neoceg.mjs --svg -o graph.svg input.nceg
```

The SVG output requires `@layout` coordinates in the `.nceg` file. Files saved from the NeoCEG GUI always include layout information.

SVG 出力には `.nceg` ファイル内の `@layout` 座標が必要です。NeoCEG GUI から保存されたファイルには常にレイアウト情報が含まれています。

### 4.5 Piping from stdin / stdin からのパイプ

```bash
cat input.nceg | node bin/neoceg.mjs
cat input.nceg | node bin/neoceg.mjs --coverage > coverage.csv
cat input.nceg | node bin/neoceg.mjs --svg > graph.svg
```

### 4.6 Combining with other tools / 他のツールとの組み合わせ

The CLI outputs clean CSV to stdout and diagnostics to stderr, making it safe to pipe into other tools.

CLI はクリーンな CSV を stdout に、診断情報を stderr に出力するため、他のツールへのパイプが安全に行えます。

```bash
# Extract only cause rows / 原因行のみ抽出
node bin/neoceg.mjs input.nceg | grep 'Cause'

# Count the number of test rules / テストルール数をカウント
node bin/neoceg.mjs input.nceg | head -1 | awk -F, '{print NF - 4}'

# Transpose and post-process for test framework
node bin/neoceg.mjs input.nceg | your_transpose_script.py | your_factor_mapper.py
```

---

## 5. Output Format / 出力フォーマット

### 5.1 Decision Table CSV / デシジョンテーブル CSV

Each row represents a node. Each column after the header columns represents a test rule.

各行がノードを、ヘッダー列以降の各列がテストルールを表します。

| Column / 列 | Description / 説明 |
|--------|----------|
| ID | Node identifier / ノード識別子 |
| Classification / 分類 | Cause, Intermediate, or Effect / 原因、中間、または結果 |
| Observable / 観測可能 | Yes, No, or `-` (causes are always observable) / Yes、No、または `-`（原因は常に観測可能） |
| Logical Statement / 論理言明 | Node label / ノードラベル |
| #1, #2, ... | Truth values for each test rule / 各テストルールの真理値 |

**Truth values / 真理値**:

| Value / 値 | Meaning / 意味 |
|------|----------|
| T | True (explicitly set) / 真（明示的に設定） |
| F | False (explicitly set) / 偽（明示的に設定） |
| t | True (deduced — no matching expression exists) / 真（演繹 — 対応する論理式なし） |
| f | False (deduced — no matching expression exists) / 偽（演繹 — 対応する論理式なし） |
| M | Masked (Don't Care — MASK constraint active) / マスク（Don't Care — MASK 制約有効） |
| I | Indeterminate (cannot determine due to M propagation) / 不定（M 伝播により確定不能） |

### 5.2 Coverage Table CSV / カバレッジ表 CSV

Each row represents a logical expression (edge) that should be covered.

各行がカバーされるべき論理式（エッジ）を表します。

| Column / 列 | Description / 説明 |
|--------|----------|
| Expr. / 論理式 | Expression identifier (Expr.1, Expr.2, ...) / 論理式識別子 |
| Node columns / ノード列 | Required truth values for this expression / この論理式に必要な真理値 |
| #1, #2, ... | Coverage markers for each test rule / 各テストルールのカバレッジマーカー |
| Status / 状態 | Infeasible or Untestable (if applicable) / 実行不能またはテスト不能（該当する場合） |
| Reason / 理由 | Explanation for special status / 特殊状態の理由 |

**Coverage markers / カバレッジマーカー**:

| Marker / マーカー | Meaning / 意味 |
|------|----------|
| `#` | Adopted — this test rule covers this expression / 採用 — このテストルールがこの論理式をカバー |
| `x` | Also covered — expression already covered by another rule / 追加カバー — 別のルールで既にカバー済み |
| (blank) | Not covered by this rule / このルールではカバーされない |

---

## 6. Error Handling / エラー処理

The CLI uses standard UNIX conventions for error reporting.

CLI はエラー報告に標準的な UNIX 規約を使用します。

| Exit Code / 終了コード | Meaning / 意味 |
|------|----------|
| 0 | Success / 成功 |
| 1 | Error (parse error, no feasible rules, missing @layout for SVG, etc.) / エラー |

- Diagnostic messages are written to **stderr** (never to stdout)
- stdout remains clean for piping even when errors occur

診断メッセージは **stderr** に出力されます（stdout には出力されません）。エラー発生時でも stdout はパイプのためにクリーンな状態を保ちます。

### Common Errors / よくあるエラー

**Parse error / パースエラー**:
```
Error: Parse error:
  line 5: Unexpected character: !
```
The `.nceg` file contains a syntax error. Check the indicated line for typos, missing quotes, or invalid keywords.

`.nceg` ファイルに構文エラーがあります。指定行のタイプミス、引用符の不足、無効なキーワードを確認してください。

**SVG without layout / レイアウトなしの SVG**:
```
Error: SVG output requires @layout coordinates in the .nceg file
```
The `--svg` option requires node position data. Save the graph from the NeoCEG GUI, which always includes `@layout` coordinates.

`--svg` オプションにはノード位置データが必要です。NeoCEG GUI からグラフを保存すると、`@layout` 座標が常に含まれます。

---

## 7. Notes / 備考

### Output Consistency / 出力の一貫性

The CLI produces the same decision table and coverage table as the NeoCEG GUI application for the same `.nceg` input. The core algorithm and CSV generation logic are shared between the two.

CLI は同じ `.nceg` 入力に対して、NeoCEG GUI アプリケーションと同じデシジョンテーブル・カバレッジ表を生成します。コアアルゴリズムと CSV 生成ロジックは両者で共有されています。

### SVG Output / SVG 出力について

The CLI generates SVG independently from the GUI (no browser required). Node colors follow the same conventions: Cause (blue), Intermediate (indigo), Effect (purple). AND/OR badges and NOT labels are rendered identically.

CLI は GUI とは独立して SVG を生成します（ブラウザ不要）。ノードの色は GUI と同じ規約に従います：原因（青）、中間（藍）、結果（紫）。AND/OR バッジと NOT ラベルも同一の描画です。

---

## Document History / 変更履歴

| Date / 日付 | Change / 変更 |
|---|---|
| 2026-04-04 | Initial version / 初版作成 |

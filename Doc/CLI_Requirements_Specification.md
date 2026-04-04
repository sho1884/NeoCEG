# NeoCEG CLI Requirements Specification / NeoCEG CLI 要求仕様書

| Item / 項目 | Content / 内容 |
|------|---------|
| Document / 文書 | NeoCEG CLI Requirements Specification / NeoCEG CLI 要求仕様書 |
| Version / バージョン | 0.1 (Draft / ドラフト) |
| Created / 作成日 | 2026-03-29 |
| Status / 状態 | Draft / ドラフト |

---

## 1. Purpose / 目的

This document defines requirements for the NeoCEG CLI — a UNIX filter-style command that processes `.nceg` files and outputs decision tables, coverage tables, and graph images, enabling integration into CI/CD pipelines and orchestration workflows.

本文書は NeoCEG CLI の要件を定義する。NeoCEG CLI は `.nceg` ファイルを処理し、デシジョンテーブル、カバレッジ表、グラフ画像を出力する UNIX フィルタ型コマンドであり、CI/CD パイプラインやオーケストレーションワークフローへの組み込みを可能にする。

### 1.1 Background / 背景

In the intended workflow, a human reviewer creates and refines a cause-effect graph using the NeoCEG GUI application. Once the review is complete and the `.nceg` file is finalized, it enters an automated pipeline. The CLI command serves as the bridge between this human-reviewed artifact and the automated downstream processes (data-driven test execution, report generation, etc.).

想定するワークフローでは、人間のレビュアーが NeoCEG GUI アプリケーションで原因結果グラフを作成・修正する。レビューが完了し `.nceg` ファイルが確定したら、自動パイプラインに投入する。CLI コマンドは、この人間がレビュー済みの成果物と、自動化された下流プロセス（データ駆動テスト実行、レポート生成等）をつなぐ役割を果たす。

### 1.2 Scope / スコープ

The CLI reuses the existing core logic (`src/services/`) and adds no new algorithmic functionality. It provides a non-interactive command-line interface to the same processing that the GUI application performs.

CLI は既存のコアロジック（`src/services/`）を再利用し、新たなアルゴリズム機能は追加しない。GUI アプリケーションと同じ処理を、非対話型のコマンドラインインターフェースとして提供する。

### 1.3 Writing Conventions / 記述規約

Same as [Requirements_Specification.md](./Requirements_Specification.md) §1.2.

[Requirements_Specification.md](./Requirements_Specification.md) §1.2 に準じる。

---

## 2. User Requirements / ユーザー要件

| ID | Task / タスク | Priority / 優先度 |
|----|------|----------|
| CLI-UR-001 | Generate a decision table from a finalized .nceg file in an automated pipeline / 確定済みの .nceg ファイルからデシジョンテーブルを自動パイプラインで生成する | High / 高 |
| CLI-UR-002 | Generate a coverage table for audit and traceability / 監査・トレーサビリティのためにカバレッジ表を生成する | Medium / 中 |
| CLI-UR-003 | Generate a graph image for inclusion in test design documents and reports / テスト設計書やレポートに含めるグラフ画像を生成する | Medium / 中 |

---

## 3. System Requirements / システム要件

### 3.1 Command Interface / コマンドインターフェース

| ID | Requirement / 要件 | Parent / 親 |
|----|----------|--------|
| CLI-SR-001 | Read `.nceg` input from a specified file path / 指定されたファイルパスから `.nceg` 入力を読み込む | CLI-UR-001 |
| CLI-SR-002 | Read `.nceg` input from standard input (stdin) / 標準入力（stdin）から `.nceg` 入力を読み込む | CLI-UR-001 |
| CLI-SR-003 | Write default output (decision table CSV) to standard output (stdout) / デフォルト出力（デシジョンテーブル CSV）を標準出力（stdout）に書き出す | CLI-UR-001 |
| CLI-SR-004 | Write output to a specified file path via option / オプション指定により出力を指定ファイルパスに書き出す | CLI-UR-001 |

**Rule Scenarios / ルールシナリオ**:

CLI-SR-001 + CLI-SR-003:
```
[Context]  A valid .nceg file exists at the specified path
[Action]   User runs: neoceg input.nceg
[Outcome]  Decision table CSV is written to stdout
```

CLI-SR-002 + CLI-SR-003:
```
[Context]  A valid .nceg content is available on stdin
[Action]   User runs: cat input.nceg | neoceg
[Outcome]  Decision table CSV is written to stdout
```

CLI-SR-004:
```
[Context]  User specifies an output file
[Action]   User runs: neoceg -o output.csv input.nceg
[Outcome]  Decision table CSV is written to the specified file
```

### 3.2 Output Modes / 出力モード

| ID | Requirement / 要件 | Parent / 親 |
|----|----------|--------|
| CLI-SR-010 | Output decision table in CSV format (default) / デシジョンテーブルを CSV 形式で出力する（デフォルト） | CLI-UR-001 |
| CLI-SR-011 | Output coverage table in CSV format via `--coverage` option / `--coverage` オプションによりカバレッジ表を CSV 形式で出力する | CLI-UR-002 |
| CLI-SR-012 | Output cause-effect graph in SVG format via `--svg` option / `--svg` オプションにより原因結果グラフを SVG 形式で出力する | CLI-UR-003 |

**Rule Scenarios / ルールシナリオ**:

CLI-SR-011:
```
[Context]  User needs a coverage table
[Action]   User runs: neoceg --coverage input.nceg
[Outcome]  Coverage table CSV is written to stdout
```

CLI-SR-012:
```
[Context]  User needs a graph image for documentation
[Action]   User runs: neoceg --svg -o graph.svg input.nceg
[Outcome]  SVG file containing the cause-effect graph is written to the specified file
```

### 3.3 SVG Output / SVG 出力

| ID | Requirement / 要件 | Parent / 親 |
|----|----------|--------|
| CLI-SR-020 | Render graph using `@layout` coordinates from the .nceg file / .nceg ファイルの `@layout` 座標を用いてグラフを描画する | CLI-SR-012 |
| CLI-SR-021 | Render nodes with role-based colors (Cause: blue, Intermediate: indigo, Effect: purple) / ノードを役割に応じた色で描画する（原因: 青、中間: 藍、結果: 紫） | CLI-SR-012 |
| CLI-SR-022 | Render logical edges with AND/OR/NOT notation / 論理エッジを AND/OR/NOT 表記で描画する | CLI-SR-012 |
| CLI-SR-023 | Render constraint edges with constraint type labels / 制約エッジを制約種別ラベル付きで描画する | CLI-SR-012 |
| CLI-SR-024 | Report an error if `@layout` section is absent / `@layout` セクションがない場合はエラーを報告する | CLI-SR-012 |

**Note / 注**: Future versions may integrate GraphViz for automatic layout generation when `@layout` is absent. This is out of scope for v1.0.

将来のバージョンでは、`@layout` がない場合に GraphViz による自動レイアウト生成を統合する構想がある。これは v1.0 のスコープ外とする。

### 3.4 Error Handling / エラー処理

| ID | Requirement / 要件 | Parent / 親 |
|----|----------|--------|
| CLI-SR-030 | Exit with code 0 on success / 成功時は終了コード 0 で終了する | CLI-UR-001 |
| CLI-SR-031 | Exit with code 1 on input/parse error and write diagnostic to stderr / 入力・パースエラー時は終了コード 1 で終了し、診断情報を stderr に出力する | CLI-UR-001 |
| CLI-SR-032 | Exit with code 1 when all rules are infeasible and write diagnostic to stderr / すべてのルールが実行不能な場合は終了コード 1 で終了し、診断情報を stderr に出力する | CLI-UR-001 |
| CLI-SR-033 | Never write diagnostic messages to stdout (preserve pipe cleanliness) / 診断メッセージは stdout に書き出さない（パイプの清潔さを保持する） | CLI-UR-001 |

**Rule Scenarios / ルールシナリオ**:

CLI-SR-031:
```
[Context]  Input .nceg has a syntax error on line 5
[Action]   User runs: neoceg broken.nceg
[Outcome]  stderr: "Error: Parse error at line 5: unexpected token 'XYZ'"
           exit code: 1
           stdout: (empty)
```

CLI-SR-032:
```
[Context]  All cause combinations violate constraints
[Action]   User runs: neoceg contradictory.nceg
[Outcome]  stderr: "Error: No feasible rules — all combinations violate constraints"
           exit code: 1
           stdout: (empty)
```

### 3.5 Help and Version / ヘルプとバージョン

| ID | Requirement / 要件 | Parent / 親 |
|----|----------|--------|
| CLI-SR-040 | Display usage information via `--help` or `-h` / `--help` または `-h` で使用方法を表示する | — |
| CLI-SR-041 | Display version information via `--version` / `--version` でバージョン情報を表示する | — |

---

## 4. Non-Functional Requirements / 非機能要件

### 4.1 Compatibility / 互換性

| ID | Requirement / 要件 |
|----|----------|
| CLI-NF-001 | Run on Node.js LTS (v18+) / Node.js LTS（v18以降）で動作する |
| CLI-NF-002 | Work on Linux, macOS, and Windows / Linux、macOS、Windows で動作する |
| CLI-NF-003 | Produce output identical to the GUI application for the same input / 同一入力に対して GUI アプリケーションと同一の出力を生成する |

### 4.2 Distribution / 配布

| ID | Requirement / 要件 |
|----|----------|
| CLI-NF-010 | Executable via `npx neoceg` without global installation / グローバルインストールなしで `npx neoceg` により実行可能とする |
| CLI-NF-011 | Installable globally via `npm install -g neoceg` / `npm install -g neoceg` によりグローバルインストール可能とする |

### 4.3 Design Constraints / 設計制約

| ID | Constraint / 制約 |
|----|----------|
| CLI-NF-020 | Reuse existing core logic in `src/services/` without modification / `src/services/` の既存コアロジックを変更なしで再利用する |
| CLI-NF-021 | No browser or DOM dependency / ブラウザまたは DOM への依存なし |
| CLI-NF-022 | Minimal additional dependencies / 追加依存パッケージは最小限とする |

---

## 5. Future Considerations / 将来の検討事項

The following are explicitly out of scope for v1.0 but are anticipated for future versions.

以下は v1.0 のスコープ外であるが、将来のバージョンで想定される。

| Item / 項目 | Description / 説明 |
|------|---------|
| GraphViz integration / GraphViz 統合 | Automatic layout generation when `@layout` is absent, producing cleaner graph output / `@layout` がない場合の自動レイアウト生成、より整ったグラフ出力 |
| API server / API サーバー | HTTP wrapper around the CLI for REST/gRPC integration / REST/gRPC 統合のための CLI 上の HTTP ラッパー |
| Multiple output in single invocation / 一回の呼び出しで複数出力 | Generate decision table + coverage table + SVG in a single run / デシジョンテーブル＋カバレッジ表＋SVG を一回の実行で生成 |
| JSON output format / JSON 出力形式 | Structured output for programmatic consumption / プログラム処理向けの構造化出力 |
| Watch mode / ウォッチモード | Re-run on file change for development workflows / 開発ワークフロー向けのファイル変更時自動再実行 |

---

## 6. Usage Summary / 使用方法概要

```
neoceg [options] [input-file]

Input:
  input-file          Path to .nceg file (default: stdin)

Output options:
  -o, --output FILE   Write output to FILE (default: stdout)
  --coverage          Output coverage table CSV instead of decision table
  --svg               Output cause-effect graph as SVG

Information:
  -h, --help          Show help message
  --version           Show version number

Examples:
  neoceg input.nceg                          # Decision table to stdout
  neoceg -o dt.csv input.nceg                # Decision table to file
  neoceg --coverage input.nceg               # Coverage table to stdout
  neoceg --coverage -o cov.csv input.nceg    # Coverage table to file
  neoceg --svg -o graph.svg input.nceg       # Graph SVG to file
  cat input.nceg | neoceg                    # Pipe from stdin
  cat input.nceg | neoceg --svg > graph.svg  # Pipe with SVG output
```

---

## Document History / 変更履歴

| Date / 日付 | Version / バージョン | Change / 変更 |
|---|---|---|
| 2026-03-29 | 0.1 | Initial draft / 初版ドラフト |

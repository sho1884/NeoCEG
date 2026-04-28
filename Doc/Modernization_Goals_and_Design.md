# NeoCEG モダナイゼーション目的・設計方針書

## 1. プロジェクト概要

### 1.1 プロジェクト名
**NeoCEG** - CEGTestのReact Flowを用いたモダナイゼーション

### 1.2 背景
CEGTest 1.6は2013年に開発された原因結果グラフ（Cause-Effect Graph）によるテスト設計支援ツールである。約10年が経過し、以下の課題が顕在化している：

- GUIの操作性が現代の水準に達していない
- 既知のバグが存在する
- AI時代における他ツールとの連携が考慮されていない
- データ形式が独自CSVで、人間可読性・ツール連携性が低い

---

## 2. モダナイゼーションの目的

### 2.1 主要目的

| 優先度 | 目的 | 詳細 |
|--------|------|------|
| 1 | GUI操作性の改善 | React Flowによるモダンなノードエディタ |
| 2 | 既知のバグの修正 | MASK制約における演算バグ等 |
| 3 | AI連携基盤の構築 | 他のAIツールからインポート可能な形式 |
| 4 | 将来拡張の基盤 | PICT連携、MCPサーバ化 |

### 2.2 維持すべき価値

- **リアクティブな表更新**: グラフ編集に即座にデシジョンテーブル・カバレッジ表が追従
- **原因結果グラフ技法の正確な実装**: 5種類の制約（ONE/EXCL/INCL/REQ/MASK）
- **テスト設計支援としての本質的価値**: 論理的に厳密なテスト条件の導出

---

## 3. 設計思想

### 3.1 AI時代のツール連携コンセプト

```
┌─────────────────────────────────────────────────────────────┐
│  上流AIツール（ChatGPT、Claude、その他LLM）                   │
│  ・仕様書から論理関係を抽出                                   │
│  ・原因結果グラフを自動生成                                   │
│  ・DSL形式でテキスト出力                                      │
└──────────────────────┬──────────────────────────────────────┘
                       │ DSL（論理関係 + 制約）
                       │ ※座標情報はオプション
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  NeoCEG（本ツール）                                          │
│  ・DSLインポート → 自動レイアウト                             │
│  ・人間によるレビュー・修正（視覚的エディタ）                  │
│  ・デシジョンテーブル自動生成                                 │
│  ・DSLエクスポート                                           │
└──────────────────────┬──────────────────────────────────────┘
                       │ 制約関係（PICT形式）
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  PICT（将来連携）                                            │
│  ・ペアワイズテスト設計                                       │
│  ・組み合わせテストとの統合                                   │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 ツールの役割

**NeoCEGは「AIが生成したグラフのレビュー・修正ツール」として位置づける**

原因結果グラフは多くの技術者にとって難しい技法である。AIに描いてもらい、人間がレビュー・修正するというワークフローが望まれる。そのため：

1. **一から描く人にも使いやすい** - 直感的なノード配置・接続
2. **レビューがしやすい** - 論理関係の可視化、エラー検出
3. **修正がしやすい** - ドラッグ＆ドロップ、Undo/Redo

### 3.3 アーキテクチャ方針

- **フロントエンド完結**: バックエンドサーバーは不要
- **ブラウザ上で動作**: デスクトップアプリ不要
- **React Flow採用**: ノードベースエディタの標準ライブラリ

### 3.4 方法論的位置づけ：仕様駆動テスト設計

NeoCEG は**仕様駆動のテスト設計ツール**であり、世の中に存在する**コード駆動の MC/DC カバレッジ生成ツール**（KLEE、CBMC、LDRA、VectorCAST 等）とは目的・仕組みともに大きく異なる。

#### 3.4.1 アプローチの比較

| 観点 | コード駆動 MC/DC 生成ツール | NeoCEG（仕様駆動） |
|------|---------------------------|-------------------|
| 入力 | ソースコード | 仕様（原因結果グラフ） |
| 方向 | コード → テスト | 仕様 → テスト → コード |
| 主な解析手法 | シンボリック実行 / SMT ソルバー | 論理式の組み合わせ列挙 |
| テストの意味 | コードを網羅的に通せる入力 | 仕様通りに動くべき入力 + 期待値 |
| 期待値（オラクル） | 持たない | 仕様から導出可能 |

#### 3.4.2 オラクル問題

コード駆動 MC/DC 生成ツールの根本的な制約は、**期待される出力（オラクル）を知らない**ことである。

- 入力値を生成し、コードがクラッシュせず実行できれば「合格」と判定
- コードに論理バグがあっても、バグを含んだ動作を「正しい」として記録してしまう
- 結果として、**MC/DC 100% カバレッジが達成されてもバグは検出されない**ことが起こり得る

NeoCEG は仕様（グラフ）から期待値を導出するため、生成されたテストは「**仕様通りに実装されているか**」を検証できる。これはコード駆動ツールには原理的に不可能な役割である。

#### 3.4.3 補完的関係

両アプローチは敵対するものではなく、補完的である：

- **コード駆動 MC/DC ツール**：既存コードのカバレッジ達成、リグレッション防止
- **NeoCEG（仕様駆動）**：設計の正しさの検証、要求仕様の段階での網羅性確保

NeoCEG は「テストすべきことが仕様の段階で決まる」というアプローチを採る。実装に依存しないため、コードを書く前にレビュー可能であり、AI による実装でも人間による実装でも同じ基準で検証できる。

---

## 4. データ形式設計

### 4.1 設計方針

| 方針 | 詳細 |
|------|------|
| 現行CSV互換性 | **不要**（新形式を優先） |
| 人間可読性 | **最優先**（述語論理に近い表現） |
| ツール連携性 | AIが生成しやすく、他ツールが解析しやすい |
| 形式定義 | **EBNFで正式に定義済み** ([DSL_Grammar_Specification.md](./DSL_Grammar_Specification.md)) |
| 座標情報 | あれば使用、なければ自動レイアウト |

### 4.2 DSL設計案

#### 4.2.1 基本構文（人間可読部分）

```
// NeoCEG DSL v1.0

// Graph title (optional)
@title "Login Feature Test Design"

// Node definition is implicit - nodes are created when referenced in relations
// Node roles (cause/intermediate/effect) are derived from graph structure:
//   - in-degree 0  -> cause (input)
//   - out-degree 0 -> effect (output)
//   - otherwise    -> intermediate

// Logical relations
auth_success := valid_user_id AND password_match
login_result := auth_success OR sso_auth

// Example with negation
error_display := NOT auth_success AND NOT sso_auth

// Constraints
ONE(auth_method_a, auth_method_b, auth_method_c)
EXCL(admin_mode, guest_mode)
INCL(email_notify, sms_notify, push_notify)
REQ(two_factor_auth -> sms_notify)
MASK(guest_mode -> {valid_user_id, password_match})
```

#### 4.2.2 記号の定義

| キーワード | 意味 | 代替表記（Unicode） |
|-----------|------|-------------------|
| `AND` | 論理積 | `&` または `∧` |
| `OR` | 論理和 | `\|` または `∨` |
| `NOT` | 否定 | `!` または `¬` |
| `:=` | 定義 | `:=` |
| `->` | 含意（REQ/MASK用） | `→` |

> **注**: DSLキーワードは英語のみ。ノードのラベル（識別子）はUnicode文字を許容し、日本語も使用可能。

#### 4.2.3 拡張構文（メタデータ）

```
// Layout coordinates (optional)
@layout {
  "valid_user_id": {"x": 100, "y": 50},
  "password_match": {"x": 100, "y": 150},
  "auth_success": {"x": 300, "y": 100}
}

// Node attributes (optional)
@attributes {
  "auth_success": {"observable": true, "memo": "intermediate node"},
  "login_result": {"observable": true}
}
```

### 4.3 EBNF定義

**正式な文法定義**: [DSL_Grammar_Specification.md](./DSL_Grammar_Specification.md) を参照してください。

以下は概要のみを示します：

```ebnf
(* NeoCEG DSL Grammar v1.0 - Summary *)

program         = { statement } ;
statement       = comment | node_definition | constraint_stmt | layout_stmt ;

(* ノード定義 *)
node_definition = identifier ( cause_def | effect_def ) ;
cause_def       = ":" string [ observable_flag ] ;
effect_def      = ":=" expression ;

(* 論理式 *)
expression      = or_expr ;
or_expr         = and_expr { "OR" and_expr } ;
and_expr        = unary_expr { "AND" unary_expr } ;
unary_expr      = [ "NOT" ] primary_expr ;
primary_expr    = identifier | "(" expression ")" ;

(* 制約 *)
constraint_stmt = symmetric_constraint | directional_constraint ;
symmetric_constraint = ( "ONE" | "EXCL" | "INCL" ) "(" member_list ")" ;
directional_constraint = ( "REQ" | "MASK" ) "(" constraint_member "->" member_list ")" ;

(* レイアウト *)
layout_stmt     = "@layout" "{" { layout_entry } "}" ;
layout_entry    = identifier ":" "(" number "," number ")" ;
```

**ステータス**: v1.0確定版（2026-02-08）

詳細な文法規則、意味規則、使用例については [DSL_Grammar_Specification.md](./DSL_Grammar_Specification.md) を参照してください。

---

## 5. デシジョンテーブル表示設計

### 5.1 表示モード

| モード | 説明 | 用途 |
|--------|------|------|
| **最適化表示** | 弱テスト条件を削除した標準表示 | 通常のテスト設計 |
| **全体表示** | 削除された条件も含む完全版 | 削除理由の確認、詳細分析 |

### 5.2 セル値の定義

| 値 | 意味 | 表示色（案） |
|----|------|-------------|
| T | ノードが真である | 緑 |
| t | 論理上ノードが真でならざるを得ない（該当する真偽の組合せが論理式にない） | 薄緑 |
| F | ノードが偽である | 赤 |
| f | 論理上ノードが偽でならざるを得ない（該当する真偽の組合せが論理式にない） | 薄赤 |
| M | MASK制約により真偽が決定できない | グレー |
| I | 原因側のノードが真偽不明のため真偽が決定できない | 黄色 |

### 5.3 テスト不可能・実行不可能の扱い

**CEGTest（現行）の問題点**:
- MASK制約でA,Bが「M」のとき、I = A ∧ B が「I」にならずT/Fになる

**NeoCEGの方針**:

| 状態 | 定義 | デシジョンテーブル | カバレッジ表 |
|------|------|-------------------|-------------|
| テスト不可能 | 入力が不確定のため結果が判定できない | **列を残す**（I表示） | 横2本線で表示 |
| 実行不可能 | 制約違反で実行自体ができない | 列を表示しない | 縦2本線で表示 |

> 「テスト不可能」な列を残す理由（秋山氏の提言）:
> テストの目的は「テスト対象の故障を見つける」こと。テスト不可能でも実行はできるため、結果がユーザーに受け入れられるかの確認に使える。

---

## 6. 既知のバグ修正方針

### 6.1 MASK制約の演算バグ

**現象**:
```
I = A ∧ B において、
A = M, B = M のとき、
CEGTest: I = T または F（誤り）
正解: I = I（不確定）
```

**修正方針**:
- 演繹計算において、オペランドに「M」が含まれる場合は結果を「I」とする
- 「I」は後続のノードにも伝播させる

### 6.2 その他のGUI問題

- ブラウザ依存の表示問題 → React Flowで解消
- 操作性の問題 → モダンUIで解消

---

## 7. 将来拡張

### 7.1 PICT連携

原因結果グラフの制約（ONE/EXCL/INCL）は、ペアワイズテストの制約と共通性がある。

```
# PICT形式への変換例
# ONE(A, B, C) → IF [A] = "T" THEN [B] = "F" AND [C] = "F";
#                IF [B] = "T" THEN [A] = "F" AND [C] = "F";
#                IF [C] = "T" THEN [A] = "F" AND [B] = "F";
```

### 7.2 MCPサーバ化

Model Context Protocol (MCP) サーバとして実装することで、Claude等のAIから直接操作可能にする。

```
# MCPサーバ機能案
- create_graph: 新規グラフ作成
- add_node: ノード追加
- add_relation: 論理関係追加
- add_constraint: 制約追加
- generate_decision_table: デシジョンテーブル生成
- export_dsl: DSL形式でエクスポート
```

---

## 8. 技術スタック（予定）

| カテゴリ | 技術 | 理由 |
|---------|------|------|
| フレームワーク | React | コンポーネントベース、エコシステム |
| グラフエディタ | React Flow | ノードベースUI、拡張性 |
| 状態管理 | Zustand または Redux | React Flowとの相性 |
| スタイリング | Tailwind CSS | 高速開発、カスタマイズ性 |
| ビルドツール | Vite | 高速、モダン |
| 言語 | TypeScript | 型安全性、保守性 |
| 国際化 | i18next | 英語/日本語対応 |

---

## 9. 開発フェーズ

### Phase 1: MVP（最小実行可能製品）
- 基本的なノード配置・接続
- AND/OR/NOT論理関係
- 5種類の制約
- デシジョンテーブル生成（バグ修正済み）
- DSLインポート/エクスポート

### Phase 2: 拡張機能
- 全体表示モード
- カバレッジ表
- Undo/Redo
- 自動レイアウト改善

### Phase 3: 連携機能
- PICT形式エクスポート
- MCPサーバ化

---

## 付録: 参考資料

- [CEGTest 1.6 現行機能分析書](./CEGTest_1.6_Feature_Analysis.md)
- 秋山浩一著「ソフトウェアテストしようぜ」連載（note.com）
- Reference/配下のPDF資料群

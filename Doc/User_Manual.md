# NeoCEG User Manual / NeoCEG ユーザーマニュアル

**Version**: 1.0
**Date**: 2026-03-01
**Status**: Initial release / 初版

---

## Overview / 概要

NeoCEG is a modern web-based Cause-Effect Graph (CEG) test design tool. It provides a graphical editor for building CEGs and automatically generates optimized decision tables with expression coverage analysis.

NeoCEGは、原因結果グラフ（CEG）によるテスト設計のためのWebベースツールです。CEGをグラフィカルに編集し、最適化されたデシジョンテーブルと論理式カバレッジ分析を自動生成します。

**Prerequisites / 前提知識**: This manual assumes familiarity with the Cause-Effect Graph methodology as described in Myers, Badgett, Sandler "The Art of Software Testing" 3rd Ed., Chapter 4, or ISO/IEC/IEEE 29119-4.

**前提知識**: 本マニュアルは、Myers著「ソフトウェア・テストの技法」第4章またはISO/IEC/IEEE 29119-4で解説されている原因結果グラフ法の知識を前提とします。

**System Requirements / 動作環境**: Modern web browser (Chrome, Firefox, Edge, Safari) with JavaScript enabled. All processing runs client-side — no data is sent to any server.

---

## Table of Contents / 目次

1. [Introduction / はじめに](#1-introduction--はじめに)
2. [Quick Start / クイックスタート](#2-quick-start--クイックスタート)
3. [Screen Layout / 画面構成](#3-screen-layout--画面構成)
4. [Working with Nodes / ノードの操作](#4-working-with-nodes--ノードの操作)
5. [Working with Edges / エッジの操作](#5-working-with-edges--エッジの操作)
6. [Constraints / 制約](#6-constraints--制約)
7. [Decision Table / デシジョンテーブル](#7-decision-table--デシジョンテーブル)
8. [Coverage Table / カバレッジテーブル](#8-coverage-table--カバレッジテーブル)
9. [Compare View / 比較ビュー](#9-compare-view--比較ビュー)
10. [NeoCEG DSL Reference / DSLリファレンス](#10-neoceg-dsl-reference--dslリファレンス)
11. [Import and Export / インポートとエクスポート](#11-import-and-export--インポートとエクスポート)
12. [Keyboard Shortcuts / キーボードショートカット](#12-keyboard-shortcuts--キーボードショートカット)
13. [Troubleshooting / トラブルシューティング](#13-troubleshooting--トラブルシューティング)
14. [Glossary / 用語集](#14-glossary--用語集)

---

## 1. Introduction / はじめに

NeoCEG is a reimplementation of the CEGTest tool, rebuilt from scratch using modern web technologies (React, TypeScript, React Flow). Key differences from traditional CEG tools:

NeoCEGはCEGTestツールの再実装であり、最新のWeb技術（React、TypeScript、React Flow）で一から構築されています。従来のCEGツールとの主な違い：

- **Browser-based / ブラウザベース**: No installation required. Works entirely in the browser.
  インストール不要。ブラウザ上で完結します。
- **Client-side only / クライアントサイド**: All computation runs locally. No data is transmitted to any server.
  すべての計算はローカルで実行。データはサーバーに送信されません。
- **Text-based file format / テキストベースファイル形式**: CEG definitions are saved as `.nceg` files — human-readable, version-control friendly, and AI-tool compatible.
  CEG定義は`.nceg`ファイルとして保存。人間が読め、バージョン管理しやすく、AIツールとの連携にも適しています。
- **Unicode labels / Unicodeラベル**: Node labels support Japanese and other Unicode characters. Keywords remain English-only.
  ノードラベルは日本語等のUnicodeに対応。キーワードは英語のみです。

On first launch with an empty canvas, a **Welcome Panel** appears with a Quick Start Guide. It auto-detects your browser language (English/Japanese) and can be toggled manually.

空のキャンバスで初回起動時、**Welcome Panel** がクイックスタートガイドとともに表示されます。ブラウザ言語（英語/日本語）を自動検出し、手動切替も可能です。

---

## 2. Quick Start / クイックスタート

This tutorial walks through creating a login authentication CEG with 3 causes, 2 effects, and a constraint.

このチュートリアルでは、3つの原因、2つの結果、1つの制約をもつログイン認証CEGを作成します。

| Step | Action / 操作 | Result / 結果 |
|------|---------------|---------------|
| 1 | Open NeoCEG in browser / ブラウザでNeoCEGを開く | Welcome Panel appears. Close it by clicking ✕ or clicking outside / Welcome Panelが表示。✕クリックまたは外側クリックで閉じる |
| 2 | Double-click the canvas / キャンバスをダブルクリック | A blue node "Logical Statement 1" appears (this is a cause) / 青いノード「Logical Statement 1」が出現（原因ノード） |
| 3 | Double-click the node to edit its label / ノードをダブルクリックしてラベル編集 | Type "User clicks login" and press Enter / 「User clicks login」と入力してEnter |
| 4 | Repeat steps 2-3 to create two more cause nodes / ステップ2-3を繰り返して原因ノードをあと2つ作成 | "Network connected" and "Auth server responds" / 「Network connected」「Auth server responds」 |
| 5 | Double-click canvas below and to the right of the causes / 原因ノードの右下でキャンバスをダブルクリック | A new node appears for "Login success" / 新しいノードが出現。「Login success」とラベル設定 |
| 6 | Drag from the right handle of "User clicks login" to the left handle of "Login success" / 「User clicks login」の右ハンドルから「Login success」の左ハンドルへドラッグ | An edge is created. "Login success" turns purple (effect) with an AND badge / エッジが作成される。「Login success」が紫（結果）に変わり、ANDバッジが表示 |
| 7 | Connect the other two causes to "Login success" the same way / 同じ方法で残りの2つの原因を「Login success」に接続 | Three edges lead into "Login success" with AND logic / ANDロジックで3つのエッジが接続 |
| 8 | Create another effect node "Error message" and connect "Network connected" to it / 結果ノード「Error message」を作成し、「Network connected」から接続 | Click the edge to toggle NOT (a blue "NOT" label appears) / エッジをクリックしてNOTを切替（青い「NOT」ラベルが表示） |
| 9 | Select both effect nodes (Shift+Click), then click the **Excl** toolbar button / 両方の結果ノードを選択（Shift+クリック）し、ツールバーの **Excl** ボタンをクリック | An EXCL constraint node appears, connected to both effects / EXCL制約ノードが出現し、両方の結果に接続 |
| 10 | Look at the Decision tab in the bottom panel / 下部パネルのDecisionタブを確認 | The generated decision table shows feasible test rules / 生成されたデシジョンテーブルに実行可能なルールが表示 |

**Saving your work / 作業の保存**: File menu > Save CEG Definition to download a `.nceg` file. You can also copy the definition to clipboard via File > Copy CEG Definition.

**作業の保存**: Fileメニュー > Save CEG Definitionで`.nceg`ファイルをダウンロード。File > Copy CEG Definitionでクリップボードにコピーも可能。

---

## 3. Screen Layout / 画面構成

### 3.1 Toolbar / ツールバー

```
[NeoCEG] | [File ▾] | [↶ ↷] | [One] [Excl] [Incl] [Req] [Mask] | [N nodes selected] [?]
```

| Section / セクション | Description / 説明 |
|---|---|
| NeoCEG (Logo) | Application name with build timestamp / アプリケーション名とビルドタイムスタンプ |
| File | Dropdown menu for import, export, and clear operations (see [§11](#11-import-and-export--インポートとエクスポート)) / インポート、エクスポート、クリア操作のドロップダウン |
| ↶ ↷ | Undo (Ctrl+Z) and Redo (Ctrl+Y), up to 50 states / 元に戻す・やり直し（最大50状態） |
| One Excl Incl Req Mask | Constraint creation buttons — always enabled (see [§6](#6-constraints--制約)) / 制約作成ボタン（常に有効） |
| Status | Selection count and help tooltip (?) / 選択数表示とヘルプツールチップ |

### 3.2 Canvas / キャンバス

The main graph editing area. Double-click to create nodes, drag handles to connect them with edges. Supports zoom (mouse wheel) and pan (drag on empty canvas). Shift+Click or drag a selection rectangle for multi-select.

メインのグラフ編集エリア。ダブルクリックでノード作成、ハンドルをドラッグしてエッジ接続。ズーム（マウスホイール）とパン（キャンバスをドラッグ）に対応。Shift+クリックまたは矩形ドラッグで複数選択。

### 3.3 Bottom Panel / 下部パネル

Four tabs below the canvas:

キャンバスの下に4つのタブ：

| Tab / タブ | Purpose / 用途 |
|---|---|
| **Decision** | Generated decision table with test rules (see [§7](#7-decision-table--デシジョンテーブル)) / テストルールを含むデシジョンテーブル |
| **Coverage** | Expression coverage analysis (see [§8](#8-coverage-table--カバレッジテーブル)) / 論理式カバレッジ分析 |
| **Compare** | Side-by-side decision + coverage view (see [§9](#9-compare-view--比較ビュー)) / デシジョン＋カバレッジの並列表示 |
| **NeoCEG Language {.nceg}** | Live DSL text view with copy/paste/save/import buttons / DSLテキストのリアルタイム表示（コピー・貼り付け・保存・インポートボタン付き） |

---

## 4. Working with Nodes / ノードの操作

### 4.1 Creating Nodes / ノード作成

Double-click on the canvas to create a new node. Default names follow a sequential pattern: "Logical Statement 1", "Logical Statement 2", etc. The counter resets when you use Clear All.

キャンバスをダブルクリックして新しいノードを作成します。デフォルト名は連番パターン（「Logical Statement 1」「Logical Statement 2」等）に従います。Clear Allでカウンターはリセットされます。

### 4.2 Node Roles / ノードのロール

Node roles are **automatically derived from graph structure** — you never set them manually.

ノードのロールは**グラフ構造から自動判定**されます。手動で設定することはありません。

| Role / ロール | Condition / 条件 | Fill Color / 塗り | Border / 枠 |
|---|---|---|---|
| **Cause** / 原因 | No incoming logical edges (in-degree = 0) / 入力エッジなし | Light blue `#e3f2fd` | Blue `#1976d2` |
| **Intermediate** / 中間 | Both incoming and outgoing edges / 入出力ともあり | Light indigo `#e8eaf6` | Indigo `#3949ab` |
| **Effect** / 結果 | No outgoing logical edges (out-degree = 0) / 出力エッジなし | Light purple `#f3e5f5` | Purple `#7b1fa2` |

When you connect an edge to a cause node, it automatically becomes an intermediate or effect, and its color changes accordingly.

原因ノードにエッジを接続すると、自動的に中間または結果ノードに変わり、色も変化します。

### 4.3 Editing Labels / ラベル編集

| Action / 操作 | Key / キー |
|---|---|
| Start editing / 編集開始 | Double-click on node / ノードをダブルクリック |
| Save / 確定 | Enter |
| Cancel / キャンセル | Escape |
| Insert newline / 改行挿入 | Shift+Enter |

Labels support Unicode characters including Japanese. Node width auto-adjusts and can be manually resized by dragging the node border when selected (range: 80-400px, default: 150px).

ラベルは日本語を含むUnicode文字に対応。ノード幅は自動調整され、選択時にノード枠をドラッグして手動リサイズも可能（範囲：80-400px、デフォルト：150px）。

### 4.4 AND/OR Operator / AND/OR演算子

When a node receives its first incoming edge, an **AND** badge appears at the node's left-center. Click the badge to toggle between AND and OR. The badge color indicates the operator:

ノードに最初の入力エッジが接続されると、ノードの左中央に **AND** バッジが表示されます。バッジをクリックしてANDとORを切り替えます。バッジの色は演算子を示します：

- **AND**: Blue `#1976d2`
- **OR**: Muted orange `#bf6c00`

### 4.5 Observable Flag / 観測可能フラグ

By default, all nodes are **observable** (no indicator shown). If a node's output cannot be directly tested or measured, mark it as non-observable:

デフォルトではすべてのノードが**観測可能**です（インジケーター表示なし）。ノードの出力を直接テスト・計測できない場合、非観測可能に設定します：

**Right-click node > Mark as Non-Observable** / 右クリック > 観測不可能に設定

| State / 状態 | Graph Indicator / グラフ表示 | Decision Table / デシジョンテーブル |
|---|---|---|
| Observable (default) / 観測可能 | No indicator / 表示なし | No indicator / 表示なし |
| Non-observable / 観測不可 | Amber closed-eye icon at top-right / 右上にamber閉じた目アイコン | Amber dot (●) next to label / ラベル横にamber丸 |

> **Note**: Cause nodes never display the indicator (they are always observable by definition).
> 原因ノードはインジケーターを表示しません（定義上常に観測可能）。

### 4.6 Node Right-click Menu / ノード右クリックメニュー

| Menu Item / メニュー項目 | Condition / 条件 | Action / 動作 |
|---|---|---|
| Set label to expression | Node has incoming edges / 入力エッジあり | Replace label with the logical expression of inputs / ラベルを入力の論理式で置換 |
| Mark as Observable / Non-Observable | Always / 常時 | Toggle observable flag / 観測可能フラグを切替 |
| Delete Node | Always / 常時 | Delete node and cascade-delete related constraints / ノードと関連制約を連鎖削除 |

---

## 5. Working with Edges / エッジの操作

### 5.1 Logical Edges / 論理エッジ

| Operation / 操作 | How / 方法 |
|---|---|
| Create edge / エッジ作成 | Drag from the source node's right handle to the target node's left handle / ソースノードの右ハンドルからターゲットノードの左ハンドルへドラッグ |
| Toggle NOT / NOT切替 | Click on the edge / エッジをクリック |
| Delete / 削除 | Select the edge, then press Delete key / エッジを選択してDeleteキー |

A negated edge displays a blue "NOT" label and a circle marker at the source end.

否定エッジは青い「NOT」ラベルとソース端に円形マーカーを表示します。

### 5.2 Edge Right-click Menu / エッジ右クリックメニュー

| Menu Item / メニュー項目 | Action / 動作 |
|---|---|
| Add NOT / Remove NOT | Toggle negation / 否定を切替 |
| Delete Edge | Remove the edge / エッジを削除 |

---

## 6. Constraints / 制約

### 6.1 Overview / 概要

Constraints restrict which combinations of cause truth values are valid. In NeoCEG, each constraint is a **dedicated constraint node** displayed on the canvas, connected to its member nodes via constraint edges. This differs from some tools that represent constraints as annotations on edges.

制約は原因の真理値の有効な組合せを制限します。NeoCEGでは、各制約はキャンバス上に表示される**専用の制約ノード**であり、制約エッジでメンバーノードに接続されます。エッジのアノテーションとして制約を表現するツールとは異なります。

### 6.2 Constraint Types / 制約タイプ

| Type | Label | Shape / 形状 | Direction / 方向 | Logic / 論理 | Myers |
|---|---|---|---|---|---|
| **ONE** | One | Circle / 円 | Symmetric / 対称 | Exactly one member = T / メンバーのちょうど1つがT | O |
| **EXCL** | Excl | Circle / 円 | Symmetric / 対称 | At most one member = T / メンバーの最大1つがT | E |
| **INCL** | Incl | Circle / 円 | Symmetric / 対称 | At least one member = T / メンバーの少なくとも1つがT | I |
| **REQ** | Req | Rectangle / 矩形 | Directional / 方向性あり | Source=T → all targets must be T / ソース=T → 全ターゲットがT | R |
| **MASK** | Mask | Rectangle / 矩形 | Directional / 方向性あり | Trigger=T → targets become M (Don't Care) / トリガー=T → ターゲットがM | M |

### 6.3 Practical Guide: When to Use Each / 使い分けガイド

**ONE vs EXCL**:
- **ONE** = radio button: exactly one must be selected. Example: Payment method (Cash / Credit / Digital) when payment is required.
  ONE = ラジオボタン。必ず1つ選択。例：支払い方法（現金/クレジット/デジタル）で支払いが必須の場合。
- **EXCL** = mutual exclusion, but zero is allowed. Example: Optional discount codes (A / B / C) — the user may apply at most one, or none.
  EXCL = 排他的だが0個も可。例：オプション割引コード（A/B/C）— 最大1つ、または適用なし。

**INCL**: At least one must be true. Example: Notification channels (Email / SMS / Push) — at least one must be enabled.
INCL = 少なくとも1つが真。例：通知チャネル（Email/SMS/Push）— 少なくとも1つを有効化。

**REQ**: Prerequisite relationship. Example: "Premium features" requires "Account verified." If the source is true, all targets must be true; if the source is false, no restriction applies.
REQ = 前提条件。例：「プレミアム機能」は「アカウント認証済み」が前提。ソースが真なら全ターゲットが真、ソースが偽なら制約なし。

**MASK**: Makes targets irrelevant. Example: "Offline mode" masks "Server response time" and "API latency." When the trigger is true, the target values become M (Don't Care) — they cannot affect test results.
MASK = ターゲットを無関係化。例：「オフラインモード」が「サーバー応答時間」「API遅延」をマスク。トリガーが真のときターゲットはM（Don't Care）になり、テスト結果に影響しない。

### 6.4 Creating Constraints / 制約の作成

Constraint toolbar buttons (One, Excl, Incl, Req, Mask) are **always enabled**. Their behavior depends on the current selection:

制約ツールバーボタン（One, Excl, Incl, Req, Mask）は**常に有効**です。動作は現在の選択状態に依存します：

| Selection State / 選択状態 | Button Click / ボタンクリック | Result / 結果 |
|---|---|---|
| CEG nodes selected / CEGノード選択中 | Any constraint button | Create constraint connected to all selected nodes / 選択ノードに接続した制約を作成 |
| Constraint node selected / 制約ノード選択中 | Any constraint button | Change constraint type / 制約タイプを変更 |
| Nothing selected / 何も選択なし | Any constraint button | Create unconnected constraint at center / 中央に未接続の制約を作成 |

You can also add members manually by dragging from a constraint node's handle to a CEG node.

制約ノードのハンドルからCEGノードへドラッグして手動でメンバーを追加することもできます。

### 6.5 Directional Constraints (REQ/MASK) / 方向性制約

**First connection rule / 初回接続ルール**: When you connect the first edge to an empty REQ/MASK constraint, that CEG node becomes the source/trigger. Subsequent connections become targets.

**初回接続ルール**：空のREQ/MASK制約に最初のエッジを接続すると、そのCEGノードが自動的にソース/トリガーになります。以降の接続はターゲットになります。

**Changing direction / 方向の変更**: Right-click a target constraint edge and select "Set as Source" (REQ) or "Set as Trigger" (MASK). The current source/trigger is demoted to a target.

**方向の変更**：ターゲット制約エッジを右クリックし、「Set as Source」（REQ）または「Set as Trigger」（MASK）を選択。現在のソース/トリガーはターゲットに降格します。

> **REQ NOT rule**: NOT is allowed on **source or target side, but not both simultaneously**. `REQ(NOT A -> NOT B)` is prohibited because the meaning becomes ambiguous. Examples: `REQ(NOT A -> B)` = "If A=F then B=T", `REQ(A -> NOT B)` = "If A=T then B=F".
> **REQのNOTルール**：NOTは**ソース側またはターゲット側のいずれかに適用可能。両方同時は禁止**（意味が曖昧になるため）。例：`REQ(NOT A -> B)` =「A=FならばB=T」、`REQ(A -> NOT B)` =「A=TならばB=F」。
>
> **MASK NOT rule**: NOT is allowed on the **trigger side only**. NOT is prohibited on targets. Example: `MASK(NOT A -> B)` = "If A=F then B is masked".
> **MASKのNOTルール**：NOTは**トリガー側のみ**許可。ターゲット側は禁止。例：`MASK(NOT A -> B)` =「A=FならばBはマスク」。
>
> **Why this asymmetry? / なぜ非対称か？** REQ sets T/F values on targets — NOT reverses this (T→F), producing a different result. MASK sets M (Don't Care) on targets — NOT M = M, so target NOT produces the same result and is meaningless.
> REQはターゲットにT/Fを設定するためNOTで反転（T→F）すると異なる結果になる。MASKはターゲットにM（Don't Care）を設定するためNOT M = Mとなり、ターゲットNOTは同じ結果になり無意味。
> - `REQ(A -> B)`: A=T → B=**T** / `REQ(A -> NOT B)`: A=T → B=**F** (different / 異なる)
> - `MASK(A -> B)`: A=T → B=**M** / `MASK(A -> NOT B)`: A=T → B=**M** (same / 同じ)

### 6.6 Constraint NOT / 制約のNOT

NOT can be applied to constraint members (click the constraint edge to toggle). This inverts the member's effective value before applying the constraint logic.

制約メンバーにNOTを適用できます（制約エッジをクリックで切替）。制約ロジックの適用前にメンバーの実効値が反転されます。

Example: `EXCL(A, NOT B)` means that A=T and B=F cannot coexist — at most one of {A, NOT B} can be true.

例：`EXCL(A, NOT B)` は A=T と B=F が共存できないことを意味します — {A, NOT B} のうち最大1つのみ真。

> **Note**: For REQ, NOT is allowed on source or target (not both). For MASK, trigger only. See §6.5.
> **注記**：REQではNOTはソースまたはターゲットの片方のみ。MASKではトリガーのみ。§6.5参照。

### 6.7 Type Conversion Rules / タイプ変換ルール

When changing a constraint's type:

制約タイプを変更する場合：

| From → To / 変更 | Rule / ルール |
|---|---|
| Symmetric → Symmetric (e.g., ONE → EXCL) | All members preserved / 全メンバー維持 |
| Symmetric → Directional (e.g., EXCL → REQ) | First member becomes source/trigger, rest become targets / 最初のメンバーがソース/トリガー、残りがターゲット |
| Directional → Symmetric (e.g., REQ → EXCL) | Source/trigger and targets become equal members / ソース/トリガーとターゲットが均等メンバーに |
| Directional → Directional (REQ ↔ MASK) | Source/trigger and targets preserved as-is / ソース/トリガーとターゲットをそのまま維持 |

---

## 7. Decision Table / デシジョンテーブル

### 7.1 Overview / 概要

The **Decision** tab displays the generated test conditions (rules). Each column is a rule, and rows are grouped into three color-coded sections:

**Decision** タブは生成されたテスト条件（ルール）を表示します。各列が1つのルール、行は3つの色分けされたセクションにグループ化されます：

| Section / セクション | Header Color / ヘッダー色 | Row Color / 行色 |
|---|---|---|
| **Causes** / 原因 | Blue `#1976d2` | Light blue `#e3f2fd` |
| **Intermediate** / 中間 | Indigo `#3949ab` | Light indigo `#e8eaf6` |
| **Effects** / 結果 | Purple `#7b1fa2` | Light purple `#f3e5f5` |

Each row has an **ID column** (displayed in subdued gray) showing the node identifier (e.g., `p1`, `p2`). This identifier corresponds to the node name used in the NeoCEG Language (§10) and in the coverage table's Reason column (§8.4).

各行には**ID列**（控えめなグレーで表示）があり、ノード識別子（例：`p1`, `p2`）を表示します。この識別子はNeoCEG言語（§10）およびカバレッジ表のReason列（§8.4）で使用されるノード名に対応します。

### 7.2 Truth Values / 真理値

NeoCEG uses six truth values. **Case matters** — uppercase and lowercase have different meanings:

NeoCEGは6つの真理値を使用します。**大文字・小文字は意味が異なります**：

| Value / 値 | Meaning / 意味 | Color / 色 |
|---|---|---|
| **T** | The node is true. / ノードが真である。 | Green `#c8e6c9` |
| **t** | The node must logically be true — no matching true/false combination exists in the logical expressions. / 論理上ノードが真でならざるを得ない（該当する真偽の組合せが論理式にない）。 | Light green `#e8f5e9` |
| **F** | The node is false. / ノードが偽である。 | Red `#ffcdd2` |
| **f** | The node must logically be false — no matching true/false combination exists in the logical expressions. / 論理上ノードが偽でならざるを得ない（該当する真偽の組合せが論理式にない）。 | Light red `#ffebee` |
| **M** | Truth value cannot be determined due to MASK constraint. / MASK制約により真偽が決定できない。 | Gray `#e0e0e0` |
| **I** | Truth value cannot be determined because a cause-side node is indeterminate. / 原因側のノードが真偽不明のため真偽が決定できない。 | Yellow `#fff9c4` |

### 7.3 Practice Mode vs Learning Mode / プラクティスモード vs ラーニングモード

Toggle between modes using the switch at the top of the decision table.

デシジョンテーブル上部のスイッチでモードを切り替えます。

| Mode / モード | Shows / 表示内容 | Use Case / 用途 |
|---|---|---|
| **Practice** (default) | Only feasible rules / 実行可能なルールのみ | Normal test design workflow / 通常のテスト設計 |
| **Learning** | All 2^n cause combinations / 全2^n原因組合せ | Understanding why rules are excluded; shows Infeasible, Weak, Untestable, Redundant badges / ルール除外理由の理解 |

> **Note**: Learning Mode always displays truth values in uppercase (T/F only). The lowercase distinction (t/f) is an advanced concept related to expression matching — Learning Mode focuses on "what would happen if tested" without this subtlety.
> **注意**：学習モードでは真理値を常に大文字（T/F）で表示します。小文字（t/f）の区別は論理式マッチングに関する高度な概念であり、学習モードでは「もしテストしたらどうなるか」に焦点を当てるためこの区別は行いません。

> **Note**: Learning Mode auto-disables when there are more than 8 causes (>256 combinations) for performance reasons.
> **注意**：原因が8個超（256組合せ超）の場合、パフォーマンスのためLearning Modeは自動無効化されます。

### 7.4 M/I Calculation Rules / M/I計算ルール

When M (Masked) values propagate through logical operators, they may produce I (Indeterminate) results. The rules are:

M（マスク）値が論理演算子を通過するとき、I（不定）を生成することがあります。ルールは以下の通り：

**AND**:

| | T | F | M | I |
|---|---|---|---|---|
| **T** | t | f | I | I |
| **F** | f | f | f | f |
| **M** | I | f | I | I |
| **I** | I | f | I | I |

- F is the absorbing element for AND: anything AND F = f.
  FはANDの吸収元：何 AND F = f

**OR**:

| | T | F | M | I |
|---|---|---|---|---|
| **T** | t | t | t | t |
| **F** | t | f | I | I |
| **M** | t | I | I | I |
| **I** | t | I | I | I |

- T is the absorbing element for OR: anything OR T = t.
  TはORの吸収元：何 OR T = t

**NOT**:

| Input / 入力 | Output / 出力 |
|---|---|
| T, t | f |
| F, f | t |
| M | M |
| I | I |

> **CEGTest 1.6 bug fix**: The original CEGTest 1.6 incorrectly calculated M AND M as T or F. NeoCEG correctly evaluates M AND M = I (Indeterminate).
> **CEGTest 1.6バグ修正**：CEGTest 1.6はM AND Mを誤ってTまたはFと計算していました。NeoCEGではM AND M = I（不定）と正しく評価します。

### 7.5 Row Ordering / 行の並び順

Within each section, rows are sorted by the Y-coordinate of the corresponding node on the canvas (ascending: top → bottom). This is a display-layer sort only — it does not affect node identifiers or DSL export order.

各セクション内の行は、キャンバス上のノードのY座標の昇順（上→下）でソートされます。これは表示層のみのソートで、ノード識別子やDSLエクスポート順には影響しません。

---

## 8. Coverage Table / カバレッジテーブル

### 8.1 What is Expression Coverage / 論理式カバレッジとは

Expression coverage ensures that each logical edge (subexpression) in the CEG is exercised by at least one test rule. Each edge from node A to node B becomes one expression to be covered.

論理式カバレッジは、CEG内の各論理エッジ（部分式）が少なくとも1つのテストルールで検証されることを保証します。ノードAからノードBへの各エッジが1つの被カバレッジ式になります。

### 8.2 Reading the Coverage Table / カバレッジテーブルの読み方

The **Coverage** tab has two parts:

**Coverage** タブは2つの部分で構成されます：

- **Row labels**: Each row is labeled `Expr.1`, `Expr.2`, ... corresponding to each logical edge (expression) in the CEG.
  **行ラベル**：各行は `Expr.1`, `Expr.2`, ... と表示され、CEG内の各論理エッジ（式）に対応。
- **Left columns**: Required node values for each expression. Column headers show the node identifier and label (e.g., `p1: Valid user ID`). Shows which cause/intermediate values are needed to exercise this expression.
  **左列**：各論理式の必要ノード値。列ヘッダーにはノード識別子とラベルが表示されます（例：`p1: 有効なユーザーID`）。この式を検証するために必要な原因/中間値を表示。
- **Right columns**: Coverage markers for each feasible test rule (#1, #2, ...). Shows whether each rule covers this expression.
  **右列**：各実行可能ルールのカバレッジマーカー (#1, #2, ...)。各ルールがこの式をカバーするかを表示。
- **Status (状態) column**: Shows the expression status when it cannot be tested normally. Empty for testable expressions.
  **Status (状態) 列**：正常にテストできない論理式の状態を表示。テスト可能な式では空欄。
- **Reason (理由) column**: Shows the reason why an expression is infeasible or untestable. For infeasible expressions, shows which constraint was violated (e.g., `ONE(A, B, C)`). For untestable expressions, shows the MASK constraint that causes indeterminacy.
  **Reason (理由) 列**：論理式が実行不能またはテスト不能である理由を表示。実行不能な式では違反した制約を表示（例：`ONE(A, B, C)`）。テスト不能な式ではMASK制約を表示。

Infeasible and untestable rows are displayed with a gray background across the entire row to visually distinguish them from testable expressions.

実行不能・テスト不能の行は行全体がグレー背景で表示され、テスト可能な式と視覚的に区別できます。

### 8.3 Coverage Markers / カバレッジマーカー

| Marker / マーカー | Display / 表示 | Meaning / 意味 |
|---|---|---|
| Adopted / 採択 | **#** (blue bold) | First test rule to cover this expression / この式を最初にカバーするルール |
| Covered / カバー済み | **x** (green) | Additional rule covering an already-covered expression / 既にカバー済みの式をさらにカバーするルール |
| Not covered / 未カバー | (blank) | Rule does not exercise this expression / このルールはこの式を検証しない |
| Infeasible / 実行不能 | **-** (red) | Expression can never be tested due to constraint violations / 制約違反のため検証不可 |
| Untestable / テスト不能 | **?** (amber) | Expression is untestable due to MASK constraint (result is I) / MASK制約によりテスト不能 |

### 8.4 Status and Reason Columns / Status・Reason 列

| Status | Reason example / 理由の例 | Row style / 行スタイル |
|---|---|---|
| (empty) | (empty) | Normal / 通常 |
| Infeasible | `ONE(A, B, C)`, `EXCL(X, Y)`, `REQ(A → B)` | Gray background / グレー背景 |
| Untestable | `MASK(X → Y, Z)` | Gray background / グレー背景 |

The **Reason** column shows the specific constraint that caused the expression to be infeasible or untestable, using node identifiers (e.g., `p1`, `p2`). These identifiers can be cross-referenced with the ID column in the decision table (§7.1) or the column headers in the coverage table. For directional constraints (REQ/MASK), the arrow notation (`→`) indicates the source/trigger and targets.

**Reason** 列には、論理式が実行不能またはテスト不能となった具体的な制約を、ノード識別子（例：`p1`, `p2`）を使って表示します。これらの識別子はデシジョンテーブルのID列（§7.1）またはカバレッジ表の列ヘッダーと対照できます。方向性制約（REQ/MASK）では、矢印（`→`）でソース/トリガーとターゲットを示します。

### 8.5 Coverage Statistics / カバレッジ統計

The status bar shows: `N rules | X% coverage (covered/total)`

ステータスバーに表示：`N rules | X% coverage (covered/total)`

Coverage percentage excludes infeasible and untestable expressions from the denominator: `covered / (total - infeasible - untestable)`.

カバレッジ率は分母から実行不能・テスト不能を除外：`covered / (total - infeasible - untestable)`

---

## 9. Compare View / 比較ビュー

The **Compare** tab displays the Decision Table and Coverage Table stacked vertically with synchronized column widths. This allows you to cross-reference which test rules contribute to which expression coverage without switching tabs.

**Compare** タブはデシジョンテーブルとカバレッジテーブルを列幅を同期させて縦に並べて表示します。タブを切り替えることなく、どのテストルールがどの論理式カバレッジに寄与するかを対照できます。

---

## 10. NeoCEG DSL Reference / DSLリファレンス

### 10.1 File Format / ファイル形式

- Extension: `.nceg`
- Encoding: UTF-8
- Line endings: LF (on export); LF and CRLF accepted on import

### 10.2 Syntax Overview / 構文概要

```
# Comments start with #
# コメントは # で始まる

# Cause definitions: identifier: "label"
p1: "Valid user ID entered"
p2: "Password matches"
p3: "Server available" [unobservable]    # Non-observable node

# Effect/Intermediate definitions: identifier := expression
auth_success := p1 AND p2
login_result := auth_success AND p3
error_display := NOT p1 OR NOT p2

# Constraints
EXCL(auth_success, error_display)
REQ(auth_success -> p3)
MASK(p3 -> login_result, error_display)

# Optional layout section
@layout {
  p1: (100, 100)
  p2: (100, 200)
  p3: (100, 300)
  auth_success: (300, 150)
  login_result: (500, 200)
  error_display: (500, 300)
  c0: (400, 100)          # Constraint node position (c0 = first constraint)
}
```

### 10.3 Keywords / キーワード

All keywords are **case-insensitive** but conventionally written in UPPERCASE.

キーワードは**大文字小文字を区別しません**が、慣例的に大文字で記述します。

| Keyword | Purpose / 用途 |
|---|---|
| `AND` | Logical conjunction / 論理積 |
| `OR` | Logical disjunction / 論理和 |
| `NOT` | Logical negation / 否定 |
| `ONE` | Exactly-one constraint / 排他的選択制約 |
| `EXCL` | Exclusive constraint / 排他制約 |
| `INCL` | Inclusive constraint / 包含制約 |
| `REQ` | Requires constraint / 要求制約 |
| `MASK` | Masking constraint / マスク制約 |

### 10.4 Operator Precedence / 演算子優先順位

| Priority / 優先度 | Operator | Associativity / 結合性 |
|---|---|---|
| 1 (highest) | `NOT` | Right / 右結合 |
| 2 | `AND` | Left / 左結合 |
| 3 (lowest) | `OR` | Left / 左結合 |

Use parentheses `()` to override precedence. Example: `p1 AND (p2 OR p3)`.

括弧 `()` で優先順位を変更できます。例：`p1 AND (p2 OR p3)`

### 10.5 Observable Flag / 観測可能フラグ

- `[unobservable]` after a cause definition marks the node as non-observable.
- `[observable]` is accepted for backward compatibility (equivalent to the default — observable).
- If neither tag is present, the node is observable by default.
- When re-exporting, only `[unobservable]` is written; `[observable]` is never output.

### 10.6 Formal Grammar / 正式文法

For the complete EBNF grammar definition, see [DSL_Grammar_Specification.md](./DSL_Grammar_Specification.md).

完全なEBNF文法定義は [DSL_Grammar_Specification.md](./DSL_Grammar_Specification.md) を参照してください。

---

## 11. Import and Export / インポートとエクスポート

### 11.1 Open from URL / URLから開く

You can launch NeoCEG with a pre-loaded graph by adding a `?file=` query parameter to the URL:

URLに `?file=` クエリパラメータを付けてNeoCEGを起動すると、グラフを読み込んだ状態で開けます：

```
https://neo-ceg.vercel.app/?file=https://example.com/path/to/graph.nceg
```

- The file URL must use **HTTPS** (HTTP is rejected for security).
- The file host must allow **CORS** (Cross-Origin Resource Sharing). GitHub Pages and most static file hosts support this.
- If the file cannot be fetched or contains syntax errors, an error message is shown and the app starts with an empty canvas.
- If no `?file=` parameter is present, the app starts normally with an empty canvas.

- ファイルURLは**HTTPS**である必要があります（セキュリティのためHTTPは拒否されます）。
- ファイルのホストが**CORS**（クロスオリジンリソース共有）を許可している必要があります。GitHub Pagesや多くの静的ファイルホストはこれに対応しています。
- ファイルの取得に失敗した場合や構文エラーがある場合、エラーメッセージが表示され、空のキャンバスで起動します。
- `?file=` パラメータがない場合、通常通り空のキャンバスで起動します。

### 11.2 Import / インポート

**File > Import CEG Definition** (or the **Import CEG Definition** button in the NeoCEG Language tab) opens a file dialog to select a `.nceg` file. If the canvas already has data, a confirmation dialog appears with the option to **Replace** the current graph.

**File > Import CEG Definition**（またはNeoCEG Languageタブの**Import CEG Definition**ボタン）でファイルダイアログが開き、`.nceg`ファイルを選択します。キャンバスに既存データがある場合、現在のグラフを**Replace（置換）**する確認ダイアログが表示されます。

If the file contains syntax errors, an error dialog shows the line number and error message. The import is cancelled and the current graph remains unchanged.

ファイルに構文エラーがある場合、行番号とエラーメッセージがダイアログに表示されます。インポートはキャンセルされ、現在のグラフは変更されません。

### 11.3 Paste CEG Definition / CEG定義の貼り付け

**File > Paste CEG Definition** (or the **Paste CEG Definition** button in the NeoCEG Language tab) reads DSL text from the clipboard and imports it as a graph.

**File > Paste CEG Definition**（またはNeoCEG Languageタブの**Paste CEG Definition**ボタン）でクリップボードからDSLテキストを読み取り、グラフとしてインポートします。

The process is: (1) parse the clipboard text, (2) if syntax errors exist, show an error dialog and cancel, (3) if the canvas has data, show a Replace confirmation dialog.

処理の順序：(1) クリップボードのテキストをパース、(2) 構文エラーがあればエラーダイアログを表示しキャンセル、(3) キャンバスにデータがあればReplace確認ダイアログを表示。

### 11.4 Save / Copy CEG Definition / CEG定義の保存・コピー

- **File > Save CEG Definition**: Downloads the current graph as a `.nceg` file (filename: `graph_YYYY-MM-DD.nceg`).
- **File > Copy CEG Definition**: Copies the DSL text to the clipboard.
- All four CEG Definition operations (Copy, Paste, Save, Import) are available as buttons in the **NeoCEG Language** tab.

### 11.5 Graph Image Export / グラフ画像エクスポート

| Format | Method / 方法 | Details / 詳細 |
|---|---|---|
| **SVG** | File > Download SVG / Copy SVG | Pure SVG elements (no foreignObject). Compatible with Inkscape, PowerPoint, and all standards-compliant SVG viewers. / 純粋SVG要素。Inkscape、PowerPoint等と互換。 |
| **PNG** | File > Download PNG / Copy PNG | 2x Retina resolution. Generated via SVG → Canvas → PNG pipeline. / 2倍Retina解像度。SVG→Canvas→PNGパイプラインで生成。 |

### 11.6 CSV Export / CSVエクスポート

| Type | Method / 方法 | Content / 内容 |
|---|---|---|
| Decision Table CSV | File > Download Decision CSV / Copy Decision CSV | Classification, Logical Statement, Observable status, and truth values per rule / 分類、論理言明、観測可能状態、ルール毎の真理値 |
| Coverage Table CSV | File > Download Coverage CSV / Copy Coverage CSV | Expression coverage data with coverage percentage / 論理式カバレッジデータとカバレッジ率 |

CSV files use UTF-8 encoding.

CSVファイルはUTF-8エンコーディング。

**Learning Mode Status Row**: When the decision table includes excluded conditions (Learning Mode), a Status row appears after the column number row. Each column shows: `Adopted`, `Infeasible`, `Redundant`, `Weak`, or `Untestable`. This row is omitted in Practice Mode where only adopted conditions are exported.

**学習モード Status 行**：デシジョンテーブルに除外された条件が含まれる場合（学習モード）、列番号行の次に Status 行が出力されます。各列に `Adopted`、`Infeasible`、`Redundant`、`Weak`、`Untestable` のいずれかが表示されます。採択された条件のみをエクスポートするプラクティスモードでは、この行は省略されます。

### 11.7 HTML Table Copy / HTMLテーブルコピー

You can copy decision tables and coverage tables as styled HTML to the clipboard. When pasted into Microsoft PowerPoint, Google Slides, Word, or other Office applications, the table retains its colors, borders, and formatting — unlike CSV which loses all layout.

デシジョンテーブルとカバレッジテーブルをスタイル付きHTMLとしてクリップボードにコピーできます。Microsoft PowerPoint、Google Slides、Wordなどのオフィスアプリケーションに貼り付けると、色・罫線・書式がそのまま保持されます。CSVではレイアウトが失われますが、HTMLコピーでは見た目を維持したまま貼り付けられます。

| Type | Method / 方法 |
|---|---|
| Decision Table HTML | `⎘ HTML` button on Decision/Compare tab header, or File > Copy Decision HTML / Decisionタブヘッダーの`⎘ HTML`ボタン、またはFile > Copy Decision HTML |
| Coverage Table HTML | `⎘ HTML` button on Coverage/Compare tab header, or File > Copy Coverage HTML / Coverageタブヘッダーの`⎘ HTML`ボタン、またはFile > Copy Coverage HTML |

The clipboard contains both `text/html` (for rich paste) and `text/plain` (CSV fallback). Applications that support HTML paste (PowerPoint, Word, Google Docs) will use the styled table; plain text editors will receive CSV.

クリップボードには`text/html`（リッチペースト用）と`text/plain`（CSVフォールバック）の両方が含まれます。HTMLペーストに対応するアプリ（PowerPoint、Word、Google Docs）はスタイル付き表を使用し、プレーンテキストエディタにはCSVが貼り付けられます。

**Learning Mode**: When the decision table includes excluded conditions, the HTML export visually distinguishes them — excluded columns appear with gray background, strikethrough text, and a Status row showing Adopted (green), Infeasible (red), Redundant (gray), Weak (orange), or Untestable (amber). This matches the UI strikethrough display.

**学習モード**：デシジョンテーブルに除外された条件が含まれる場合、HTMLエクスポートでも視覚的に区別されます。除外列はグレー背景・打消し線で表示され、Status 行に Adopted（緑）、Infeasible（赤）、Redundant（灰）、Weak（橙）、Untestable（琥珀）が表示されます。UIの打消し線表示と一致します。

### 11.8 File Menu Reference / Fileメニュー一覧

| Group / グループ | Menu Item / 項目 | Action / 動作 |
|---|---|---|
| Import | Import CEG Definition | Open `.nceg` file / `.nceg`ファイルを開く |
| ─ | | |
| Download | Save CEG Definition | Download `.nceg` file / `.nceg`ファイルをダウンロード |
| | Download SVG | Download graph as SVG / SVGでグラフをダウンロード |
| | Download PNG | Download graph as PNG (2x) / PNG(2倍)でグラフをダウンロード |
| | Download Decision CSV | Download decision table CSV / デシジョンテーブルCSVダウンロード |
| | Download Coverage CSV | Download coverage table CSV / カバレッジテーブルCSVダウンロード |
| ─ | | |
| Copy/Paste | Copy CEG Definition | Copy `.nceg` to clipboard / `.nceg`をクリップボードにコピー |
| | Paste CEG Definition | Import from clipboard (validates first) / クリップボードからインポート（事前バリデーション） |
| | Copy SVG | Copy SVG to clipboard / SVGをクリップボードにコピー |
| | Copy PNG | Copy PNG to clipboard / PNGをクリップボードにコピー |
| | Copy Decision CSV | Copy decision table CSV / デシジョンテーブルCSVコピー |
| | Copy Coverage CSV | Copy coverage table CSV / カバレッジテーブルCSVコピー |
| | Copy Decision HTML | Copy decision table as styled HTML (for Office paste) / デシジョンテーブルをスタイル付きHTMLでコピー（Office貼り付け用） |
| | Copy Coverage HTML | Copy coverage table as styled HTML (for Office paste) / カバレッジテーブルをスタイル付きHTMLでコピー（Office貼り付け用） |
| ─ | | |
| Danger | Clear All | Remove all nodes, edges, and constraints / 全ノード・エッジ・制約を削除 |

---

## 12. Keyboard Shortcuts / キーボードショートカット

| Shortcut / ショートカット | Action / 動作 |
|---|---|
| Ctrl+Z (Cmd+Z) | Undo (up to 50 states) / 元に戻す（最大50状態） |
| Ctrl+Y / Ctrl+Shift+Z | Redo / やり直し |
| Delete / Backspace | Delete selected nodes and edges / 選択したノードとエッジを削除 |
| Escape | Cancel inline editing / インライン編集をキャンセル |
| Enter | Confirm inline editing / インライン編集を確定 |
| Shift+Enter | Insert newline in label editing / ラベル編集で改行を挿入 |

**Mouse operations / マウス操作**:

| Action / 操作 | Method / 方法 |
|---|---|
| Pan / パン | Drag on empty canvas / 空のキャンバスをドラッグ |
| Zoom / ズーム | Mouse wheel / マウスホイール |
| Multi-select / 複数選択 | Shift+Click or drag selection rectangle / Shift+クリックまたは矩形ドラッグ |

---

## 13. FAQ / よくある質問

**Q: Decision table shows "No feasible rules" — is this a bug?**
**Q: デシジョンテーブルに「No feasible rules」と表示されました。バグですか？**

This usually means that your constraints are contradicting each other. For example, applying both ONE and REQ to overlapping nodes can make all combinations infeasible. Try reviewing your constraint definitions for unintended conflicts.

制約同士が矛盾している可能性があります。たとえば、重複するノードに ONE と REQ を両方適用すると、すべての組み合わせが実行不能になることがあります。制約の定義に意図しない矛盾がないか確認してみてください。

**Q: My node won't turn purple (effect). What am I doing wrong?**
**Q: ノードが紫色（結果）になりません。何が間違っていますか？**

A node is recognized as an effect only when it has no outgoing logical edges. If the node still has outgoing edges, it is treated as an intermediate node. Check whether an unintended edge is connected from that node.

ノードは出力論理エッジがない場合にのみ結果ノードとして認識されます。出力エッジが残っていると中間ノードとして扱われます。意図しないエッジが接続されていないか確認してみてください。

**Q: The AND/OR badge doesn't appear on my node.**
**Q: ノードに AND/OR バッジが表示されません。**

The badge appears when a node has incoming logical edges. If the node has no incoming edges, it is a cause node and does not display a logic badge. You may have forgotten to connect an edge to that node.

バッジはノードに入力論理エッジがある場合に表示されます。入力エッジがなければ原因ノードであり、ロジックバッジは表示されません。エッジの接続を忘れていないか確認してみてください。

**Q: Learning Mode automatically switched to Practice Mode. Why?**
**Q: Learning Mode が自動的に Practice Mode に切り替わりました。なぜですか？**

Learning Mode displays the full exhaustive decision table, which grows exponentially with the number of causes. When causes exceed 8 (more than 256 combinations), NeoCEG automatically switches to Practice Mode to maintain performance. This is expected behavior — consider whether some causes can be consolidated, or continue working in Practice Mode.

Learning Mode は完全な組み合わせデシジョンテーブルを表示するため、原因数に対して指数的に増大します。原因が8個を超える（256組み合わせ超）と、パフォーマンス維持のため自動的に Practice Mode に切り替わります。これは想定通りの動作です。原因を統合できないか検討するか、そのまま Practice Mode でお使いください。

**Q: A "NOT was removed" alert appeared after I changed a constraint. Did I lose something?**
**Q: 制約を変更したら「NOT was removed」というアラートが出ました。何か失われましたか？**

This happens when editing a constraint would create an invalid combination — for example, NOT on both sides of a REQ, or NOT on a MASK target. NeoCEG automatically removes the NOT to keep the model valid and notifies you. If this wasn't what you intended, press Ctrl+Z (Cmd+Z on Mac) to undo.

制約の編集により無効な組み合わせが生じる場合に発生します。たとえば REQ の両側に NOT がつく場合や、MASK ターゲットに NOT がつく場合です。NeoCEG はモデルの整合性を保つために自動的に NOT を除去し、通知します。意図した操作でなければ、Ctrl+Z（Mac は Cmd+Z）で元に戻せます。

**Q: Coverage shows 0%. Is the calculation broken?**
**Q: カバレッジが 0% と表示されます。計算がおかしいのでは？**

Coverage is calculated based on effect nodes. If your graph has no effect nodes (i.e., every node has at least one outgoing logical edge), there is nothing to measure coverage against. Check whether your intended effect nodes have unintended outgoing edges.

カバレッジは結果ノードを基に計算されます。グラフに結果ノードがない場合（すべてのノードに出力論理エッジがある場合）、カバレッジの計算対象がありません。意図した結果ノードに不要な出力エッジがついていないか確認してみてください。

**Q: I get an import error with a line number. What should I look for?**
**Q: 行番号付きのインポートエラーが出ます。何を確認すればよいですか？**

The error message indicates where the parser encountered a problem in the `.nceg` file. Common mistakes include missing quotation marks around labels, typos in keywords (AND, OR, NOT, etc.), or incorrect constraint syntax. Check the indicated line and its surroundings.

エラーメッセージは `.nceg` ファイル内でパーサーが問題を検出した箇所を示しています。よくある間違いは、ラベルの引用符の付け忘れ、キーワード（AND, OR, NOT など）の綴り間違い、制約構文の誤りなどです。指定された行とその前後を確認してみてください。

**Q: A page leave warning appeared. Is my work saved?**
**Q: ページ離脱の警告が出ました。作業は保存されていますか？**

This warning appears when you have unsaved changes. Your work is still in the browser, but has not been saved to a file. Use File > Save CEG Definition to save before leaving, or dismiss the warning if you don't need the changes.

この警告は未保存の変更がある場合に表示されます。作業はブラウザ上にまだ残っていますが、ファイルには保存されていません。離脱前に File > Save CEG Definition で保存するか、変更が不要であれば警告を閉じてください。

---

## 14. Glossary / 用語集

| English Term | 日本語 | Definition / 定義 |
|---|---|---|
| Cause | 原因 | Input node with no incoming logical edges (in-degree = 0) / 入力論理エッジのないノード |
| Effect | 結果 | Output node with no outgoing logical edges (out-degree = 0) / 出力論理エッジのないノード |
| Intermediate | 中間 | Node with both incoming and outgoing logical edges / 入力・出力論理エッジの両方を持つノード |
| Logical Statement | 論理言明 | The label text of a CEG node describing a testable condition / テスト可能な条件を記述するCEGノードのラベル |
| Rule | ルール | A column in the decision table representing one test condition / デシジョンテーブルの1列（1テスト条件） |
| Expression | 論理式 | A logical edge (subexpression) to be covered in the coverage table / カバレッジテーブルでカバーすべき論理エッジ（部分式） |
| Constraint | 制約 | A rule restricting valid truth-value combinations among causes / 原因間の有効な真理値組合せを制限するルール |
| Observable | 観測可能 | A node whose output value can be directly tested or measured / 出力値を直接テスト・計測可能なノード |
| Masked (M) | マスク | A Don't Care value caused by a MASK constraint trigger being true / MASKトリガーが真のときのDon't Care値 |
| Indeterminate (I) | 不定 | A value that cannot be determined due to M propagating through logic / Mが論理式を伝播して確定不能な値 |
| Feasible | 実行可能 | A rule that satisfies all constraints / すべての制約を満たすルール |
| Infeasible | 実行不能 | A rule that violates at least one constraint / 少なくとも1つの制約に違反するルール |
| Weak | 弱い | A rule that does not uniquely cover any expression / どの論理式も一意にカバーしないルール |
| Untestable | テスト不能 | An expression whose result is Indeterminate due to MASK propagation / MASK伝播により結果が不定になる論理式 |

---

## Appendix A: References / 参考文献

- Myers, G.J., Badgett, T., Sandler, C. "The Art of Software Testing", 3rd Edition, Chapter 4
- ISO/IEC/IEEE 29119-4:2021 "Software and systems engineering — Software testing — Part 4: Test techniques"
- [DSL Grammar Specification](./DSL_Grammar_Specification.md) — Formal EBNF grammar for `.nceg` files
- [GUI Specification](./GUI_Specification.md) — Complete GUI operations specification
- [Algorithm Design](./Algorithm_Design.md) — CEG algorithm implementation details

---

## Document History / 変更履歴

| Date / 日付 | Change / 変更 |
|---|---|
| 2026-03-01 | Initial version / 初版作成 |

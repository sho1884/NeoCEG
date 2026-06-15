# GUI Specification / GUI仕様書

This document defines all GUI operations in NeoCEG.
本ドキュメントはNeoCEGのすべてのGUI操作を定義する。

---

## 1. Canvas Operations / キャンバス操作

| Operation / 操作 | Trigger / トリガー | Behavior / 動作 |
|---|---|---|
| Create node / ノード作成 | Double-click on canvas / キャンバスをダブルクリック | Create new node at click position with a sequential placeholder name "Logical Statement 1", "Logical Statement 2", … (a prompt to name the concept). Counter resets on Clear All. / クリック位置に連番のプレースホルダ名「Logical Statement 1」「Logical Statement 2」…で新規ノード作成（概念命名を促す）。全クリア時にカウンターリセット。 |
| Pan / パン | Drag on canvas / キャンバスをドラッグ | Scroll the canvas / キャンバスをスクロール |
| Zoom / ズーム | Mouse wheel / マウスホイール | Zoom in/out / 拡大縮小 |
| Select / 選択 | Click on node or edge / ノードまたはエッジをクリック | Select the element / 要素を選択 |
| Multi-select / 複数選択 | Shift+Click or drag rectangle / Shift+クリック または 矩形ドラッグ | Add to selection / 選択に追加 |
| Deselect all / 全選択解除 | Click on canvas / キャンバスをクリック | Clear selection / 選択を解除 |

---

## 2. Node Operations / ノード操作

### 2.1 CEG Node / CEGノード

| Operation / 操作 | Trigger / トリガー | Behavior / 動作 |
|---|---|---|
| Edit label / ラベル編集 | Double-click on node / ノードをダブルクリック | Start inline editing / インライン編集を開始 |
| Save edit / 編集確定 | Enter | Save label text / ラベルテキストを保存 |
| Cancel edit / 編集キャンセル | Escape | Revert to original text / 元のテキストに戻す |
| Newline / 改行 | Shift+Enter | Insert newline in label / ラベル内に改行を挿入 |
| Toggle AND/OR / AND/OR切替 | Click AND/OR badge / AND/ORバッジをクリック | Toggle between AND and OR / ANDとORを切替 |
| Move / 移動 | Drag node / ノードをドラッグ | Move to new position / 新しい位置に移動 |
| Resize / サイズ変更 | Drag node border (when selected) / 選択時にノード枠をドラッグ | Resize node width (80-400px) / ノード幅を変更（80〜400px） |
| Delete / 削除 | Delete key / Deleteキー | Delete selected node(s) and cascade constraints / 選択ノードを削除、制約を連鎖削除 |

**CEG Node Right-click Menu / CEGノード右クリックメニュー:**

| Menu Item / メニュー項目 | Condition / 条件 | Behavior / 動作 |
|---|---|---|
| Set label to expression / ラベルを論理式に設定 | Node has incoming edges / 入力エッジがある場合 | Set label to the logical expression of inputs — the **last-resort** naming (Pragmatics §P4); prefer a concept name / 入力の論理式をラベルに設定 — **最後の手段**の命名（語用論 §P4）。概念名を優先 |
| Delete Node / ノード削除 | Always / 常時 | Delete node / ノードを削除 |

### 2.2 Node Properties / ノードプロパティ

| Property / プロパティ | Value / 値 |
|---|---|
| Default width / デフォルト幅 | 150px |
| Min/Max width / 最小・最大幅 | 80px - 400px |
| Default operator / デフォルト演算子 | AND (auto-assigned on first incoming edge / 最初の入力エッジで自動設定) |

### 2.3 Node Role / ノードロール

Role is derived from graph structure (not set manually).
ロールはグラフ構造から導出する（手動設定ではない）。

| Role / ロール | Condition / 条件 | Color / 色 |
|---|---|---|
| Cause / 原因 | No incoming logical edges / 入力論理エッジなし | Blue / 青 (fill `#e3f2fd`, border `#1976d2`) |
| Intermediate / 中間 | Both incoming and outgoing / 入力・出力ともあり | Indigo / 藍 (fill `#e8eaf6`, border `#3949ab`) |
| Effect / 結果 | No outgoing logical edges / 出力論理エッジなし | Purple / 紫 (fill `#f3e5f5`, border `#7b1fa2`) |

### 2.4 Node display name & tooltip / ノードの表示名とツールチップ

A node's displayed text is its **logical statement (proposition)** — never its logical expression
(`Requirements_Specification.md` §3.1; `DSL_Grammar_Specification.md` Pragmatics §P1–P4).

| Situation / 状況 | Displayed name / 表示名 |
|---|---|
| Has a label / ラベルあり | the label / ラベル |
| No label, meaningful identifier / ラベル無し・意味ある識別子 | the identifier / 識別子 |
| Only a placeholder name (e.g. "Logical Statement 3") or empty / プレースホルダ名のみ・空 | a **prompt to name the concept** (the placeholder invites naming) / **命名を促す表示**（プレースホルダが命名を促す） |

- **The logical expression is shown in a tooltip on hover** (effect / intermediate nodes), as a hint for
  naming the concept — it is **not** the displayed name. / 論理式は**ホバー時のツールチップ**で表示（効果・
  中間ノード）。概念命名の手がかりであり、表示名にはしない。
- **Auto-generating the name from the expression is removed.** An expression-derived name goes stale when the
  graph is edited and the expression changes; instead the user is prompted to name the concept (with the
  expression visible as a tooltip hint). / **式から名前を自動生成する挙動は廃止**。式由来の名前はグラフ編集で
  式が変わると陳腐化するため、代わりに（式をツールチップで見せつつ）概念の命名を促す。

---

## 3. Edge Operations / エッジ操作

### 3.1 Logical Edge / 論理エッジ

| Operation / 操作 | Trigger / トリガー | Behavior / 動作 |
|---|---|---|
| Create / 作成 | Drag from source handle to target handle / ソースハンドルからターゲットハンドルへドラッグ | Create logical edge; auto-assign AND to target if first input / 論理エッジ作成、ターゲットに初入力ならANDを自動設定 |
| Toggle NOT / NOT切替 | Click on edge / エッジをクリック | Toggle negation / 否定を切替 |
| Delete / 削除 | Select + Delete key / 選択してDeleteキー | Delete the edge / エッジを削除 |

**Logical Edge Right-click Menu / 論理エッジ右クリックメニュー:**

| Menu Item / メニュー項目 | Behavior / 動作 |
|---|---|
| Add NOT / Remove NOT | Toggle negation / 否定を切替 |
| Delete Edge / エッジ削除 | Delete the edge / エッジを削除 |

### 3.2 Constraint Edge / 制約エッジ

| Operation / 操作 | Trigger / トリガー | Behavior / 動作 |
|---|---|---|
| Create / 作成 | Drag from constraint node handle to CEG node / 制約ノードハンドルからCEGノードへドラッグ | Add member to constraint / メンバーを制約に追加 |
| Toggle NOT / NOT切替 | Click on target edge / ターゲットエッジをクリック | Toggle negation on target member / ターゲットメンバーの否定を切替 |

**First connection rule for REQ/MASK / REQ/MASKの最初の接続ルール:**

When dragging the first edge to an empty REQ/MASK constraint node, the connected CEG node
automatically becomes the source/trigger. Subsequent connections become targets.
空のREQ/MASK制約ノードに最初のエッジをドラッグすると、接続されたCEGノードが自動的にソース/トリガーになる。以降の接続はターゲットになる。

**Constraint Edge Right-click Menu / 制約エッジ右クリックメニュー:**

| Menu Item / メニュー項目 | Condition / 条件 | Behavior / 動作 |
|---|---|---|
| Add NOT / Remove NOT | REQ: source or target (not both simultaneously). MASK: trigger only. Symmetric: any edge. / REQ: ソースまたはターゲット（両方同時は不可）。MASK: トリガーのみ。対称: 全エッジ | Toggle negation / 否定を切替 |
| Set as Source / ソースに設定 | REQ edge, this edge is NOT the current source / REQエッジ、このエッジが現在のソースでない | Promote this member to source. If both sides would have NOT, target NOT is cleared. / このメンバーをソースに昇格。両側NOTになる場合はターゲットNOTをクリア。 |
| Set as Trigger / トリガーに設定 | MASK edge, this edge is NOT the current trigger / MASKエッジ、このエッジが現在のトリガーでない | Promote this member to trigger. If the demoted trigger had NOT, it is removed. / このメンバーをトリガーに昇格。降格トリガーにNOTがあった場合は削除。 |
| Delete Edge / エッジ削除 | All types / 全タイプ | Remove member from constraint / メンバーを制約から削除 |

> **Note on REQ NOT**: NOT is allowed on **source or target side, but not both simultaneously**.
> `REQ(NOT A -> NOT B)` is prohibited because the meaning becomes ambiguous.
> If a source promotion would create both-sides-NOT, the target NOT is automatically cleared.
>
> **REQのNOT注記**: NOTは**ソース側またはターゲット側のいずれかに適用可能。両方同時は禁止**。
> `REQ(NOT A -> NOT B)` は意味が曖昧になるため禁止。ソース昇格で両側NOTになる場合、ターゲットNOTは自動クリア。
>
> **Note on MASK NOT**: NOT is allowed on the **trigger side only**. NOT is **prohibited on target side**.
>
> **MASKのNOT注記**: NOTは**トリガー側のみ**許可。**ターゲット側のNOTは禁止**。
>
> **REQ vs MASK asymmetry / REQとMASKの非対称性**:
> REQ sets T/F values on targets — NOT reverses this (T→F), so target NOT is meaningful.
> MASK sets M (Don't Care) on targets — NOT M = M, so target NOT produces the same result and is meaningless.
> REQはターゲットにT/Fを設定 — NOTで反転（T→F）するため、ターゲットNOTは意味がある。
> MASKはターゲットにM（Don't Care）を設定 — NOT M = Mのため、ターゲットNOTは同じ結果になり無意味。
> - `REQ(A -> B)`: A=T → B=**T** / `REQ(A -> NOT B)`: A=T → B=**F** (different / 異なる)
> - `MASK(A -> B)`: A=T → B=**M** / `MASK(A -> NOT B)`: A=T → B=**M** (same / 同じ)

---

## 4. Constraint Operations / 制約操作

### 4.1 Constraint Types / 制約タイプ

| Type | Label | Direction / 方向 | Node Shape / ノード形状 | Color / 色 |
|---|---|---|---|---|
| ONE | One | Symmetric / 対称 | Circle / 円形 | Purple (#9c27b0) / 紫 |
| EXCL | Excl | Symmetric / 対称 | Circle / 円形 | Red (#f44336) / 赤 |
| INCL | Incl | Symmetric / 対称 | Circle / 円形 | Green (#4caf50) / 緑 |
| REQ | Req | Directional / 方向性あり | Rectangle / 矩形 | Blue (#2196f3) / 青 |
| MASK | Mask | Directional / 方向性あり | Rectangle / 矩形 | Gray (#607d8b) / 灰 |

### 4.2 Toolbar Constraint Buttons / ツールバー制約ボタン

Constraint buttons are **always enabled**.
制約ボタンは**常に有効**。

| Selection State / 選択状態 | Button Click / ボタンクリック | Behavior / 動作 |
|---|---|---|
| CEG nodes selected / CEGノード選択中 | Any constraint button / 任意の制約ボタン | Create constraint node with edges to selected nodes / 選択ノードにエッジ接続した制約ノードを作成 |
| Constraint node selected / 制約ノード選択中 | Any constraint button / 任意の制約ボタン | Change constraint type / 制約タイプを変更 |
| Nothing selected / 何も選択なし | Any constraint button / 任意の制約ボタン | Create unconnected constraint node at viewport center / ビューポート中央に未接続の制約ノードを作成 |

### 4.3 Constraint Node Right-click Menu / 制約ノード右クリックメニュー

| Menu Item / メニュー項目 | Condition / 条件 | Behavior / 動作 |
|---|---|---|
| Type > One | Always / 常時 | Change to ONE / ONEに変更 |
| Type > Excl | Always / 常時 | Change to EXCL / EXCLに変更 |
| Type > Incl | Always / 常時 | Change to INCL / INCLに変更 |
| Type > Req | Always / 常時 | Change to REQ / REQに変更 |
| Type > Mask | Always / 常時 | Change to MASK / MASKに変更 |
| Delete Constraint / 制約削除 | Always / 常時 | Delete constraint node and all edges / 制約ノードと全エッジを削除 |

> **Note**: "Reverse Direction" is NOT provided on the constraint node menu.
> Direction changes for REQ/MASK are done exclusively via the per-edge "Set as Source/Trigger" menu (see §3.2).
> This avoids ambiguity — on a node-level menu, the user cannot tell which target would be swapped.
>
> **注記**: 「方向を反転」は制約ノードメニューには設けない。
> REQ/MASKの方向変更は、エッジ右クリックの「ソース/トリガーに設定」メニューでのみ行う（§3.2参照）。
> ノードレベルのメニューでは、どのターゲットと入れ替えるか曖昧になるため。

### 4.4 Direction Change for REQ/MASK / REQ/MASKの方向変更

REQ and MASK are directional constraints with one source/trigger and one or more targets.
REQとMASKは方向性のある制約で、1つのソース/トリガーと1つ以上のターゲットを持つ。

Direction is changed via the constraint edge right-click menu only:
方向の変更は制約エッジ右クリックメニューでのみ行う：

- **Right-click constraint edge > Set as Source/Trigger**: Promotes the clicked edge's target node to source/trigger role. The current source/trigger is demoted to a regular target.
  制約エッジ右クリック > ソース/トリガーに設定：クリックしたエッジのターゲットノードをソース/トリガーに昇格。現在のソース/トリガーは通常のターゲットに降格。

This menu item only appears on edges that are NOT already the source/trigger (see §3.2 conditions).
このメニュー項目はソース/トリガーでないエッジにのみ表示される（§3.2の条件参照）。

**Rationale / 理由**: A node-level "Reverse Direction" menu was considered but rejected because when a constraint has multiple targets (1:N), the user cannot visually identify which target is "first." Per-edge operation is unambiguous — the user right-clicks the specific edge they want to promote.
ノードレベルの「方向を反転」メニューは検討したが不採用とした。制約が複数ターゲット（1:N）を持つ場合、どのターゲットが「最初」かユーザーが視覚的に判別できないため。エッジ単位の操作なら、ユーザーは昇格したい特定のエッジを右クリックするため曖昧さがない。

### 4.5 Constraint Type Change / 制約タイプ変更

Constraint type can be changed in two ways:
制約タイプの変更は2つの方法で行える：

1. **Right-click constraint node > Type submenu**: Select new type from list.
   制約ノード右クリック > Typeサブメニュー：リストから新しいタイプを選択。

2. **Select constraint node + click toolbar button**: Changes to the clicked type.
   制約ノードを選択してツールバーボタンをクリック：クリックしたタイプに変更。

**Type change rules / タイプ変更ルール:**

| From / 変更元 | To / 変更先 | Rule / ルール |
|---|---|---|
| Symmetric → Symmetric | ONE/EXCL/INCL ↔ ONE/EXCL/INCL | Keep all members / 全メンバー維持 |
| Symmetric → Directional | ONE/EXCL/INCL → REQ/MASK | First member becomes source/trigger, rest become targets / 最初のメンバーがソース/トリガー、残りがターゲット |
| Directional → Symmetric | REQ/MASK → ONE/EXCL/INCL | Source/trigger and targets become equal members / ソース/トリガーとターゲットが均等メンバーに |
| Directional → Directional | REQ ↔ MASK | Keep source/trigger and targets as-is / ソース/トリガーとターゲットを維持 |

### 4.6 Constraint Validation at Export / エクスポート時の制約検証

At export time, constraints with fewer than 2 connected nodes are flagged.
エクスポート時に、接続ノード数2未満の制約を検出する。

| Connected Nodes / 接続ノード数 | Treatment / 処理 |
|---|---|
| 0 or 1 | Show dialog: "Remove meaningless constraints?" / 「意味のない制約を削除しますか？」ダイアログを表示 |
| 2+ | Valid, include in export / 有効、エクスポートに含める |

---

## 5. Toolbar / ツールバー

Layout (left to right):
レイアウト（左から右）：

```
[NeoCEG] | [File ▾] | [↶ ↷] | [One] [Excl] [Incl] [Req] [Mask] | [N nodes selected] [?]
```

| Section / セクション | Elements / 要素 |
|---|---|
| Logo / ロゴ | "NeoCEG" |
| File / ファイル | Dropdown: Import CEG Definition, [divider], Save CEG Definition, Download SVG, Download PNG, Download Decision CSV, Download Coverage CSV, Download Skeleton, [divider], Copy CEG Definition, Paste CEG Definition, Copy SVG, Copy PNG, Copy Decision Table, Copy Coverage Table, Copy Skeleton, [divider], Clear All |

> **Copy Decision Table / Copy Coverage Table — dual-format clipboard / 2形式同時コピー.** A single "Copy" writes **both** `text/html` (styled table) and `text/plain` (CSV) to the clipboard in one `ClipboardItem`. Pasting into Excel / Google Sheets / Word / PowerPoint yields the rendered table; pasting into a plain-text editor yields CSV. When the browser lacks `ClipboardItem`/`clipboard.write`, it falls back to writing the CSV as plain text. This matches the sister project **NeoCombi** (one Copy per table, not separate CSV/HTML actions). / 「Copy」一つで `text/html`（スタイル付き表）と `text/plain`（CSV）を同一 `ClipboardItem` に同時書き込み。Excel/スプレッドシート/Word/PowerPoint へ貼ると表、テキストエディタへ貼ると CSV。`ClipboardItem`/`clipboard.write` が無い環境では CSV のプレーンテキスト書き込みに降格。姉妹プロジェクト **NeoCombi**（表ごとに単一 Copy、CSV/HTML を分けない）と一致させる。
> **Copy Skeleton** is plain text only (the skeleton is code, not a table). / Copy Skeleton はプレーンテキストのみ（スケルトンは表でなくコード）。
| Undo/Redo | Undo (Ctrl+Z), Redo (Ctrl+Y / Ctrl+Shift+Z) |
| Constraints / 制約 | One, Excl, Incl, Req, Mask (always enabled / 常に有効) |
| Status / ステータス | Selection count, Help tooltip |

> **Help (?) popup.** Lists keyboard tips and a Documentation link, plus **Copy DSL Grammar** and **Download DSL Grammar** with the embedded grammar version shown (e.g. "DSL Grammar v1.5"). See §9.2. / Help（?）ポップアップ：キーボード操作のヒントと Documentation リンクに加え、**Copy DSL Grammar** と **Download DSL Grammar** を置き、埋め込み文法の版（例「DSL Grammar v1.5」）を表示する。§9.2 参照。

---

## 6. Keyboard Shortcuts / キーボードショートカット

| Shortcut / ショートカット | Action / 動作 |
|---|---|
| Ctrl+Z / Cmd+Z | Undo (up to 50 states) / 元に戻す（最大50状態） |
| Ctrl+Y / Ctrl+Shift+Z | Redo / やり直す |
| Delete / Backspace | Delete selected nodes and edges / 選択ノードとエッジを削除 |
| Escape | Cancel inline editing / インライン編集をキャンセル |
| Enter | Confirm inline editing / インライン編集を確定 |
| Shift+Enter | Newline in inline editing / インライン編集で改行 |

---

## 7. Decision Table Panel / デシジョンテーブルパネル

The Decision Table Panel displays the generated test data.
デシジョンテーブルパネルは生成されたテストデータを表示する。

### 7.1 Column Terminology / 列の用語

Decision table columns are labeled "rules" (ルール), following standard decision table terminology.
デシジョンテーブルの列は、標準的なデシジョンテーブルの用語に従い「ルール」（rules）と呼ぶ。

| Context / コンテキスト | Label / ラベル |
|---|---|
| Practice mode status / プラクティスモードステータス | "N rules" / "N ルール" |
| Practice mode tooltip / プラクティスモードツールチップ | "Show only feasible rules" / "実行可能なルールのみ表示" |
| No data message / データなしメッセージ | "No feasible rules" / "No rules" |

Note: Internal algorithm code continues to use "test condition" as the technical term.
注：アルゴリズム内部コードでは技術用語として "test condition" を引き続き使用する。

### 7.2 Row Ordering / 行の並び順

Within each section (Causes, Intermediate, Effects), rows are sorted by the Y coordinate
of the corresponding node on the graph canvas (ascending: top → bottom).
各セクション（原因、中間、結果）内の行は、グラフキャンバス上のノードのY座標の昇順でソートする。

- Sorting is **display-layer only** — it does not affect expression numbering, proposition
  names (p1, p2, ...), or DSL export order. This ensures stable identifiers during
  iterative review and repositioning.
  ソートは**表示層のみ**で行う — 論理式番号、命題名（p1, p2, ...）、DSLエクスポート順には影響しない。
  反復レビューやノード再配置時に識別子が安定する。
- Nodes without position data retain their model insertion order.
  座標データのないノードはモデルの挿入順を維持する。

### 7.3 Section Header Colors / セクションヘッダーの色

Section separator rows use distinct background colors to group node roles.
セクション区切り行は、ノードロールをグループ化するために異なる背景色を使用する。

Section header background = node border color (dark), text = white.
Row label background = node fill color (light).
セクションヘッダー背景 = ノード枠色（濃）、文字 = 白。
行ラベル背景 = ノード塗りつぶし色（薄）。

| Section / セクション | Header bg / ヘッダー背景 | Row label bg / 行ラベル背景 | Text / 文字色 |
|---|---|---|---|
| Causes / 原因 | `#1976d2` (Blue 700) | `#e3f2fd` (Blue 50) | white |
| Intermediate / 中間 | `#3949ab` (Indigo 600) | `#e8eaf6` (Indigo 50) | white |
| Effects / 結果 | `#7b1fa2` (Purple 700) | `#f3e5f5` (Purple 50) | white |
| Coverage / カバレッジ | `#7b1fa2` (Purple 700) | (per-row status color) | white |

Design principle: Node role colors use a blue→purple gradient to avoid conflict with
truth value colors (green=T, red=F, yellow=I, gray=M) which follow traffic-light conventions.
設計原則：ノードロール色は青→紫のグラデーションとし、信号機の慣習に従った
真理値の色（緑=T、赤=F、黄=I、灰=M）との衝突を回避する。

### 7.4 Validity warnings (model health) / 妥当性の警告（モデル健全性）

Warnings appear in an **always-visible banner** at the top of the panel — the **same area** as the
learning-mode auto-switch notice ([DecisionTablePanel] warning area, rendered **outside** the tab switch
**and** the expand/collapse block), so it is **independent of the active tab and of collapse state**. Unlike
the learning-mode notice (which auto-clears after ~5s), validity warnings are **persistent** while the
condition holds.
警告はパネル上部の**常時表示バナー**（学習モード自動切替通知と同じ場所。タブ切替の外・開閉ブロックの外に
描画）に出す。**アクティブなタブにも開閉状態にも依存しない**ので、該当タブを見ていなくても気づける。

| # | Trigger / 条件 | Message intent / 文面の趣旨 |
|---|---|---|
| **A1** | The skeleton was checked and **differs from the CEG** on at least one feasible input (skeleton exporter status `unverified`). / 照合の結果、少なくとも1つの実行可能入力で **CEG と差異**（status `unverified`）。 | "ℹ The generated skeleton doesn't exactly match the graph — a difference was found in at least one case. Use it as a rough reference only." / 「ℹ 生成されたスケルトンはグラフと完全には一致しません（少なくとも1ケースで差異が見つかりました）。参考程度の目安としてのみご利用ください。」 |
| **A2** | Too many causes to verify exhaustively, so equivalence is **unconfirmed** (skeleton exporter status `unchecked`). / 原因が多く全数照合できず、一致は**未確認**（status `unchecked`）。 | "ℹ The generated skeleton couldn't be fully checked against the graph (too many inputs to verify exhaustively), so its exact equivalence is unconfirmed. Use it as a guide." / 「ℹ 入力が多く全数照合できなかったため、生成されたスケルトンがグラフと厳密に一致するかは未確認です。目安としてご利用ください。」 |
| **B** | A feasible decision-table column fires **two or more effects simultaneously**. / 実行可能な列が**複数の効果を同時に**立てる。 | "ℹ Some test cases produce more than one effect at once. That's fine if intended; otherwise, some constraint definitions may be missing." / 「ℹ 一部のテストケースで複数の効果が同時に成立します。意図的なら問題ありません。そうでなければ制約定義が不足しているかもしれません。」 |
| **C** | A constraint references a **derived (intermediate/effect) node**, not a cause. / 制約が**派生（中間/結果）ノード**を参照している（原因ではない）。 | "ℹ A constraint refers to a derived (intermediate/effect) node, which has no effect — constraints apply to cause nodes only." / 「ℹ 制約が派生（中間/結果）ノードを参照しています。制約は原因ノードにのみ効くため、これは無効です。」 |
| **D** | An effect is **never true in any feasible test** (unreachable / dead effect). / どの実行可能テストでも**真にならない効果**（到達不能・死んだ効果）。 | "ℹ Some effects can never occur in any feasible test (unreachable). This usually means an over-constraint or contradictory factors." / 「ℹ 一部の効果はどの実行可能テストでも成立しません（到達不能）。過剰な制約か因子の矛盾が原因のことが多いです。」 |

- All are **advisory** (amber); they never block editing or export. / いずれも**助言的**（amber）で、編集・出力を妨げない。
- A1/A2 are mutually exclusive (skeleton fidelity); an A warning and B may show together. All are derived reactively from the current model / decision table. / A1・A2 は排他（スケルトン忠実性）。A 系と B は同時表示可。現在のモデル／デシジョンテーブルからリアクティブに導出。
- B is a **heuristic** (some graphs legitimately have co-occurring effects), so it is phrased as a caution, not an error. / B は**ヒューリスティック**（同時成立が正当なグラフもある）ため、エラーでなく注意として表現。
- C and D are **exact** (not heuristic): C is a structural fact (a constraint member that has an expression), D is computed from the decision table (an effect true in no feasible column). Both are advisory and never block editing/export; C/D may co-occur with A/B. / C・D は**厳密**（ヒューリスティックでない）：C は構造的事実（式を持つ制約メンバー）、D はデシジョンテーブルから算出（どの実行可能列でも真でない効果）。いずれも助言的で編集・出力を妨げず、A/B と同時表示可。
- Rationale: without constraints the premise breaks — the decision table degenerates (columns merge, one case fires several effects) and the skeleton cannot be uniquely realized. A general user must be told, not left to misread degenerate output as correct. / 根拠: 制約が無いと前提が崩れ、デシジョンテーブルが退化（列がマージ・1ケースで複数効果）し、スケルトンが一意に実現できない。一般ユーザに知らせず誤認させてはならない。

---

## 8. Page Leave Warning / ページ離脱警告

When the graph has unsaved changes (undo history exists), navigating away from the page
triggers the browser's standard confirmation dialog.
グラフに未保存の変更がある（Undo履歴が存在する）状態でページを離れようとすると、
ブラウザの標準確認ダイアログを表示する。

| Condition / 条件 | Behavior / 動作 |
|---|---|
| Graph modified (canUndo=true) / グラフ変更あり | Show browser leave confirmation / ブラウザの離脱確認を表示 |
| No changes or after Clear All / 変更なし、または全クリア後 | No warning / 警告なし |

---

## 9. NeoCEG Language Tab / NeoCEG言語タブ

The bottom panel includes a "NeoCEG Language {.nceg}" tab alongside Decision, Coverage, and Compare tabs.
下部パネルに、Decision、Coverage、Compareタブと並んで「NeoCEG Language {.nceg}」タブを設ける。

| Element / 要素 | Description / 説明 |
|---|---|
| DSL text area / DSLテキストエリア | Read-only textarea showing the current graph as DSL text, updated reactively / 現在のグラフをDSLテキストとして表示する読み取り専用テキストエリア、リアクティブに更新 |
| Copy CEG Definition / CEG定義コピー | Copy CEG definition to clipboard (also available in File menu) / CEG定義をクリップボードにコピー（Fileメニューからもアクセス可能） |
| Paste CEG Definition / CEG定義貼り付け | Parse clipboard text and import as graph (validates before replacing) / クリップボードのテキストをパースしグラフとしてインポート（置換前にバリデーション） |
| Save CEG Definition / CEG定義保存 | Save CEG definition as .nceg file (also available in File menu) / CEG定義を.ncegファイルとして保存（Fileメニューからもアクセス可能） |
| Import CEG Definition / CEG定義インポート | Open .nceg file to import (also available in File menu) / .ncegファイルを開いてインポート（Fileメニューからもアクセス可能） |
| Copy DSL Grammar / DSL文法コピー | Copy the embedded DSL grammar (the EBNF block) to the clipboard — for handing to an AI assistant. Also in the Help (?) popup. See §9.2. / 埋め込みの DSL 文法（EBNF ブロック）をクリップボードへコピー（AI に渡す用途）。Help（?）にもある。§9.2 参照。 |
| Download DSL Grammar / DSL文法DL | Download the embedded DSL grammar as `NeoCEG_DSL_Grammar.txt`. Also in the Help (?) popup. See §9.2. / 埋め込みの DSL 文法を `NeoCEG_DSL_Grammar.txt` でダウンロード。Help（?）にもある。§9.2 参照。 |

Graph image export (SVG/PNG) is accessed via the File menu (see §5).
グラフ画像エクスポート（SVG/PNG）はFileメニューからアクセスする（§5参照）。

### 9.2 DSL Grammar reference — offline & always in sync / DSL文法リファレンス — オフライン・常に同期

The app can hand its **DSL grammar** to an AI assistant so the AI can generate `.nceg` graphs. Because the app
is installable and runs **offline**, the grammar is **embedded in the build**, not fetched from the network.
アプリは **DSL 文法** を AI に渡してグラフ生成に使えるようにする。アプリはインストール可能で**オフライン**動作
するため、文法はネット取得ではなく**ビルドに埋め込む**。

| Aspect / 観点 | Behavior / 動作 |
|---|---|
| Content / 内容 | The single fenced `ebnf` block of [`DSL_Grammar_Specification.md`](DSL_Grammar_Specification.md) (EBNF + comments incl. the factor=level naming digest). Not the whole document. / 文法仕様の `ebnf` フェンス・ブロック1個（EBNF＋コメント、factor=level 命名ダイジェスト含む）。文書全体ではない。 |
| Locations / 場所 | NeoCEG Language tab (Copy/Download DSL Grammar) **and** the Help (?) popup. / NeoCEG Language タブと Help（?）の2か所。 |
| Format / 形式 | Copy → clipboard (plain text); Download → `NeoCEG_DSL_Grammar.txt`. / コピーはプレーンテキスト、DL は `NeoCEG_DSL_Grammar.txt`。 |
| Offline / オフライン | Embedded at build time (Vite `?raw` import of the spec); works with no network. / ビルド時に埋め込み（仕様を Vite `?raw` で取り込む）。ネット不要。 |
| No version drift / 版ズレ防止 | There is **no hand-copied duplicate** — the build inlines the spec file itself, so the shipped grammar always equals the repo at build time, and equals the app version by construction. A unit test asserts the embedded text still extracts to a valid grammar block (version comment + key productions), so a doc change that breaks extraction fails CI rather than silently shipping stale/empty grammar. / **手書きの複製を持たない**——ビルドが仕様ファイル自体をインライン化するので、出荷文法は常にビルド時点のリポジトリと一致＝アプリ版と一致。単体テストが「埋め込みテキストが有効な文法ブロック（版コメント＋主要生産規則）に抽出できる」ことを表明し、抽出を壊す文書変更は CI で落ちる（陳腐化・空文法の暗黙出荷を防ぐ）。 |
| Version shown / 版表示 | The grammar version (e.g. `v1.5`) is parsed from the block's header comment and shown next to the Help action. / 版（例 `v1.5`）はブロック先頭コメントから取得し Help の操作の隣に表示。 |

### 9.1 Graph Image Export Specifications / グラフ画像エクスポート仕様

**SVG rendering strategy / SVGレンダリング方式:**
Pure SVG elements only (no foreignObject). Ensures compatibility with Inkscape, PowerPoint, and all standards-compliant SVG viewers.
純粋SVG要素のみ使用（foreignObject不使用）。Inkscape、PowerPoint等の標準準拠SVGビューアとの互換性を確保。

**PNG rendering strategy / PNGレンダリング方式:**
SVG → Canvas → PNG pipeline. The captured pure SVG is loaded into an Image element, drawn onto an HTML Canvas at 2x scale, then exported as PNG blob.
SVG → Canvas → PNG パイプライン。キャプチャした純粋SVGをImage要素に読み込み、2倍スケールでHTML Canvasに描画後、PNGブロブとしてエクスポート。

---

## 10. Skeleton Tab / スケルトンタブ

The bottom panel includes a "Skeleton" tab, between Compare and NeoCEG Language. It shows the program
control-structure skeleton derived from the graph (see `Skeleton_Generator_Specification.md`).
下部パネルに、Compare と NeoCEG Language の間に「Skeleton」タブを設ける。グラフから導いた制御構造
スケルトンを表示する（`Skeleton_Generator_Specification.md` 参照）。

| Element / 要素 | Description / 説明 |
|---|---|
| Pseudo-code area / 擬似コード領域 | Read-only monospace textarea showing the generated skeleton, updated reactively / 生成スケルトンを表示する読み取り専用の等幅テキストエリア、リアクティブに更新 |
| Copy Skeleton / スケルトンコピー | Copy the skeleton text to clipboard. Also in the panel header export menu and the toolbar File menu (§5). / クリップボードへコピー。パネルヘッダの書き出しメニューおよびツールバーの File メニュー（§5）にもある。 |
| Download Skeleton / スケルトンDL | Download as `skeleton_<date>.txt`. Also in the panel header export menu and the toolbar File menu (§5). / `skeleton_<date>.txt` でダウンロード。ヘッダメニューおよびツールバーの File メニュー（§5）にもある。 |
| Empty state / 空状態 | Placeholder when there is no decision table to render / デシジョンテーブルが無いときはプレースホルダ |

Validity warnings for the skeleton (and the decision table) appear in the always-visible panel banner, not
inside this tab — see §7.4. / スケルトン（およびデシジョンテーブル）の妥当性警告は、このタブ内ではなく
常時表示のパネルバナーに出す（§7.4 参照）。

---

## 11. History / 変更履歴

| Date / 日付 | Change / 変更 |
|---|---|
| 2026-06-13 | Add Skeleton tab (decision table → pseudo-code; Copy + Download in tab and header menu) / Skeletonタブ追加（デシジョンテーブル→擬似コード、タブとヘッダメニューにコピー＋DL） |
| 2026-06-13 | Add always-visible validity warnings (§7.4): skeleton-not-verified (A) and multi-effect decision-table columns (B) / 常時表示の妥当性警告を追加（§7.4）：スケルトン未検証(A)・複数効果列(B) |
| 2026-06-13 | Add Download/Copy Skeleton to the toolbar File menu (§5) for parity with the other table exports / 他のテーブル系エクスポートと揃え、ツールバー File メニュー（§5）に Download/Copy Skeleton を追加 |
| 2026-06-13 | Consolidate table clipboard copy to one dual-format action per table (NeoCombi parity): `Copy Decision CSV`+`Copy Decision HTML` → `Copy Decision Table`, same for Coverage; one Copy writes text/html + text/plain(CSV) with a writeText fallback / 表のコピーを表ごと単一の2形式コピーに集約（NeoCombi と一貫）：`Copy Decision CSV`＋`Copy Decision HTML`→`Copy Decision Table`、Coverage も同様。Copy 一つで text/html＋text/plain(CSV) を書込、writeText フォールバック付き |
| 2026-06-14 | Add **Copy/Download DSL Grammar** in the NeoCEG Language tab and the Help (?) popup (§9.2). The grammar (the spec's fenced `ebnf` block) is embedded at build via Vite `?raw` so it works offline and never drifts from the repo; a unit test guards extraction. Download is `NeoCEG_DSL_Grammar.txt` / NeoCEG Language タブと Help（?）に **Copy/Download DSL Grammar** を追加（§9.2）。文法（仕様の `ebnf` フェンス・ブロック）を Vite `?raw` でビルド埋め込み＝オフライン動作・リポジトリと不整合なし、抽出は単体テストで担保。DL は `NeoCEG_DSL_Grammar.txt` |
| 2026-02-17 | Initial version / 初版作成 |
| 2026-02-17 | Remove "Reverse Direction" from constraint node menu; direction change via per-edge menu only / 制約ノードメニューから「方向を反転」を削除、エッジメニューのみで方向変更 |
| 2026-02-28 | Add Decision Table Panel spec: column terminology "rules", section header colors, observable indicator / デシジョンテーブルパネル仕様追加：列用語「ルール」、セクションヘッダー色、観測可能インジケーター |
| 2026-02-28 | Redesign color system: node role colors (blue→indigo→purple gradient), section headers use node border color with white text, row labels use node fill color / 色体系再設計：ノードロール色（青→藍→紫）、セクションヘッダーはノード枠色+白文字、行ラベルはノード塗りつぶし色 |
| 2026-02-28 | Add DT row ordering spec: display-layer Y-coordinate sort within sections / DT行並び順仕様追加：表示層でのセクション内Y座標ソート |
| 2026-03-01 | Add page leave warning, sequential default node names, Export tab, SVG graph export / ページ離脱警告、連番デフォルトノード名、Exportタブ、SVGグラフエクスポートを追加 |
| 2026-03-01 | Add PNG graph export (Download PNG + Copy PNG) with 2x Retina resolution / PNGグラフエクスポート（PNGダウンロード＋PNGコピー）を2倍Retina解像度で追加 |
| 2026-03-01 | Reorganize: rename Export tab to "NeoCEG Language {.nceg}", move SVG/PNG to File menu, restructure File menu by operation type / 整理：ExportタブをNeoCEG Languageに改名、SVG/PNGをFileメニューに移動、操作別にFileメニュー再構成 |
| 2026-03-01 | Add CSV export to File menu (Download/Copy Decision CSV + Coverage CSV), extract csvExporter service / CSVエクスポートをFileメニューに追加（DT/Coverage CSVダウンロード・コピー）、csvExporterサービスを分離 |
| 2026-03-01 | Rename .nceg/DSL labels to "Save/Copy CEG Definition" — convey purpose (saving CEG definition) not file format / .nceg/DSLラベルを「Save/Copy CEG Definition」に改名 — ファイル形式ではなく目的（CEG定義の保存）を表現 |
| 2026-03-01 | Invert observable display: show nothing for observable (default), amber closed-eye for non-observable. DSL: `[unobservable]` replaces `[observable]` (backward compat kept) / observable表示反転：デフォルトは表示なし、非observableにamber閉じた目。DSL：`[unobservable]`に変更（`[observable]`は後方互換維持） |
| 2026-03-04 | Add Import/Paste CEG Definition: File menu "Import..." renamed to "Import CEG Definition", add "Paste CEG Definition" to menu and Language tab. Both validate DSL before replacing. / Import/Paste CEG Definitionを追加：Fileメニュー「Import...」を「Import CEG Definition」に改名、メニューとLanguageタブに「Paste CEG Definition」追加。両方とも置換前にDSLバリデーション実施。 |
| 2026-03-04 | Add HTML table clipboard copy: `⎘ HTML` buttons on Decision/Coverage tab headers + Copy Decision HTML / Copy Coverage HTML in File menu. Uses ClipboardItem API with text/html + text/plain (CSV fallback) for styled paste into PowerPoint, Word, etc. / HTMLテーブルクリップボードコピーを追加：Decision/CoverageタブヘッダーにHTMLボタン＋Fileメニューにコピー項目。ClipboardItem APIでtext/html＋text/plain(CSV)を同時書込、PowerPoint・Word等にスタイル付きペースト。 |
| 2026-06-13 | §2.4 Node display = proposition (label / meaningful identifier); the logical expression moves to a hover tooltip; placeholder-named nodes prompt for a concept name. Auto-naming a node from its expression is removed. / §2.4 表示名＝命題（ラベル/意味ある識別子）、論理式はホバーのツールチップへ、プレースホルダ名は命名を促す。式からの名前自動生成は廃止。 |
| 2026-06-13 | Remove the observable flag entirely (graph indicator, "Mark as (Non-)Observable" menu, node property, decision-table Observable column, old §7.4 indicator section). / 観測フラグを完全削除（グラフ表示・右クリック切替・ノードプロパティ・DTのObservable列・旧§7.4節）。 |

# NeoCEG Internal Design Specification / 内部詳細設計仕様

**Status**: Draft / ドラフト (2026-06-14)
**Audience**: Implementers only — not end users / 実装者向け（エンドユーザー向けではない）

---

## Purpose / 目的

This document records **internal implementation invariants** that are intentionally
**absent from the user-facing specifications** (`Requirements_Specification.md`,
`GUI_Specification.md`, `DSL_Grammar_Specification.md`).

本書は、**ユーザー向け仕様にあえて書かれていない内部実装の不変条件**を記録する。

**Why a separate document (altitude) / なぜ別文書か（階層）**: At the user-requirements
altitude, a tool user does not see and cannot distinguish a node's internal **identifier**
from its **label** — that distinction is an internal concern. Recording it in a user-facing
spec would mix altitudes. It belongs here.

ユーザー要求の階層では、利用者は内部の**識別子**を見ず、**ラベル**と区別もできない ──
その区別は内部の都合。ユーザー向け仕様に書くと階層が混ざる。だからここに置く。

---

## Scope / 範囲

Currently: **node identity and its preservation across representations**. The document may
grow to cover other internal invariants. / 当面は**ノードの同一性と、表現をまたいだ保持**。
将来、他の内部不変条件にも拡張しうる。

---

## 1. Representations of one graph / 1つのグラフの3つの表現

The same graph exists in three forms, with conversions between them:
同一のグラフが3つの形で存在し、相互変換される：

| Representation / 表現 | Identity field / 同一性の置き場 | Defined in / 定義 |
|----------------------|------------------------------|------------------|
| **DSL** (`.nceg` text) | the identifier token (e.g. `結果_無料`) | `DSL_Grammar_Specification.md` |
| **LogicalModel** (logical layer) | `LogicalNode.name` | `src/types/logical.ts` |
| **GraphData** (React Flow / UI) | — (see §3) | `src/types/graph.ts` |

Conversions / 変換: `parseLogicalDSL`, `serializeLogicalModel`, `logicalToGraph`,
`graphToLogical` (`src/services/modelConverter.ts`).

---

## 2. Node identity invariants / ノード同一性の不変条件

A node's three attributes are **distinct** (the grammar already separates them; this doc only
fixes their *internal handling*): / ノードの3属性は**別物**（文法が既に分離。本書は*内部の扱い*のみ規定）：

- **identifier (identity)** — the stable handle. The DSL author's name; internal/hidden to GUI users.
- **label** — optional human statement (proposition) shown on screen. May be absent.
- **expression** — the `:=` definition. Never an identity, never the display name.

> **INV-1 — Every node has a stable identifier.** / **全ノードは安定した識別子を持つ。**
> Assigned **at creation** (DSL parse *or* GUI node creation), unique within the graph,
> and **never silently regenerated**. A node is never identity-less.
> 生成時（DSLパース*または*GUIでの作成）に付与し、グラフ内で一意、**勝手に振り直さない**。
> 識別子の無いノードは存在しない。

> **INV-2 — Identity is preserved across every conversion and export.** / **同一性は全変換・全出力で保持される。**
> No conversion (`logicalToGraph`, `graphToLogical`) or export (DSL, CSV) may **invent, drop,
> or reassign** a node's identifier. Round-trip `DSL → graph → DSL` must return the original
> identifiers. / いかなる変換・出力も識別子を**作り直し・破棄・置換してはならない**。
> `DSL → グラフ → DSL` の往復で元の識別子が戻ること。

> **INV-3 — Identity/matching keys on the identifier, never the label.** / **同一性判定は識別子で行い、ラベルでは行わない。**
> Identifiers are unique; **labels are not** (a user may give two nodes the same label, or
> none). Any dedup/merge/lookup keyed on the label is incorrect.
> 識別子は一意、**ラベルは非一意**（同名ラベルや空も可）。ラベルで突き合わせる処理は誤り。

---

## 3. Current violations (to be fixed) / 現状の違反（要修正）

Reproduced 2026-06-14 with an identifier-only DSL (no labels on `:=` nodes):
ラベル無しの `:=` ノードを含むDSLで再現（2026-06-14）：

- **`graphToLogical` reassigns `p1, p2, …`**, discarding the identifier → violates **INV-2**.
  Round-trip export yields `p1: "..."`, `p9: "p9"` instead of the author's identifiers.
  `graphToLogical` が `p1, p2…` を振り直し識別子を捨てる → **INV-2 違反**。
- **`graphStore.addNode` creates a node with a `label` only — no identifier** → violates **INV-1**.
  The GUI has no identifier concept; only labels. / GUIに識別子の概念が無く、ラベルだけ。

These are the root of the "identifiers turn into `p9`" bug. The display fallback
(`label ?? identifier`) is **not** a fix — it hides INV violations. Do not lead with it.
これらが「識別子が `p9` 化する」バグの根。表示フォールバックは修正ではなく症状隠し。先に手を付けない。

---

## 4. Target design / あるべき設計

- **GUI node creation** assigns a stable identifier at creation time (stored on the node),
  independent of the typed label. / GUIノード作成時に、入力ラベルとは独立した安定識別子を付与・保持する。
- **GraphData carries the identifier** as a first-class field (not only the React Flow element id,
  which is a UI artifact). / GraphData が識別子を一級フィールドとして保持する（UI都合の要素IDとは別）。
- **`graphToLogical` uses the stored identifier**; generated names (`p…`) are only the
  creation-time generator for as-yet-unnamed GUI nodes — never a per-conversion reassignment.
  `graphToLogical` は保持済み識別子を使う。`p…` 採番は未命名GUIノードの*生成時*生成器に限り、変換ごとの振り直しに使わない。

---

## 5. GUI node identifier assignment / GUIノードの識別子付与

**Context / 背景**: In the GUI a user types a single free-text string, which may contain spaces
or `=` (e.g. `年齢 = 小学生`). That text is a **label/statement**, not a valid identifier
(identifiers disallow spaces and `=`). Yet INV-1 requires an identifier at creation, so the GUI
must supply one. / GUIでは利用者は1つの自由文字列を打ち、空白や `=` を含みうる（例 `年齢 = 小学生`）。
それは**ラベル（言明）**であって識別子ではない（識別子は空白・`=` 不可）。だが INV-1 によりノードは
生成時に識別子を持たねばならず、GUIがそれを用意する必要がある。

**Policy / 方針**:

- **GUI-typed text is the label, not the identifier.** GUI users work visually with statements;
  the identifier stays internal/hidden. / **GUIで打つ文字列はラベル**。識別子は内部に隠れたまま。
- At creation the system **auto-generates a stable identifier** (e.g. `n1, n2, …`): unique in the
  graph, assigned **once**, stored on the node, and **never regenerated by a conversion** (this is
  what fixes the `p1/p2` reassignment bug). The prefix is an implementation detail.
  生成時に**安定識別子を自動採番**（例 `n1, n2…`）：グラフ内一意・一度だけ付与・ノードに保持・
  **変換で振り直さない**（これが `p1/p2` バグの修正点）。接頭辞は実装詳細。
- **DSL-imported nodes keep the author's identifier** (`結果_無料`); no auto-generation.
  **DSL取り込みノードは作者の識別子を維持**（`結果_無料`）。自動採番しない。
- Editing the label, or a role change (cause→intermediate→effect), **does not change the
  identifier**. / ラベル編集や役割変更で**識別子は変わらない**。
- The generator **avoids collisions** with existing identifiers (imported or previously generated).
  採番は既存識別子（取り込み・既採番）と**衝突しない**こと。
- **Display is unchanged** (`GUI_Specification §2.4`): a node shows its label; with none, it shows
  its identifier — and an auto id like `n1` reads as an invitation to name (`§P4`).
  **表示は不変**：ノードはラベルを表示、無ければ識別子を表示。`n1` 等は命名を促す表示として機能。

**Consequence on export / エクスポートへの帰結**: a GUI-built graph serializes as
`n1: "年齢 = 小学生"` … (the conventional *identifier + quoted-label* form, matching existing
fixtures). A DSL-built graph round-trips with its **original** identifiers.
GUIで作ったグラフは `n1: "年齢 = 小学生"` …（従来の*識別子＋引用ラベル*形、既存フィクスチャと同形）で
出力。DSLで作ったグラフは**元の**識別子のまま往復する。

---

## References / 参照
- `DSL_Grammar_Specification.md` §P5–P6 (identifier vs label) / 識別子とラベル
- `GUI_Specification.md` §2.4 (display: label, else identifier) / 表示規則
- `Requirements_Specification.md` (node = proposition; user-altitude) / ノード＝命題（ユーザー階層）

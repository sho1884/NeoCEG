# NeoCEG テストカタログ

全197テスト（5テストファイル）の一覧と、対応するCEGグラフファイルの対照表。

---

## 概要

| テストファイル | テスト数 | テスト対象 |
|---|---|---|
| cegAlgorithm.test.ts | 95 | CEGアルゴリズム全フェーズ |
| decisionTable.test.ts | 68 | 真理値演算、デシジョンテーブル生成、制約、学習モード |
| logicalDsl.test.ts | 26 | DSLパーサー、シリアライザー、ラウンドトリップ |
| import-export.test.ts | 5 | インポート/エクスポート統合 |
| problematic-import.test.ts | 3 | 異常系インポート（循環参照検出） |

---

## 1. CEG Algorithm Tests (95 tests)

`src/__tests__/cegAlgorithm.test.ts`

### 1.1 extractExpressions - AND nodes (3 tests)

論理式抽出：ANDノードからn+1個の論理式を生成する。

| # | テスト | 検証内容 | CEGグラフ |
|---|---|---|---|
| 1 | AND(A,B)→C generates 3 expressions | 2入力ANDから3式（全充足/A非充足/B非充足） | [01_and_2input.nceg](graphs/01_and_2input.nceg) |
| 2 | AND with 3 inputs generates 4 expressions | 3入力ANDから4式 | [03_and_3input.nceg](graphs/03_and_3input.nceg) |
| 3 | AND with NOT edge: A AND NOT(B)→C | NOT辺の充足値反転 | [05_and_not.nceg](graphs/05_and_not.nceg) |

### 1.2 extractExpressions - OR nodes (3 tests)

| # | テスト | 検証内容 | CEGグラフ |
|---|---|---|---|
| 4 | OR(A,B)→C generates 3 expressions | 2入力ORから3式 | [02_or_2input.nceg](graphs/02_or_2input.nceg) |
| 5 | OR with 3 inputs generates 4 expressions | 3入力ORから4式 | [04_or_3input.nceg](graphs/04_or_3input.nceg) |
| 6 | OR with NOT edge: A OR NOT(B)→C | NOT辺のOR側反転 | [06_or_not.nceg](graphs/06_or_not.nceg) |

### 1.3 extractExpressions - single input (2 tests)

| # | テスト | 検証内容 | CEGグラフ |
|---|---|---|---|
| 7 | simple pass-through: ref(A)→C | 単純参照から2式 | [08_passthrough.nceg](graphs/08_passthrough.nceg) |
| 8 | negation: NOT(A)→C | NOT単入力から2式 | [07_not_single.nceg](graphs/07_not_single.nceg) |

### 1.4 extractExpressions - expression numbering (2 tests)

| # | テスト | 検証内容 | CEGグラフ |
|---|---|---|---|
| 9 | sequential indices across nodes | 効果→中間の順で連番付与 | [09_chain_and_and.nceg](graphs/09_chain_and_and.nceg) |
| 10 | column indices are per-node (0-based) | ノード内の列番号は0始まり | [01_and_2input.nceg](graphs/01_and_2input.nceg) |

### 1.5 extractExpressions - required values scope (2 tests)

| # | テスト | 検証内容 | CEGグラフ |
|---|---|---|---|
| 11 | only contains owner node and direct inputs | 各式は直接入力のみ参照 | [09_chain_and_and.nceg](graphs/09_chain_and_and.nceg) |
| 12 | chain example matches Algorithm_Design.md §4.6 | 設計書との一致確認 | [09_chain_and_and.nceg](graphs/09_chain_and_and.nceg) |

### 1.6 extractExpressions - edge cases (2 tests)

| # | テスト | 検証内容 | CEGグラフ |
|---|---|---|---|
| 13 | model with only causes generates no expressions | 原因のみ→式なし | (グラフなし) |
| 14 | mixed AND/OR graph | AND中間→OR結果の混合 | [10_chain_and_or.nceg](graphs/10_chain_and_or.nceg) |

### 1.7 deduceValue - AND nodes (8 tests)

値伝播：ANDノードの出力値計算。

| # | テスト | 検証内容 | CEGグラフ |
|---|---|---|---|
| 15 | AND(T,T)→t | 両方真→真（小文字） | [01_and_2input.nceg](graphs/01_and_2input.nceg) |
| 16 | AND(T,F)→f | 短絡偽 | 同上 |
| 17 | AND(T,M)→I | MASK→不確定 | 同上 |
| 18 | AND(F,M)→f | FはANDの吸収元 | 同上 |
| 19 | AND with NOT: A=T,B=F→t | NOT辺の正常伝播 | [05_and_not.nceg](graphs/05_and_not.nceg) |
| 20 | AND with NOT: A=T,B=T→f | NOT辺の逆転 | 同上 |
| 21 | AND with unset input→I | 未設定→不確定 | [01_and_2input.nceg](graphs/01_and_2input.nceg) |
| 22 | skips already-set nodes | 設定済みノードはスキップ | 同上 |

### 1.8 deduceValue - OR nodes (5 tests)

| # | テスト | 検証内容 | CEGグラフ |
|---|---|---|---|
| 23 | OR(T,F)→t | 短絡真 | [02_or_2input.nceg](graphs/02_or_2input.nceg) |
| 24 | OR(F,F)→f | 両方偽 | 同上 |
| 25 | OR(M,F)→I | MASK→不確定 | 同上 |
| 26 | OR(M,T)→t | TはORの吸収元 | 同上 |
| 27 | OR with NOT: A=F,B=T→f | NOT辺のOR側 | [06_or_not.nceg](graphs/06_or_not.nceg) |

### 1.9 deduce - multi-node propagation (4 tests)

| # | テスト | 検証内容 | CEGグラフ |
|---|---|---|---|
| 28 | chain: all T → t propagation | 連鎖真伝播 | [09_chain_and_and.nceg](graphs/09_chain_and_and.nceg) |
| 29 | chain with false propagation | B=F→I=f→E=f | 同上 |
| 30 | mixed AND/OR chain | AND(f)→OR(f)→f | [10_chain_and_or.nceg](graphs/10_chain_and_or.nceg) |
| 31 | lowercase input values (t/f) | 小文字入力の伝播 | [01_and_2input.nceg](graphs/01_and_2input.nceg) |

### 1.10 deduceConstraint - ONE (4 tests)

制約推論：ONE制約。

| # | テスト | 検証内容 | CEGグラフ |
|---|---|---|---|
| 32 | ONE(A,B): A=T→B=F | 1つ真→残り偽 | (制約のみ、グラフ不要) |
| 33 | ONE(A,B,C): A=F,B=F→C=T | 最後の未設定→真 | 同上 |
| 34 | ONE(A,NOT B): A=T→B=T | 否定メンバーの逆転 | 同上 |
| 35 | ONE(A,B,C): 2つ未設定→推論なし | 推論不能ケース | 同上 |

### 1.11 deduceConstraint - EXCL (2 tests)

| # | テスト | 検証内容 | CEGグラフ |
|---|---|---|---|
| 36 | EXCL(A,B): A=T→B=F | 1つ真→残り偽 | (制約のみ) |
| 37 | EXCL(A,B): A=F,B=""→推論なし | EXCLは最後を強制しない | 同上 |

### 1.12 deduceConstraint - INCL (3 tests)

| # | テスト | 検証内容 | CEGグラフ |
|---|---|---|---|
| 38 | INCL(A,B): A=F→B=T | 最後の未設定→真 | (制約のみ) |
| 39 | INCL(A,B,C): A=F,B=F→C=T | 3メンバー | 同上 |
| 40 | INCL(A,B): A=T→推論なし | 既に充足 | 同上 |

### 1.13 deduceConstraint - REQ (3 tests)

| # | テスト | 検証内容 | CEGグラフ |
|---|---|---|---|
| 41 | REQ(A→B): A=T→B=T | ソース真→ターゲット真 | (制約のみ) |
| 42 | REQ(A→B): A=F→推論なし | ソース偽→推論不要 | 同上 |
| 43 | REQ(NOT A→B): A=F→B=T | 否定トリガー | 同上 |

### 1.14 applyMask (4 tests)

| # | テスト | 検証内容 | CEGグラフ |
|---|---|---|---|
| 44 | MASK(A→B): A=T→B=M | トリガー真→M | (制約のみ) |
| 45 | MASK(A→B): A=F→B不変 | トリガー偽→変化なし | 同上 |
| 46 | MASK contradiction: target already set→false | 矛盾検出 | 同上 |
| 47 | MASK: target already M→ok | 再M設定OK | 同上 |

### 1.15 checkSingleConstraint (12 tests)

制約違反チェック。

| # | テスト | 検証内容 |
|---|---|---|
| 48-49 | ONE: T,F→ok / T,T→violation | ONE基本 |
| 50-51 | ONE: F,F→violation / T,""→ok | ONE全偽/未設定 |
| 52-53 | EXCL: T,T→violation / F,F→ok | EXCL基本 |
| 54 | INCL: F,F→violation | INCL全偽 |
| 55-56 | REQ: T,F→violation / T,T→ok | REQ基本 |
| 57 | ONE with M values→no violation | MASK存在時 |

(#48-57は制約単体テスト、特定グラフ不要)

### 1.16 checkConstr - integrated (2 tests)

| # | テスト | 検証内容 |
|---|---|---|
| 58 | EXCL(A,D): A=T→D=F, no violation | 推論後の整合性 |
| 59 | EXCL(A,D): A=T,D=T→violation | 矛盾検出 |

### 1.17 checkRelation - AND nodes (9 tests)

論理整合性チェック。

| # | テスト | 検証内容 | CEGグラフ |
|---|---|---|---|
| 60-63 | AND基本: T,T/t, T,F/f, T,T/F, T,F/T | 整合/不整合 | [01_and_2input.nceg](graphs/01_and_2input.nceg) |
| 64 | AND(T,"") with T→consistent | 未知入力 | 同上 |
| 65-66 | AND with NOT: 不整合/整合 | NOT辺 | [05_and_not.nceg](graphs/05_and_not.nceg) |
| 67 | AND(M,T) with M→consistent | MASK入力 | [01_and_2input.nceg](graphs/01_and_2input.nceg) |
| 68 | AND(T,T) with M→inconsistent | MASKなしのM | 同上 |

### 1.18 checkRelation - OR nodes (7 tests)

| # | テスト | 検証内容 | CEGグラフ |
|---|---|---|---|
| 69-72 | OR基本: T,F/t, F,F/f, T,F/F, F,F/T | 整合/不整合 | [02_or_2input.nceg](graphs/02_or_2input.nceg) |
| 73 | OR(F,"") with F→consistent | 未知入力 | 同上 |
| 74 | OR with NOT→consistent | NOT辺 | [06_or_not.nceg](graphs/06_or_not.nceg) |
| 75 | OR(M,F) with M / OR(T,M) with M | MASK入力 | [02_or_2input.nceg](graphs/02_or_2input.nceg) |

### 1.19 checkRelation - edge cases (3 tests)

| # | テスト | 検証内容 |
|---|---|---|
| 76 | unset node value→consistent | 空値は整合 |
| 77 | cause node→always consistent | 原因ノードは常に整合 |
| 78 | I input treated as unknown | I値は未知扱い |

### 1.20 isPossible (4 tests)

| # | テスト | 検証内容 | CEGグラフ |
|---|---|---|---|
| 79 | consistent graph→empty string | 整合OK | [01_and_2input.nceg](graphs/01_and_2input.nceg) |
| 80 | inconsistent node→returns reason | 不整合理由 | 同上 |
| 81 | chain: I inconsistent | 連鎖不整合 | [09_chain_and_and.nceg](graphs/09_chain_and_and.nceg) |
| 82 | all unset→consistent | 全空は整合 | [01_and_2input.nceg](graphs/01_and_2input.nceg) |

### 1.21 integration - deduce with EXCL (1 test)

| # | テスト | 検証内容 | CEGグラフ |
|---|---|---|---|
| 83 | A(T) AND D→C with EXCL(A,D) | 推論+制約→伝播 | [11_and_excl.nceg](graphs/11_and_excl.nceg) |

### 1.22 calcTable - simple AND/OR (2 tests)

| # | テスト | 検証内容 | CEGグラフ |
|---|---|---|---|
| 84 | AND(A,B)→C: 3 test conditions | テーブル生成 | [01_and_2input.nceg](graphs/01_and_2input.nceg) |
| 85 | OR(A,B)→C: 3 test conditions | テーブル生成 | [02_or_2input.nceg](graphs/02_or_2input.nceg) |

### 1.23 calcTable - chain graph (1 test)

| # | テスト | 検証内容 | CEGグラフ |
|---|---|---|---|
| 86 | A AND B→I AND C→E covers all | 6式完全網羅 | [09_chain_and_and.nceg](graphs/09_chain_and_and.nceg) |

### 1.24 calcTable - result coverage (1 test)

| # | テスト | 検証内容 | CEGグラフ |
|---|---|---|---|
| 87 | each cause appears as T/t and F/f | 原因のT/F両出現 | [01_and_2input.nceg](graphs/01_and_2input.nceg) |

### 1.25 generateCoverageTableFromState (2 tests)

| # | テスト | 検証内容 | CEGグラフ |
|---|---|---|---|
| 88 | AND: 3 rows, 100% coverage | カバレッジ表 | [01_and_2input.nceg](graphs/01_and_2input.nceg) |
| 89 | coverage markers: # for unique | マーカー記号 | 同上 |

### 1.26 calcTable - admission fee example (4 tests)

| # | テスト | 検証内容 | CEGグラフ |
|---|---|---|---|
| 90 | generates 22 expressions | 式数 | [17_admission_fee.nceg](graphs/17_admission_fee.nceg) |
| 91 | 7 test conditions after weak removal | 最適化後7件 | 同上 |
| 92 | 100% expression coverage | 完全網羅 | 同上 |
| 93 | end-to-end: DecisionTable + CoverageTable | 統合E2E | 同上 |

---

## 2. Decision Table Tests (68 tests)

`src/__tests__/decisionTable.test.ts`

### 2.1 Truth Value Operations (35 tests)

真理値の演算規則テスト。**CEGグラフとしては表現不可**（演算単体テスト）。

| グループ | テスト数 | 検証内容 |
|---|---|---|
| truthAnd | 17 | T/F/t/f/M/I の全AND組合せ（CEGTest 1.6バグ修正含む） |
| truthOr | 14 | T/F/t/f/M/I の全OR組合せ |
| truthNot | 4 | NOT T/t/F/f/M/I |

**重要**: M AND M = I（CEGTest 1.6ではTまたはFと誤計算）の修正を検証。

### 2.2 Decision Table Generation (3 tests)

| # | テスト | 検証内容 | CEGグラフ |
|---|---|---|---|
| 1 | simple AND: 3 conditions | 基本AND生成 | [01_and_2input.nceg](graphs/01_and_2input.nceg) |
| 2 | simple OR: 3 conditions | 基本OR生成 | [02_or_2input.nceg](graphs/02_or_2input.nceg) |
| 3 | NOT expression: 2 conditions | NOT生成 | [07_not_single.nceg](graphs/07_not_single.nceg) |

### 2.3 Constraint Handling (5 tests)

| # | テスト | 検証内容 | CEGグラフ |
|---|---|---|---|
| 4 | EXCL: no both-true | 排他制約 | [11_and_excl.nceg](graphs/11_and_excl.nceg) |
| 5 | ONE: exactly one true | 唯一制約 | [12_or_one.nceg](graphs/12_or_one.nceg) |
| 6 | INCL: at least one true | 包含制約 | [13_or_incl.nceg](graphs/13_or_incl.nceg) |
| 7 | REQ: source→target | 要求制約 | [14_and_req.nceg](graphs/14_and_req.nceg) |
| 8 | MASK: targets shown as M | マスク制約 | [15_mask.nceg](graphs/15_mask.nceg) |

### 2.4 Complex Graphs (2 tests)

| # | テスト | 検証内容 | CEGグラフ |
|---|---|---|---|
| 9 | complex graph with EXCL | ログイン例 | [16_login_excl.nceg](graphs/16_login_excl.nceg) |
| 10 | intermediate nodes computed | 中間ノード経由 | [09_chain_and_and.nceg](graphs/09_chain_and_and.nceg) |

### 2.5 Admission Fee Example (5 tests)

| # | テスト | 検証内容 | CEGグラフ |
|---|---|---|---|
| 11 | parses correctly | 8原因/5結果の構文解析 | [17_admission_fee.nceg](graphs/17_admission_fee.nceg) |
| 12 | 7 optimized conditions | 最適化後7件 | 同上 |
| 13 | ONE constraints satisfied | 全条件でONE充足 | 同上 |
| 14 | effects computed for key scenarios | 全5料金帯出現 | 同上 |
| 15 | learning mode: feasible match practice | 学習/実務モード整合 | 同上 |

### 2.6 Learning Mode - Optimized Table (3 tests)

| # | テスト | 検証内容 | CEGグラフ |
|---|---|---|---|
| 16 | getFeasibleConditions filters weak | 弱テスト除外 | [01_and_2input.nceg](graphs/01_and_2input.nceg) |
| 17 | condition IDs sequential | ID連番 | 同上 |

### 2.7 Learning Mode - Brute-Force (8 tests)

| # | テスト | 検証内容 | CEGグラフ |
|---|---|---|---|
| 18 | AND: 4 columns in binary order | 2^2=4列、FF/FT/TF/TT | [01_and_2input.nceg](graphs/01_and_2input.nceg) |
| 19 | correct exclusion reasons | 除外理由の型チェック | 同上 |
| 20 | feasible match optimized | 実行可能条件数一致 | 同上 |
| 21 | EXCL: marks infeasible columns | TT列がinfeasible | [11_and_excl.nceg](graphs/11_and_excl.nceg) |
| 22 | returns null when 2^n > 256 | 9原因→null | (特定グラフ不要) |
| 23 | returns table when 2^n = 256 | 8原因→256列 | (特定グラフ不要) |
| 24 | stats consistency | total = feasible + 各除外 | [01_and_2input.nceg](graphs/01_and_2input.nceg) |
| 25 | condition IDs sequential 1..2^n | 学習モードID連番 | [02_or_2input.nceg](graphs/02_or_2input.nceg) |

---

## 3. Logical DSL Parser Tests (26 tests)

`src/__tests__/logicalDsl.test.ts`

### 3.1 Parser (9 tests)

| # | テスト | 検証内容 |
|---|---|---|
| 1 | parse cause definitions | 原因ノード定義（日本語ラベル） |
| 2 | parse AND expression | AND式解析 |
| 3 | parse OR expression | OR式解析 |
| 4 | parse NOT expression | NOT式解析 |
| 5 | complex with precedence | AND優先、OR後 |
| 6 | parse EXCL constraint | EXCL制約 |
| 7 | parse REQ constraint | REQ矢印構文 |
| 8 | parse layout section | @layout座標 |
| 9 | handle comments | #コメント無視 |

### 3.2 Serializer (2 tests)

| # | テスト | 検証内容 |
|---|---|---|
| 10 | serialize simple model | AND式のDSL出力 |
| 11 | serialize constraints | EXCL制約のDSL出力 |

### 3.3 Model Converter Round-trip (1 test)

| # | テスト | 検証内容 |
|---|---|---|
| 12 | logical→graph→logical | ラウンドトリップ変換 |

### 3.4 Sample File Parsing (1 test)

| # | テスト | 検証内容 | CEGグラフ |
|---|---|---|---|
| 13 | parse sample_graph.nceg format | 5ノード+2制約+レイアウト | [18_import_sample.nceg](graphs/18_import_sample.nceg) |

### 3.5 Serializer Label Preservation (1 test)

| # | テスト | 検証内容 |
|---|---|---|
| 14 | preserve effect node labels | ラベル付き結果ノードのラウンドトリップ |

### 3.6 Observable Flag (2 tests)

| # | テスト | 検証内容 |
|---|---|---|
| 15 | parse observable flag | [observable]フラグ解析 |
| 16 | serialize observable flag | [observable]フラグ出力 |

### 3.7 Constraint Positions (2 tests)

| # | テスト | 検証内容 |
|---|---|---|
| 17 | parse constraint positions | c0:(x,y)座標解析 |
| 18 | serialize constraint positions | c0:(x,y)座標出力 |

### 3.8 Nullable Labels (2 tests)

| # | テスト | 検証内容 |
|---|---|---|
| 19 | effect without label→null | ラベル省略時null |
| 20 | name as fallback label | 名前をフォールバック表示 |

### 3.9 Node Display Utilities (6 tests)

| # | テスト | 検証内容 |
|---|---|---|
| 21 | user label when provided | ユーザーラベル優先 |
| 22 | expression when label is null | null時に式表示 |
| 23 | expression when label is empty | 空白時に式表示 |
| 24 | name when no label/expression | 名前フォールバック |
| 25 | expression text for tooltip | ツールチップ用式文字列 |
| 26 | null for cause nodes | 原因ノードはnull |

---

## 4. Import/Export Tests (5 tests)

`src/__tests__/import-export.test.ts`

| # | テスト | 検証内容 | CEGグラフ |
|---|---|---|---|
| 1 | parse DSL correctly | 5ノードDSL解析 | [18_import_sample.nceg](graphs/18_import_sample.nceg) |
| 2 | convert to graph with correct edges | 5論理辺（NOT辺2本含む） | 同上 |
| 3 | parse new format with propositions | [observable]+@layout | 同上 |
| 4 | convert new format to graph | 論理5辺+制約4辺 | 同上 |
| 5 | round-trip: graph→logical→DSL→parse→graph | 完全ラウンドトリップ | 同上 |

---

## 5. Problematic Import Tests (3 tests)

`src/__tests__/problematic-import.test.ts`

| # | テスト | 検証内容 |
|---|---|---|
| 1 | detect circular reference (self) | p4 := p1 OR p4 OR p2 → エラー |
| 2 | detect indirect circular reference | a→b→c→a → エラー |
| 3 | allow valid non-circular references | p4 := p3 OR p1 → 正常 |

---

## CEGグラフファイル一覧

`Verification/TDD/graphs/` 配下の.ncegファイルは、NeoCEGにインポートして表示・検証できます。

| ファイル | グラフ構造 | 使用テスト数 |
|---|---|---|
| [01_and_2input.nceg](graphs/01_and_2input.nceg) | A AND B → C | ~30 |
| [02_or_2input.nceg](graphs/02_or_2input.nceg) | A OR B → C | ~10 |
| [03_and_3input.nceg](graphs/03_and_3input.nceg) | A AND B AND C → D | 1 |
| [04_or_3input.nceg](graphs/04_or_3input.nceg) | A OR B OR C → D | 1 |
| [05_and_not.nceg](graphs/05_and_not.nceg) | A AND NOT(B) → C | 4 |
| [06_or_not.nceg](graphs/06_or_not.nceg) | A OR NOT(B) → C | 3 |
| [07_not_single.nceg](graphs/07_not_single.nceg) | NOT(A) → C | 2 |
| [08_passthrough.nceg](graphs/08_passthrough.nceg) | A → C (pass-through) | 1 |
| [09_chain_and_and.nceg](graphs/09_chain_and_and.nceg) | A AND B → I AND C → E | ~8 |
| [10_chain_and_or.nceg](graphs/10_chain_and_or.nceg) | A AND B → I OR C → E | 2 |
| [11_and_excl.nceg](graphs/11_and_excl.nceg) | A AND B → C + EXCL(A,B) | 3 |
| [12_or_one.nceg](graphs/12_or_one.nceg) | A OR B → C + ONE(A,B) | 1 |
| [13_or_incl.nceg](graphs/13_or_incl.nceg) | A OR B → C + INCL(A,B) | 1 |
| [14_and_req.nceg](graphs/14_and_req.nceg) | A AND B → C + REQ(A→B) | 1 |
| [15_mask.nceg](graphs/15_mask.nceg) | B → C + MASK(A→B) | 1 |
| [16_login_excl.nceg](graphs/16_login_excl.nceg) | 3原因/2結果/NOT/EXCL | 1 |
| [17_admission_fee.nceg](graphs/17_admission_fee.nceg) | 8原因/2中間/5結果/3 ONE | ~9 |
| [18_import_sample.nceg](graphs/18_import_sample.nceg) | 3原因/2結果/EXCL/REQ | ~6 |

---

## テスト重複分析

同一グラフ`01_and_2input`(A AND B → C)を使用するテストは約30件あるが、検証観点は明確に分離されている：

- **extractExpressions**: 式の構造・数・充足値
- **deduceValue**: 入力値の組合せごとの出力
- **checkRelation**: 論理整合性判定
- **calcTable**: テーブル生成結果
- **coverageTable**: カバレッジ統計
- **learningMode**: ブルートフォース列挙

検証は**関数単位で独立**しており、同一グラフの使用は冗長ではなく、**単体テストの正しい設計**である。
手動検証では、関数横断ではなく**グラフ単位**で確認することで効率的にレビューできる。

# 原因結果グラフ法 デシジョンテーブル生成アルゴリズム設計書

---

## アルゴリズム参照元

本ドキュメントで説明するアルゴリズムは、**CEGTest 1.6** (加瀬正樹氏開発) のアルゴリズムの方法を理解し、参考としている。

| 項目 | 内容 |
|------|------|
| 参照元ソフトウェア | CEGTest 1.6 (2013-08-04) |
| 作者 | 加瀬正樹 (Masaki KASE) |

**NeoCEGの実装方針:**
- コードのコピー: なし（TypeScriptで全面書き直し）
- アーキテクチャ: 異なる（関数型・型安全 vs グローバル状態・OOP）
- アルゴリズム概念: CEGTestの方法を理解して参考とする

---

## 1. 概要

### 1.1 目的

原因結果グラフ法（CEG: Cause-Effect Graphing）に基づき、**最小限のテスト条件**でグラフ内の全論理式を網羅するデシジョンテーブルを生成する。

### 1.2 参考文献

- Myers, Badgett, Sandler "The Art of Software Testing" 3rd Ed., Ch.4
- ISO/IEC/IEEE 29119-4 Software Testing - Part 4: Test Techniques
- CEGTest 1.6 (加瀬正樹)

### 1.3 アルゴリズムの全体像

アルゴリズムは3つのフェーズで構成される:

1. **論理式網羅フェーズ**: 全論理式が少なくとも1つのテスト条件でカバーされるまで、テスト条件を生成する
2. **敗者復活フェーズ**: 全原因ノードがT/t・F/fの両方の値を持つことを保証する
3. **弱テスト削除フェーズ**: いずれかの論理式を唯一カバーしているテスト条件のみを残し、そうでないテスト条件を削除する

---

### 1.4 決定表の正しさ（義務集合）

生成された決定表 `T`（列の集合）が**正しい**とは、次の3つが同時に成り立つことをいう。

1. **完全性**: 義務集合 `O` の各義務が、`T` のいずれかの列によって**果たされている**
2. **説明可能性**: 果たせない義務は、その理由（実行不可／テスト不可／観測不能）に分類して報告されている
3. **非冗長性**: `T` のどの列を取り除いても、果たされなくなる義務が存在する

**「果たされている」の定義**:

> 義務が果たされているとは、その列を実行したときに、**テスターが合否を判定できる形で**
> 当該の事実が現れることをいう。

この定義により、観測可能性（§2.5）は後付けの追加規則ではなく、「果たす」という語の
意味として全義務に一様に適用される。結果ノードで観測できない事実は、果たされていない。

#### 義務の全集合

| ID | 義務 | 果たす条件 | 詳細 |
|----|------|-----------|------|
| A | **論理式網羅** — 各論理式につき最低1本 | 列が要求値を実現し、かつオーナーノードが観測可能 | §4, §13.1 |
| B | **結果網羅** — 孤立でない各原因の T と F | 列がその値を持ち、かつ観測可能 | §5.1 フェーズ2 |
| C | **制約の実演** — 各 MASK 制約につき最低1本 | トリガー真 → ターゲット不問(M) を示す | §14.4 |
| D | **実行可能性** — 各列が実行可能 | `checkConstr` と `isPossible` が空 | §6.2 Step 5b, §10, §11.4 |
| E | **非冗長性** — どの列も A・B・C のいずれかを単独で担う | 削除すると果たされない義務が生じる | §14 |
| F | **分類と報告** — 果たせない義務の理由を示す | 実行不可 / テスト不可 / 観測不能 | §13.4 |
| G | **表示規則** — 値と不問の表記 | §15.2 のとおり | §15.2 |
| I | **列の一意性** — 実行入力として同一の列を出さない | `T` と `t`、`F` と `f` は同じ入力とみなす | §14.5 |
| J | **決定性** — 同一ソースからは同一の決定表 | 走査順に依存しない | — |

> C の ONE/EXCL/INCL/REQ については、排除作用がカバレッジ表の実行不可マーキング
> （違反制約名つき、§13.4）で実証されるため、追加の列は要求しない。

#### カバレッジ率の分母

カバレッジ率は、**果たせる／果たせないに関わらず全論理式**を分母として数える。
実行不可・テスト不可・観測不能の件数を併記し、到達できない理由が読み取れるようにする。
漏れているものは、漏れていると分かる形で示す。


## 2. 真理値の体系

### 2.1 値の種類と意味

本アルゴリズムでは6種類の真理値を使い分ける。**大文字と小文字は意味が異なり、厳密に区別する。**

| 値 | 名称 | 意味 | 設定される場面 |
|----|------|------|--------------|
| `T` | 明示的真 | 論理式定義、または制約演繹により**明示的に**Trueと決定された | `getLogicValue()`, 制約 `deduceLogic()` |
| `t` | 推論的真 | 論理伝播、または原因ノード割り当てにより**推論的に**Trueと判明した | `deduceValue()`, `chooseCauseValue()` |
| `F` | 明示的偽 | 論理式定義、または制約演繹により**明示的に**Falseと決定された | `getLogicValue()`, 制約 `deduceLogic()` |
| `f` | 推論的偽 | 論理伝播、または原因ノード割り当てにより**推論的に**Falseと判明した | `deduceValue()`, `chooseCauseValue()` |
| `M` | マスク | MASK制約により値が不問（マスクされている）| `maskLogic()` |
| `I` | 不確定 | マスクまたは不確定な入力により、出力が確定しない | `deduceValue()` |
| `""` | 未設定 | まだ値が割り当てられていない | 初期状態 |

### 2.2 カバレッジ判定は「実行されるテスト」の性質

カバレッジ判定（論理式がテスト条件にカバーされるか）は、**テスターが実行する入力**に
対して行う。したがって値の**由来は問わない**:

```
カバー条件: 論理式の全値セルについて 真偽が一致する
            （"T" と "t" は同じ真、"F" と "f" は同じ偽）
        かつ オーナーノードがその列で観測可能（§2.5）
```

**なぜ由来を問わないか**: 同一の入力を実行する2本のテストは、同じ結果を返す。
値が論理式に要求されたものか推論で決まったものかは、実行結果を変えない。
由来で区別すると、同じ入力の列が「片方は検証、片方は未検証」に分かれ、
実行入力として重複する列（義務 I 違反）が残る。

**「意図する状況を検証しているか」の担保**: この役割は観測可能性（§2.5）が担う。
値がその列で結果ノードまで届いていれば、その論理式は検証されている。届いていなければ、
値がどう作られていても検証にはなっていない。

**大文字/小文字の役割**: `T`/`F`（論理式定義・制約演繹由来）と `t`/`f`（推論由来）の
区別は、値の由来を示す**表示上の注釈**として残る（Requirements_Specification SR-021）。
カバレッジ判定には用いない。

### 2.3 論理演算における値の扱い

#### 2.3.1 AND演算

AND演算の「満足」とは、各入力が**有効な値**であること:
- NOT無しエッジ: T/t が満足、F/f が非満足
- NOT有りエッジ: F/f が満足、T/t が非満足

```
FUNCTION evaluateAND(inputs[]) -> value:
    FOR each input IN inputs:
        IF input is 非満足:
            RETURN "f"  // 短絡: 1つでも非満足なら偽（推論的）
        IF input is M or I:
            mark 不確定
    IF 不確定:
        RETURN "I"
    RETURN "t"  // 全入力が満足（推論的）
```

#### 2.3.2 OR演算

```
FUNCTION evaluateOR(inputs[]) -> value:
    FOR each input IN inputs:
        IF input is 満足:
            RETURN "t"  // 短絡: 1つでも満足なら真（推論的）
        IF input is M or I:
            mark 不確定
    IF 不確定:
        RETURN "I"
    RETURN "f"  // 全入力が非満足（推論的）
```

#### 2.3.3 重要な注意: 推論値は常に小文字

`deduceValue()` の出力は常に小文字 (`"t"`, `"f"`) または `"I"` である。
大文字の `"T"`, `"F"` は論理式定義（`getLogicValue()`）と制約演繹（`deduceLogic()`）のみが設定する。

### 2.4 MASK値を含む演算（NeoCEGでのバグ修正）

CEGTest 1.6では、M（マスク）値の論理演算に不正確な部分がある。

| 演算 | CEGTest 1.6 | NeoCEG (正解) | 根拠 |
|------|-------------|---------------|------|
| M ∧ M | 不定（T/Fになりうる） | I（不確定） | M∧M の結果は確定しない |
| M ∧ T | 不定 | I（不確定） | Mの値次第でT/F両方ありうる |
| M ∧ F | F | f（偽確定） | F が吸収元なので M に関わらずF |
| M ∨ T | T | t（真確定） | T が吸収元なので M に関わらずT |
| M ∨ F | 不定 | I（不確定） | Mの値次第でT/F両方ありうる |
| M ∨ M | 不定 | I（不確定） | M∧M の結果は確定しない |

**参考**: CEGTest 1.6 における既知の不具合

---

### 2.5 観測可能性

テスト条件 `work` において、ノード `n` が**観測可能**であるとは、`n` の値を反転させて
下流を再計算したとき、**両方の場合で確定している結果ノード**の値が異なるものが
存在することをいう。

```
FUNCTION observable(work, model, n) -> BOOLEAN:
    IF work[n] が T/t/F/f のいずれでもない:
        RETURN FALSE                       // M / I / 未設定は観測不能

    kept    = work を複製し、n を現在値に固定して n 以外の派生ノードを再計算
    flipped = work を複製し、n を反転値に固定して n 以外の派生ノードを再計算

    FOR each 結果ノード e:
        IF kept[e] と flipped[e] の**両方**が T/t/F/f:
            IF 真偽が異なる:
                RETURN TRUE
    RETURN FALSE
```

**両側を同じ手順で再計算する**: 基準側に元の作業配列（合流や制約演繹で入った値を含む）を
使うと、推論し直した値と比較することになり判定が狂う。

**確定同士でのみ比較する**: `M`（マスク）や `I`（不定）は、テスターが合否を判定できない。
「確定 → 不定」への変化は観測の証拠にならない。

**計算量**: O(ノード数)。

**結果ノード自身**: 反転すれば必ず結果が変わるため、常に観測可能となる（無害）。


## 3. データ構造

### 3.1 論理式配列 `logics[l][k]`

2次元配列。各論理式（式番号 `l`）について、各ノード（ノード番号 `k`）の要求値を格納する。

- `l`: 論理式の通し番号（0始まり）
- `k`: ノード番号（0始まり）
- 値: `"T"`, `"F"`, または `""`（無関係）

**重要**: logics配列の値は常に**大文字** (`"T"`, `"F"`) である。

**例**: `A AND B → C` の場合（A=ノード0, B=ノード1, C=ノード2）

| 式番号 | A (k=0) | B (k=1) | C (k=2) | 説明 |
|-------|---------|---------|---------|------|
| l=0 | T | T | T | 全入力が満足 → 出力T |
| l=1 | F | T | F | Aが非満足 → 出力F |
| l=2 | T | F | F | Bが非満足 → 出力F |

### 3.2 作業配列 `work[k]`

1次元配列。テスト条件生成中の各ノードの現在の値を保持する。

- `k`: ノード番号
- 値: `"T"`, `"t"`, `"F"`, `"f"`, `"M"`, `"I"`, `""`

### 3.3 テスト結果配列 `tests[t][k]`

生成された全テスト条件を格納する2次元配列。

- `t`: テスト条件番号
- `k`: ノード番号
- 値: `"T"`, `"t"`, `"F"`, `"f"`, `"M"`, `"I"`

### 3.4 カバレッジ配列 `covs[t][l]`

各テスト条件が各論理式をカバーするかを記録する2次元配列。

- `t`: テスト条件番号
- `l`: 論理式番号
- 値: `0`（カバーしない）, `1`（カバーする）

### 3.5 当該テストカバレッジ `vtestcov[l]`

現在生成中のテスト条件が各論理式をカバーするかの一時配列。

- `l`: 論理式番号
- 値: `0` または `1`

### 3.6 合流履歴 `applied[]`

1本の列を作る間だけ保持する、合流した論理式の履歴。

```
applied[i] = { index: 論理式番号, req: その論理式が持ち込んだ要求値 }
```

`req` には論理式自身の要求値と**感度化条件**（§4.7）の両方が入る。
バックトラックのときは末尾を取り消し、種（主義務の要求値＋その感度化条件）から
`applied` を順に再適用して作業配列を復元する（§12）。

原因ノードへの値割り当ては履歴に残さない。取り消しのあとは、再構築された作業配列に
対して割り当てをやり直す。

### 3.7 不適切マーク `unsuitables[i]`

バックトラッキングで不適切とマークされた選択。

- `i < lnum`: 論理式番号
- `i >= lnum`: 原因ノードの値選択（turnsと同じエンコーディング）
- 値: `0`（適切）, `1`（不適切）

### 3.8 テスト不可能マーク `infeasibles[l]`

テスト不可能な論理式。

- `l`: 論理式番号
- 値: `""`（テスト可能）, または不可能理由の文字列

### 3.9 弱テストマーク `weaks[t]`

弱テスト条件（一意的カバレッジを持たない）。

- `t`: テスト条件番号
- 値: `0`（強テスト）, `1`（弱テスト＝削除対象）

### 3.10 `lnum`（論理式総数）

全ノードの論理式数の合計。原因ノードはゼロ、中間/結果ノードはそれぞれ `(入力数 + 1)` 個。

---

## 4. 論理式の抽出

### 4.1 概要

各ノード（中間ノード・結果ノード）の論理演算に対して、`(入力数 + 1)` 個の論理式を生成する。

- ANDノード: 1個の「全入力満足」式 + 入力数個の「1入力非満足」式
- ORノード: 入力数個の「1入力満足」式 + 1個の「全入力非満足」式

### 4.2 ノードの接続情報

各ノードは接続情報（`seq`）を持つ。これは各ノードについて:
1. 接続フラグ（このノードが入力か）
2. NOT（否定）フラグ

から構成される。

### 4.3 ANDノードの論理式生成

ANDノード `N` が入力 `I_0, I_1, ..., I_{n-1}` を持つ場合:

```
FUNCTION generateANDExpressions(node N, inputs I[0..n-1]) -> expressions[0..n]:

    // 式 0: 全入力が満足 → ノードT
    expressions[0]:
        FOR each input I[j]:
            IF I[j] is NOT-connected:
                expressions[0][I[j]] = "F"  // NOT付き: Fが満足
            ELSE:
                expressions[0][I[j]] = "T"  // NOT無し: Tが満足
        expressions[0][N] = "T"

    // 式 1〜n: i番目の入力が非満足、残りは満足 → ノードF
    FOR i = 1 TO n:
        // (i-1) 番目の入力が非満足
        target_input = i番目の入力（順番に対応）
        FOR each input I[j]:
            IF j == target_input:
                IF I[j] is NOT-connected:
                    expressions[i][I[j]] = "T"  // NOT付き: Tが非満足
                ELSE:
                    expressions[i][I[j]] = "F"  // NOT無し: Fが非満足
            ELSE:
                IF I[j] is NOT-connected:
                    expressions[i][I[j]] = "F"  // 残りは満足
                ELSE:
                    expressions[i][I[j]] = "T"  // 残りは満足
        expressions[i][N] = "F"
```

### 4.4 ORノードの論理式生成

ORノード `N` が入力 `I_0, I_1, ..., I_{n-1}` を持つ場合:

```
FUNCTION generateORExpressions(node N, inputs I[0..n-1]) -> expressions[0..n]:

    // 式 0〜n-1: i番目の入力が満足、残りは非満足 → ノードT
    FOR i = 0 TO n-1:
        target_input = i番目の入力
        FOR each input I[j]:
            IF j == target_input:
                IF I[j] is NOT-connected:
                    expressions[i][I[j]] = "F"  // NOT付き: Fが満足
                ELSE:
                    expressions[i][I[j]] = "T"  // NOT無し: Tが満足
            ELSE:
                IF I[j] is NOT-connected:
                    expressions[i][I[j]] = "T"  // NOT付き: Tが非満足
                ELSE:
                    expressions[i][I[j]] = "F"  // NOT無し: Fが非満足
        expressions[i][N] = "T"

    // 式 n: 全入力が非満足 → ノードF
    expressions[n]:
        FOR each input I[j]:
            IF I[j] is NOT-connected:
                expressions[n][I[j]] = "T"  // NOT付き: Tが非満足
            ELSE:
                expressions[n][I[j]] = "F"  // NOT無し: Fが非満足
        expressions[n][N] = "F"
```

### 4.5 論理式の番号付け

論理式はノードの走査順に通し番号が付けられる:
- ノード0の式0, 式1, ..., 式m_0
- ノード1の式0, 式1, ..., 式m_1
- ...

原因ノード（入力を持たないノード）は論理式を生成しない（`lnum = 0`）。

### 4.6 要求値の範囲

各論理式の `logics[l][k]` は、**そのノード自身と直接の入力ノード**のみに値を持つ。
他のノードのセルは `""` （無関係）となる。

**例**: `A AND B → I AND C → E` の場合（A,B,C=原因、I=中間、E=結果）

ノードIの論理式:
| 式番号 | A | B | C | I | E |
|--------|---|---|---|---|---|
| l=0 | T | T | | T | |
| l=1 | F | T | | F | |
| l=2 | T | F | | F | |

ノードEの論理式:
| 式番号 | A | B | C | I | E |
|--------|---|---|---|---|---|
| l=3 | | | T | T | T |
| l=4 | | | F | T | F |
| l=5 | | | T | F | F |

**注意**: 式l=3〜l=5にはA, Bの値がない（`""`）。これは、Eの論理式は
Eの直接入力（I, C）のみに関心があるためである。マージ時に矛盾がなければ、
間接的な整合性は `isPossible()` で検証される。

---

### 4.7 感度化条件

論理式は自ノードと直接の入力にしか値を持たない（§4.6）。その値を**結果ノードまで
届ける条件**は論理式の外にあるため、義務を果たすには論理式の要求値に加えて
感度化条件を課す。

#### 4.7.1 1ゲートの感度化

ノード `x` の値をゲート `g` に通すための、`x` 以外の入力への要求:

| `g` の種類 | `x` 以外の入力に課す値 |
|-----------|----------------------|
| AND | **満足**させる（NOT無しなら `T`、NOT有りなら `F`） |
| OR | **非満足**にする（NOT無しなら `F`、NOT有りなら `T`） |
| 単一入力・NOT | 追加条件なし |

これは §4.3／§4.4 の論理式生成規則と同じ形である。§4 はこの規則を1ゲート内に
適用しており、感度化はそれを経路全体に適用したものにあたる。

#### 4.7.2 経路の感度化

`x` から結果ノード `e` までの経路上の各ゲートに 4.7.1 を課したものが、その経路の
感度化条件である。同じノードに相反する値を要求する経路は成立しないため捨てる。

#### 4.7.3 経路の列挙順（決定性）

経路は**モデルのノード定義順に幅優先で列挙**し、成立した最初のものを採用する。
順序を定義順に固定することで、同一ソースからは同一の決定表が得られる（義務 J）。

結果ノード自身は、値を反転すれば必ず結果が変わるため、感度化条件を必要としない。
経路が1本も存在しないノードは、その値をどの入力でも観測できない（§13.4 の観測不能）。


## 5. メインループ

### 5.1 calcTABLE: テーブル生成のエントリポイント

決定表の生成は、義務集合（§1.4）を1つずつ果たしていく手続きである。

```
FUNCTION calcTable(model) -> AlgorithmState:

    expressions = extractExpressions(model)      // 義務 A の一覧（§4）
    IF expressions.length == 0: RETURN 空の state

    effects     = 結果ノードの一覧
    obligations = buildObligations(model, expressions)   // フェーズ0

    // === フェーズ1: 未達成の義務ごとに列を1本作る ===
    FOR each obligation o IN obligations:
        IF 既存のどれかの列が o を果たしている（完成形で判定）:
            CONTINUE
        column = buildColumn(model, state, o, effects)   // §6
        IF column == null:
            CONTINUE                                     // フェーズ6で分類する
        tests.append(column)

    // === フェーズ2: 制約完了（列を完成形にする）===
    FOR each test:
        deduceAllConstraints(test)
        applyAllMasks(test)

    // === フェーズ3: 実行入力として重複する列を落とす（義務 I）===
    // 同一性は T と t、F と f を同じ入力とみなして判定する（§2.2）

    // === フェーズ4: 完成形の列で論理式カバレッジを判定（§13.1）===
    FOR each test t, each expression l:
        covs[t][l] = 真偽が一致する AND observable(t, オーナーノード)

    // === フェーズ5: 弱テスト削除（義務 E、§14）===
    FOR each test t:
        weaks[t] = isRemovable(t)

    // === フェーズ6: 果たせなかった論理式を分類（義務 F、§13.4）===
    FOR each expression l WHERE どの非弱テストも果たしていない:
        IF 要求値が制約下で成立しない: infeasibles[l] = 違反した制約
        ELSE IF 感度化経路が1本もない:  unobservables[l] = "遮断"

    RETURN state
```

#### 義務リストの構築（フェーズ0）

```
FUNCTION buildObligations(model, expressions) -> Obligation[]:
    // モデル定義順に並べる（義務 J: 同一ソースから同一の結果）
    FOR each expression l:            append { kind: A, index: l }
    FOR each 原因ノード c WHERE 孤立でない:
        append { kind: B, cause: c, want: true }
        append { kind: B, cause: c, want: false }
    FOR each MASK 制約:               append { kind: C, constraint }
```

**結果網羅（旧フェーズ2「敗者復活」）は義務 B としてこのリストに含まれる。**
生成後に不足を補う特別扱いは行わない。

#### 義務を果たしたかの判定

| 義務 | 果たす条件 |
|------|-----------|
| A | 列が論理式の要求値を実現し、かつオーナーノードが観測可能（§2.5） |
| B | 列がその原因にその真偽を持ち、かつその原因が観測可能 |
| C | トリガーが満たされ、ターゲットの少なくとも1つが `M` |

判定は**完成形の列**（フェーズ2適用後）に対して行う。要求セルが `M` になった
論理式は、その列では検証されていない。

### 5.2 フェーズ間の関係

```
フェーズ0: 義務の一覧化
    └── A（論理式）・B（結果網羅）・C（MASK 実演）をモデル定義順に並べる

フェーズ1: 列の生成
    ├── 未達成の義務ごとに、その義務を主目的とする列を1本作る
    ├── 主義務の要求値 ＋ 感度化条件（§4.7）を置く
    └── 矛盾しない他の論理式を合流し、自由変数を埋める

フェーズ2: 制約完了（表示補完）
    └── 制約で一意に定まる値を充填し、MASK を適用して列を完成させる

フェーズ3: 重複列の除去
    └── 実行入力として同一の列を1本にする（義務 I）

フェーズ4: カバレッジ判定
    └── 完成形の列に対して §13.1 で判定する

フェーズ5: 弱テスト削除
    └── 担う義務がすべて他の列でも担われている列を削除する（義務 E）

フェーズ6: 分類と報告
    └── 果たせなかった論理式を 実行不可 / テスト不可 / 観測不能 に分類する
```

**フェーズ2がフェーズ4より前にあること**が重要である。制約完了で `M` や `T`/`F` が
入ると、その列が果たす義務が変わる。判定はテスターに渡す形の列に対して行う。

## 6. テスト条件生成 (buildColumn)

### 6.1 全体フロー

1本の列は、**ある1つの義務を果たすため**に作られる。その義務の要求値と、値を結果
ノードへ届ける感度化条件（§4.7）を同時に置くことで、観測可能性は構成的に満たされる。

```
FUNCTION buildColumn(model, state, o, effects) -> 列 or null:

    target = o が値を伝播させるノード（A ならオーナー、B なら原因、C なら無し）
    paths  = target == null ? [空] : sensitisationPaths(model, target, effects)

    FOR each path IN paths:                     // §4.7.3 の順序
        // --- 種にする要求値 ---
        seed = o の要求値 ∪ path の感度化条件
        IF seed 内で値が衝突: CONTINUE

        work = initWork(model)
        seed を work に置く（衝突すれば CONTINUE）

        // --- 制約の適用と整合性（義務 D）---
        applyAllMasks(work)
        全制約について deduceConstraint(work)
        IF checkConstr(work) != "" OR isPossible(work) != "": CONTINUE

        // --- 列を完成させる ---
        IF NOT completeColumn(work, state, model, effects, seed, applied): CONTINUE

        // --- 表明（§6.3）---
        IF NOT o が完成形の work で果たされている: CONTINUE

        RETURN work

    RETURN null      // どの経路でも作れない → §13.4 で分類する
```

### 6.2 completeColumn: 合流と自由変数

```
FUNCTION completeColumn(work, state, model, effects, seed, applied) -> BOOLEAN:
    FOR attempt = 0 TO lnum:
        applyAllMasks(work)
        mergeExpressions(work, mode=0)      // 未カバーの論理式を合流（§7）
        mergeExpressions(work, mode=1)      // カバー済みの論理式も合流

        FOR each 原因ノード c WHERE work[c] == "" AND 孤立でない:
            IF chooseCauseValue(work, c, "t"): CONTINUE
            IF chooseCauseValue(work, c, "f"): CONTINUE
            // 両方失敗 → 直近の合流を取り消して再試行（§12）
            直近の合流を applied から取り消し、work を種から再構築
            attempt をやり直す

        deduce(work, model)
        IF isPossible(work, model) == "": RETURN TRUE

        直近の合流を取り消して再試行
    RETURN FALSE
```

### 6.3 表明としての観測可能性チェック

感度化条件を要求値に含めているため、完成した列は主義務を観測できるはずである。
ただし**再収斂**（同じ値が複数経路で結果に届き互いに打ち消す）の場合のみ、条件を
満たしても観測できないことがある。この1点のために、完成形の列に §2.5 を適用して
確認し、偽であれば次の経路を試す。

これは修復手段ではなく、経路選択の打ち切り判定である。すべての経路で偽なら、その
義務は果たせないものとして §13.4 で分類する。

## 7. 論理式の選択とマージ (mergeExpressions)

### 7.1 アルゴリズム

合流候補は、自分の要求値と**自分のオーナーを観測するための感度化条件**を一緒に
持ち込む。したがって、他の義務の経路を閉じてしまう合流は、値の矛盾として自然に
拒否される。観測可能性のための専用ゲートは要らない。

```
FUNCTION mergeExpressions(work, state, model, effects, applied, mode):
    FOR each expression l:
        IF mode == 0 AND 他のテストで既にカバー済み: CONTINUE
        IF この列で既にカバー済み: CONTINUE
        IF 不適切マーク済み: CONTINUE
        IF 実行不可: CONTINUE

        paths = sensitisationPaths(model, l のオーナー, effects)
        IF paths が空: CONTINUE               // 結果に届かない → 検証できない

        FOR each path IN paths:
            req = l の要求値 ∪ path の感度化条件
            IF req 内で衝突: CONTINUE

            tmp = work のコピー
            req を tmp に置く（衝突すれば CONTINUE）
            applyAllMasks(tmp)
            全制約について deduceConstraint(tmp)
            IF checkConstr(tmp) != "" OR isPossible(tmp) != "": CONTINUE

            work = tmp
            vtestcov[l] = TRUE
            applied.append({ index: l, req })
            BREAK
```

### 7.2 マージの順序

論理式はノード走査順に試行される。感度化条件が加わったことで、先に合流した義務の
経路を塞ぐ候補は拒否されるようになった。順序は依然として最終的な値に影響するが、
**どの順序でも、採択された義務は観測可能なまま保たれる**。

### 7.3 実行不可の判定タイミング

論理式が実行不可であるかの判定は、フェーズ6（§5.1）でまとめて行う。
生成中の合流失敗は、その列に入らなかったことを意味するだけで、実行不可を意味しない。

## 8. 原因ノードへの値割り当て (chooseCauseValue)

### 8.1 アルゴリズム

```
FUNCTION chooseCauseValue(work, nodeIndex, value, lnum) -> BOOLEAN:
    // value は "t" または "f"（小文字）

    // 不適切チェック
    IF value is "T" or "t":
        IF unsuitables[lnum + 2 * nodeIndex] == 1:
            RETURN FALSE
    ELSE IF value is "F" or "f":
        IF unsuitables[lnum + 2 * nodeIndex + 1] == 1:
            RETURN FALSE

    // 一時配列で試行
    tmp = copy of work
    tmp[nodeIndex] = value

    // 演繹計算
    deduce(tmp)

    // 制約による演繹・検算
    FOR each constraint:
        IF constraint.deduceLogic(tmp) == FALSE:
            RETURN FALSE
        IF constraint.maskLogic(tmp) == FALSE:
            RETURN FALSE

    // 制約不整合チェック
    IF checkConstr(tmp) != "":
        RETURN FALSE

    // 論理関係不整合チェック
    IF isPossible(tmp) != "":
        RETURN FALSE

    // 成功: 作業配列に反映
    work[nodeIndex] = value

    // turnsへの記録（注: 大文字チェックのため小文字では記録されない）
    IF value == "T":
        turns.append(lnum + nodeIndex * 2)
    ELSE IF value == "F":
        turns.append(lnum + nodeIndex * 2 + 1)

    RETURN TRUE
```

### 8.2 注意点: turnsへの記録

`chooseCauseValue()` は `nextCondition()` から `"t"` / `"f"`（小文字）で呼び出される。
しかし、turnsへの記録は `"T"` / `"F"`（大文字）チェックで行われるため、
**通常のテスト条件生成では原因値はturnsに記録されない**。

敗者復活フェーズでは、呼び出し側が明示的にturnsに記録する。

---

## 9. 値伝播 (deduce / deduceValue)

### 9.1 deduce: 全ノードの伝播

```
FUNCTION deduce(src):
    FOR each node i:
        IF src[i] != "":
            CONTINUE  // 既に値がある
        deduceValue(src, i)
```

> **注**: `deduce` は論理式を持つノード（中間・結果）の入力からの伝播のみを行い、
> 制約(ONE 等)による原因値の確定は行わない。制約で一意に定まるが未参照の原因は
> `''` のまま残る。これはテスト確定後のフェーズ4（制約完了, §5.1）で埋める。

### 9.2 deduceValue: 1ノードの値推論

```
FUNCTION deduceValue(src, nodeIndex):
    node = nodes[nodeIndex]
    IF node has no operator or no connections:
        RETURN

    IF node.op == "AND":
        isImpossible = FALSE
        FOR each input i of node:
            IF src[i] == "":
                deduceValue(src, i)  // 再帰的に入力を解決

            satisfyValue = (NOT-connected ? "F"/"f" : "T"/"t")
            nonSatisfyValue = (NOT-connected ? "T"/"t" : "F"/"f")

            IF src[i] is nonSatisfyValue:
                src[nodeIndex] = "f"  // 短絡: 1つの非満足でAND=偽
                RETURN
            IF src[i] is "M" or "I":
                isImpossible = TRUE

        IF isImpossible:
            src[nodeIndex] = "I"
        ELSE:
            src[nodeIndex] = "t"  // 全入力が満足

    ELSE IF node.op == "OR":
        isImpossible = FALSE
        FOR each input i of node:
            IF src[i] == "":
                deduceValue(src, i)

            satisfyValue = (NOT-connected ? "F"/"f" : "T"/"t")

            IF src[i] is satisfyValue:
                src[nodeIndex] = "t"  // 短絡: 1つの満足でOR=真
                RETURN
            IF src[i] is "M" or "I":
                isImpossible = TRUE

        IF isImpossible:
            src[nodeIndex] = "I"
        ELSE:
            src[nodeIndex] = "f"  // 全入力が非満足
```

### 9.3 重要: 出力値は常に小文字

`deduceValue()` は常に小文字 (`"t"`, `"f"`) または `"I"` を出力する。
大文字 (`"T"`, `"F"`) は設定しない。

---

## 10. 論理整合性チェック (isPossible / checkRelation)

### 10.1 isPossible

全ノードについて `checkRelation()` を呼び、1つでも不整合があれば不可能と判定する。

```
FUNCTION isPossible(src) -> reason:
    FOR each node i:
        IF checkRelation(src, i) == FALSE:
            RETURN node i の式の説明（不整合理由）
    RETURN ""  // 整合
```

### 10.2 checkRelation

ノードの値が、その入力ノードの値と論理的に整合するかを検証する。

```
FUNCTION checkRelation(src, nodeIndex) -> BOOLEAN:
    node = nodes[nodeIndex]

    IF src[nodeIndex] == "":
        RETURN TRUE  // 未設定なら整合
    IF node has no operator:
        RETURN TRUE  // 原因ノードなら整合

    IF node.op == "AND":
        expect = ""
        unknown = 0
        mask = 0

        FOR each input i of node:
            IF input is NOT-connected:
                IF src[i] is "T"/"t": expect = "F"; BREAK  // 非満足発見
                IF src[i] is "M": mask++
                IF src[i] is "F"/"f": expect = "T"         // 満足
                IF src[i] is "": unknown++
            ELSE:
                IF src[i] is "F"/"f": expect = "F"; BREAK  // 非満足発見
                IF src[i] is "M": mask++
                IF src[i] is "T"/"t": expect = "T"         // 満足
                IF src[i] is "": unknown++

        // ノード値T/tなのに入力からFが期待される → 不整合
        IF src[nodeIndex] is "T"/"t" AND expect == "F" AND unknown == 0:
            RETURN FALSE
        // ノード値F/fなのに入力からTが期待される → 不整合
        IF src[nodeIndex] is "F"/"f" AND expect == "T" AND unknown == 0:
            RETURN FALSE
        // ノード値Mなのに確定値がある → 不整合
        IF src[nodeIndex] == "M":
            IF unknown == 0 AND mask == 0:
                RETURN FALSE  // 全入力確定なのにM
            IF expect == "F":
                RETURN FALSE  // 確定的にFなのにM

        RETURN TRUE

    ELSE IF node.op == "OR":
        // ANDと対称的なロジック
        // 満足入力発見 → expect = "T" (BREAK)
        // 非満足入力のみ → expect = "F"
        // 同様の整合性チェック
        (ANDと対称的に実装)
        RETURN TRUE
```

---

## 11. 制約処理

### 11.1 制約の種類

| 制約 | 意味 | メンバー |
|------|------|---------|
| ONE | メンバーの中でちょうど1つが真 | 2個以上のノード |
| EXCL | メンバーの中で最大1つが真（排他） | 2個以上のノード |
| INCL | メンバーの中で少なくとも1つが真（包含） | 2個以上のノード |
| REQ | トリガーが真ならターゲットも真（要求） | トリガー1個 + ターゲット1個以上 |
| MASK | トリガーが真ならターゲットをマスク | トリガー1個 + ターゲット1個以上 |

制約メンバーにはNOT（否定）を付けることができる。NOT付きの場合、「真」の判定が反転する:
- NOT無し: T/t が「満足」
- NOT有り: F/f が「満足」

**方向性制約のNOT制限**:
- REQ: ソース側またはターゲット側のいずれかにNOT可。**両方同時は禁止**（意味が曖昧になるため）。
  - `REQ(A -> B)`: A=T ならば B=T
  - `REQ(NOT A -> B)`: A=F ならば B=T
  - `REQ(A -> NOT B)`: A=T ならば B=F
  - `REQ(NOT A -> NOT B)`: **禁止**
- MASK: トリガー側のみNOT可。ターゲット側はNOT禁止（M値は否定しても変わらないため無意味）。
  - `MASK(A -> B)`: A=T ならば B=M（マスク）
  - `MASK(NOT A -> B)`: A=F ならば B=M（マスク）

### 11.2 制約演繹 (deduceLogic)

制約に基づいて、未設定ノードの値を自動的に決定する。
**制約演繹で設定される値は大文字 (`"T"`, `"F"`) である。**

#### ONE制約

```
FUNCTION deduceONE(src):
    ondata = 0  // 満足メンバー数
    nodata = 0  // 未設定メンバー数

    FOR each member m:
        IF m is 満足: ondata = 1; BREAK
        IF src[m] == "": nodata++

    IF ondata == 1:
        // 1つ満足 → 残りは全て非満足
        FOR each member m:
            IF src[m] == "":
                src[m] = 非満足値 (大文字 "T" or "F")

    IF nodata == 1:
        // 残り1つ → それが満足
        FOR each member m:
            IF src[m] == "":
                src[m] = 満足値 (大文字 "T" or "F")
                BREAK
```

#### EXCL制約

```
FUNCTION deduceEXCL(src):
    // ONEと同様だが、最後の1つを強制的に満足にはしない
    IF 1つが満足:
        残りの未設定メンバーを非満足に (大文字)
```

#### INCL制約

```
FUNCTION deduceINCL(src):
    ondata = 0   // 満足メンバー数
    nodata = 0   // 未設定メンバー数

    FOR each member m:
        IF m is 満足: ondata++
        IF src[m] == "": nodata++

    IF ondata == 0 AND nodata == (nodeCount - 1):
        // 全メンバーが非満足で、残り1つが未設定
        // → 最後の1つを満足に設定
        FOR each member m:
            IF src[m] == "":
                src[m] = 満足値 (大文字)
```

**注意**: CEGTest 1.6のINCL制約の発動条件 `nodata == (nodeCount - 1)` は
全ノード数（制約メンバー数ではなく）に基づいている。

**INCL敗者復活について（設計検討: Issue #7, 2026-02-28）**:

秋山浩一氏のフィードバックにより、INCL制約の「敗者復活」メカニズムの
実装を検討した（参照: https://note.com/akiyama924/n/n9b1d485d0c4b ）。

敗者復活とは、INCL制約によりテスト不可能（infeasible）となった論理式に
対して、INCLメンバー1つを非満足→満足に反転した代替テストを生成する
手法である。例えば INCL(A,B,C) の下で論理式「D=T, A=F, B=F, C=F → OR=T」
がテスト不可能な場合、Cを F→T に反転して「D=T, C=T → OR=T」という
代替テストを生成する。

検討の結果、以下の理由から当面の実装を見送る判断とした:

1. **効果が限定的**: 敗者復活テストは元の論理式を厳密にはカバーしない
   （どの入力が結果に影響しているか特定できない）。秋山氏自身も
   「敗者復活したテストケースは他のテストケースよりも優先度は下がった
   テストとなります」と述べている。
2. **既存のフェーズ2（結果網羅）が代替手段を提供**: INCL不可能な論理式の
   キー入力（例: D=T）が他のテストに出現しない場合、フェーズ2が
   T/F両方の出現を保証するテストを自動生成する。敗者復活よりも精度は
   低い（全原因がTになりがち）が、テスト自体は存在する。
3. **実装の複雑性とバグリスク**: 秋山氏も「会社でつくった原因結果グラフの
   ツールでは実装したのですが、かなり複雑なロジックとなってしまい、
   それはそれで問題（ツールに実装したロジック自体にバグがある可能性が
   ある）」と述べている。CEGTest 1.6でも未実装である。
4. **カバレッジ表との整合性**: 敗者復活テストはisCoveredByがfalseとなるため、
   カバレッジ表上での表現が困難であり、弱テスト削除との整合性確保にも
   追加の仕組み（revivals[]フラグ等）が必要となる。

将来的に実装する場合は、フェーズ1（論理式網羅）とフェーズ2（結果網羅）
の間に「フェーズ1.5: INCL敗者復活」を追加する設計が妥当と考えられる。

#### REQ制約

```
FUNCTION deduceREQ(src):
    // トリガーが満足かチェック
    IF trigger is 満足:
        FOR each target:
            IF src[target] == "":
                src[target] = 指定値 (大文字 "T" or "F")
```

### 11.3 MASK制約 (maskLogic)

```
FUNCTION maskLogic(src) -> BOOLEAN:
    IF trigger is 満足:
        FOR each target:
            IF src[target] != "" AND src[target] != "M":
                RETURN FALSE  // 既に確定値がある → 矛盾
            src[target] = "M"
    RETURN TRUE
```

### 11.4 制約検証 (checkConstr)

制約違反を検出する。

```
FUNCTION checkConstr(src) -> reason:
    work = copy of src

    // まずMASK適用
    FOR each constraint:
        constraint.maskLogic(work)

    // 演繹・検証
    FOR each constraint:
        constraint.deduceLogic(work)
        reason = constraint.checkConstraint(work)
        IF reason != "":
            RETURN reason

    RETURN ""
```

#### checkConstraint (個別制約の違反チェック)

```
FOR ONE/EXCL/INCL:
    count = 満足メンバー数
    blank = 未設定メンバー数
    mask = Mメンバー数

    ONE違反: mask==0 AND (count==0 AND blank==0) OR count>1
    EXCL違反: mask==0 AND count>1
    INCL違反: mask==0 AND count==0 AND blank==0

FOR REQ:
    IF trigger is 満足:
        FOR each target:
            IF target is 非満足:
                RETURN 違反

FOR MASK:
    IF trigger is 満足:
        FOR each target:
            IF src[target] is not "M" and not "":
                RETURN 違反
```

---

## 12. バックトラッキング

### 12.1 概要

列の生成中に行き詰まったときは、**直近の合流**を取り消して続きをやり直す。
行き詰まりは2種類ある。

| 場面 | 対処 |
|------|------|
| 自由変数に `t` も `f` も置けない（§6.2） | 直近の合流を取り消す |
| 完成した条件が `isPossible` を満たさない（§6.2） | 直近の合流を取り消す |

取り消した論理式は不適切としてマークし、この列では再び合流しない。
`applied` が空のときは、その主義務ではこの経路で列を作れないため、次の感度化経路を
試す（§6.1）。すべての経路で作れなければ、その義務は §13.4 で分類する。

### 12.2 バックトラック処理

```
bad = applied.pop()
vtestcov[bad.index] = FALSE
unsuitableExpressions.add(bad.index)
rebuildColumn(work, seed, applied)
```

### 12.3 rebuildColumn: 作業配列の再構築

```
FUNCTION rebuildColumn(work, seed, applied):
    work の全セルを "" にする
    seed の値を置く                        // 主義務の要求値 ＋ 感度化条件
    FOR each a IN applied:
        a.req の値のうち、空のセルだけを埋める
```

種を先に置くことで、主義務の要求と感度化条件は取り消しの対象にならない。
その列が存在する理由そのものだからである。

## 13. カバレッジ表の生成

### 13.1 カバレッジの判定

各論理式 `l` に対して、各テスト条件 `t` がカバーするかを判定する。
判定は**実行されるテストの性質**として行い（§2.2）、値の由来（大文字/小文字）は問わない。
さらに、その列でオーナーノードが**観測可能**であることを要する（§2.5）。

```
FUNCTION isCoveredBy(expressionIndex l, testIndex t) -> BOOLEAN:
    FOR k = 0 TO nodeCount - 1:
        IF tests[t][k] != "" AND logics[l][k] != "":
            IF 真偽が一致しない:          // "T" と "t"、"F" と "f" は一致
                RETURN FALSE
    RETURN observable(tests[t], model, ownerNode(l))
```

**判定対象は完成形の列**: 制約完了と MASK 適用（§5.1 フェーズ4）を施した後の値で
判定する。要求セルが `M` になった論理式は、その列では検証されていない。

### 13.2 カバレッジシンボル

各論理式について、テスト条件の順序（左から右）に基づきシンボルを決定する。
各論理式をカバーする**最初の非弱テスト**が `#`（初回カバレッジ）、
それ以降のカバーテストが `x`（追加カバレッジ）となる:

```
FOR each expression l:
    firstCovered = FALSE
    FOR each test t (テスト順、左から右):
        IF covs[t][l] == 0:
            表示[t][l] = (空白)   // このテストはこの式をカバーしていない
        ELSE IF weaks[t] == 1:
            表示[t][l] = "x"      // 弱テストは常に追加カバレッジ
        ELSE IF NOT firstCovered:
            表示[t][l] = "#"      // 初回カバレッジ（この式を初めてカバーした非弱テスト）
            firstCovered = TRUE
        ELSE:
            表示[t][l] = "x"      // 追加カバレッジ（既に別テストでカバー済み）
```

### 13.3 シンボルの意味

| シンボル | 名称 | 意味 |
|---------|------|------|
| `#` | 初回カバレッジ | この論理式を**初めてカバーした**非弱テスト条件（各論理式につき1つ） |
| `x` | 追加カバレッジ | この論理式を**追加で**カバーしたテスト条件（既にカバー済み） |
| (空白) | 未カバー | このテスト条件はこの論理式をカバーしていない |

**活用方法**: カバレッジ表を**縦方向に集計**し、`#` が多いテスト条件から
優先的にテストすることで、効率的なテスト実行順序を決定できる。
`#` が多いテスト条件ほど、新たな論理式を多くカバーしている。

**注意**: `#` / `x` は表示上のシンボルであり、弱テスト削除の判定（§14）は
別のロジック（式を唯一カバーするテストの有無）で行う。

### 13.4 実行不可（Infeasible）とテスト不可（Untestable）の区別

カバレッジ表では、カバーされない論理式を以下の2種類に区別する。

#### 13.4.1 定義

| 種類 | 英語 | 意味 | 例 |
|------|------|------|-----|
| **実行不可** | Infeasible | 制約により論理的に成立し得ない組み合わせ。テスト自体を実行できない | ONE(A,B) で A=F かつ B=F |
| **テスト不可** | Untestable | テストは実行できるが、MASK制約により入力が不定(M)となり、結果の正しさを判断できない | MASK(C→A,B) で C=T のとき A=M, B=M |
| **観測不能** | Unobservable | 実行でき値も作れるが、どの実行可能入力でも結果ノードに伝播せず、合否を判定できない | `I := A AND B`, `E := I OR C` で、どの入力でも C=T により I が覆われる場合 |

参考: 秋山浩一「ソフトウェアテストしようぜ」第236回

#### 13.4.2 テスト不可の判定アルゴリズム

ある論理式が「テスト不可」であるかを判定するため、**緩和カバレッジ判定**を使用する。
通常のカバレッジ判定（§13.1）は大文字/小文字を厳密に比較するが、
緩和判定ではM（マスク）およびI（不定）の値をワイルドカード（任意の値に合致）として扱う。

```
FUNCTION isRelaxedCoveredBy(expressionIndex l, testIndex t) -> BOOLEAN:
    FOR k = 0 TO nodeCount - 1:
        IF tests[t][k] == "M" OR tests[t][k] == "I":
            CONTINUE    // M, I はワイルドカードとして無視
        IF tests[t][k] != "" AND logics[l][k] != "":
            IF tests[t][k] != logics[l][k]:
                RETURN FALSE
    RETURN TRUE
```

論理式の状態判定:

```
FOR each expression l:
    IF infeasibles[l] != null:
        状態 = "実行不可"    // 制約違反で実行不可能
    ELSE IF いずれかの非弱テストがカバー (§13.1: 真偽一致 かつ 観測可能):
        状態 = "カバー済"    // 正常にカバーされている
    ELSE IF いずれかの非弱テストが緩和カバー:
        状態 = "テスト不可"  // MASKにより検証不能
    ELSE IF どの実行可能入力でもオーナーノードが観測可能にならない:
        状態 = "観測不能"    // 実行はできるが結果に伝播せず合否判定できない
    ELSE:
        状態 = "未カバー"    // 生成された列に含まれていない（漏れ）
```

#### 13.4.3 カバレッジ表での表示

| 状態 | 備考欄 | カバレッジセル | 行スタイル |
|------|--------|-------------|----------|
| カバー済 | (空白) | `#` / `x` / 空白 | 通常 |
| 実行不可 | 理由表示（赤） | `!`（エクスクラメーション） | 灰色背景 |
| テスト不可 | "MASK" 表示（橙） | `?`（クエスチョン） | 薄黄色背景 |
| 観測不能 | "遮断" 表示（橙） | `>`（大なり） | 薄橙色背景 |
| 未カバー | (空白) | 空白 | 通常 |

**記号の区別**:
- `!`（エクスクラメーション）: 実行不可。制約違反のため、このテスト条件は実行できない
- `?`（クエスチョン）: テスト不可。テストは実行できるが、MASK により結果が不明

> **`-` を使わない理由**: `-`（ハイフン）はデシジョンテーブルの「不問(don't-care)」
> に割り当てる（§15.2、DT の教科書標準）。カバレッジ表とデシジョンテーブルで
> 同じ字形が別の意味を持たないよう、実行不可には `!` を用いる。`x`（追加カバレッジ,
> §13.3）との混同を避けるため `✗`/`×` ではなく `!` とした（ASCII で CSV でも安全）。

#### 13.4.4 デシジョンテーブルとの関係

秋山氏の提言に基づき、テスト不可のテスト条件（M値を含む列）は
デシジョンテーブルから除外せず残す。ただし、テスト不可であることが
ユーザーに伝わるように表示する（§15参照）。

テスト不可の列はテスト対象の故障を発見するために有用である:
テスターは結果がユーザーに受け入れられるものかどうかで合否を判断する。

---

## 14. 弱テスト削除 (isRemovable)

### 14.1 概要

担っている義務がすべて他の列でも担われている列は削除する。判定対象は
**義務 A・B・C のすべて**であり（§1.4）、種類ごとの特別扱いはない。

| 義務 | この列が担っているか |
|------|--------------------|
| A 論理式網羅 | 論理式を実現し、オーナーノードが観測可能（§13.1） |
| B 結果網羅 | ある原因にその真偽を持ち、その原因が観測可能 |
| C 制約の実演 | MASK のトリガーが満たされ、ターゲットが `M` |

論理式のカバレッジ、結果網羅、MASK の実演は、いずれもこの1つの規則から出る。
以前の版にあった「論理式を1つもカバーしない列は残す」「MASK 実演を特別に保護する」
といった個別の分岐は不要になった。

### 14.2 アルゴリズム

```
FUNCTION isRemovable(testIndex, state, model, obligations, effects) -> BOOLEAN:
    mine = obligations のうち tests[testIndex] が担っているもの

    FOR each o IN mine:
        coveredElsewhere = FALSE
        FOR each test t WHERE t != testIndex AND weaks[t] == FALSE:
            IF tests[t] が o を担っている:
                coveredElsewhere = TRUE
                BREAK
        IF NOT coveredElsewhere:
            RETURN FALSE      // この義務の担い手が消える → 削除しない

    RETURN TRUE               // すべて他の列が担っている → 削除できる
```

判定は**その列が担っている義務だけ**を見る。どの列も担っていない義務があっても、
それを理由に他の列を削除不可にはしない。担い手のいない義務の有無は、削除可否とは
別の問題（§13.4 の分類と報告）である。

削除は先頭から順に行い、既に弱と判定した列は担い手として数えない。

### 14.3 注意: 戻り値の向き

- `isRemovable` が `TRUE`: この列は**弱テスト**（削除する）
- `isRemovable` が `FALSE`: この列は**強テスト**（残す）

### 14.4 MASK 実演の扱い

MASK 制約が機能していること（トリガー真 → ターゲット不問）を示す列は、
義務 C として §14.2 の一般規則で保護される。実演する列が1本しかなければ、
その列は「担い手が消える」ため削除されない。

MASK のトリガーはどの論理式にも現れない孤立原因であることが多く、論理式カバレッジ
だけを見ていた頃は弱テスト削除で失われていた。義務 C を明示したことで、この保護は
一般規則の帰結になった。

## 15. デシジョンテーブルの表示

### 15.1 テーブル構造

```
デシジョンテーブル
┌──────┬───────┬──┬──┬──┬──┬──┬──┬──┐
│ 区分 │ ノード│#1│#2│#3│#4│#5│#6│#7│
├──────┼───────┼──┼──┼──┼──┼──┼──┼──┤
│ 原因:│ ノード│値│値│値│値│値│値│値│
│      │ ...   │  │  │  │  │  │  │  │
├──────┼───────┼──┼──┼──┼──┼──┼──┼──┤
│ 中間:│ ノード│値│値│値│値│値│値│値│
│      │ ...   │  │  │  │  │  │  │  │
├──────┼───────┼──┼──┼──┼──┼──┼──┼──┤
│ 結果:│ ノード│値│値│値│値│値│値│値│
│      │ ...   │  │  │  │  │  │  │  │
└──────┴───────┴──┴──┴──┴──┴──┴──┴──┘
```

### 15.2 表示される値

デシジョンテーブルには `tests[t][k]` の値がそのまま表示される:
- `T`: 明示的真（論理式定義・制約演繹由来）
- `t`: 推論的真（演繹計算・原因割り当て由来）
- `F`: 明示的偽
- `f`: 推論的偽
- `M`: マスク（MASK制約により値が不定）
- `I`: 不定（入力が M のため真偽を決定できない。§13.4参照）
- `-`: 不問（don't-care）。制約でも一意に決まらない原因のセル。DT の教科書標準記号。

**空値 `''` と `-` の扱い**: フェーズ4の制約完了（§5.1）により、制約で一意に
定まる原因は `T`/`F` で充填される。それでも残る `''` は「どの値でも結果が
変わらない」真の don't-care であり、表示層は **`-`**（ハイフン）に置換する。
- `-` はデシジョンテーブルの「不問」を表す（Myers 他 DT の慣習）。
- この `-` は**カバレッジ表の記号ではない**。カバレッジ表の「実行不可」は `!` を
  用いる（§13.4.3）ため、両表で `-` が別の意味を持つ衝突は起きない。
- フェーズ4が無いと、制約で確定する原因まで `''` のまま `-` に化け、「不問」と
  「制約で確定」が区別できなくなる。フェーズ4は**確定分を T/F で埋め、真の
  不問だけを `-` に残す**ためにある。

弱テスト（`weaks[t] == 1`）はテーブルに表示しない。

**テスト不可の列**: M や I を含む列はテスト不可であるが、
デシジョンテーブルから除外せず残す（§13.4.4参照）。
テスト不可であることがユーザーに伝わるよう、ヘッダーにバッジを表示する。

---

## 16. カバレッジ表の表示

### 16.1 カバレッジ表構造

```
カバレッジ表
┌───────┬──┬──┬──┬───┬──┬──┬──┬──┬──┬──┬──┬────┐
│ 論理式│n1│n2│n3│...│#1│#2│#3│#4│#5│#6│#7│備考│
├───────┼──┼──┼──┼───┼──┼──┼──┼──┼──┼──┼──┼────┤
│論理式1│T │T │  │ T │# │  │  │  │  │  │  │    │
│論理式2│F │T │  │ F │  │# │  │  │  │  │  │    │
│論理式3│F │F │  │ F │  │  │  │  │  │  │  │ONE │  ← 実行不可
│論理式4│  │  │T │ T │  │  │  │? │  │  │  │MASK│  ← テスト不可
│ ...   │  │  │  │   │  │  │  │  │  │  │  │    │
└───────┴──┴──┴──┴───┴──┴──┴──┴──┴──┴──┴──┴────┘
```

### 16.2 論理式の値列

各論理式の要求値（`logics[l][k]`）を表示する。
値は常に大文字 (`"T"`, `"F"`) または空白 (`""`)。

### 16.3 カバレッジ列

各テスト条件について `#`、`x`、`!`、`?`、または空白を表示する（§13.2, §13.4参照）。

### 16.4 論理式の状態表示

論理式の状態に応じて表示が異なる（§13.4参照）:

| 状態 | 行スタイル | カバレッジセル | 備考欄 |
|------|----------|-------------|--------|
| **カバー済** | 通常 | `#` / `x` / 空白 | (空白) |
| **実行不可** (Infeasible) | 灰色背景 | `!`（エクスクラメーション） | 制約名（赤） |
| **テスト不可** (Untestable) | 薄黄色背景 | `?`（クエスチョン） | "MASK"（橙） |
| **未カバー** | 通常 | 空白 | (空白) |

**実行不可**: 制約違反（ONE, EXCL等）により、この論理式の要求値の組み合わせは
論理的に成立し得ない。テスト自体を実行できない。

**テスト不可**: MASK制約により入力ノードが不定(M)となり、中間・結果ノードが
不定(I)となるため、テストは実行できるが結果の正しさを判断できない。
テスト不可の列はデシジョンテーブルに残し、テスターの判断に委ねる（§13.4.4参照）。

---

## 付録A: CEGTest 1.6のバグ一覧

### A.1 MASK制約による論理演算のバグ

M値を含むAND/OR演算が不正確。§2.4参照。

### A.2 INCL制約のdeduceLogicの条件

`nodata == (nodeCount - 1)` は全ノード数に基づいている。
制約メンバー数に基づくべきと思われるが、CEGTest 1.6の挙動として記録。

### A.3 chooseCauseValueのturns記録

小文字 `"t"`/`"f"` で呼び出されるが、大文字 `"T"`/`"F"` でturns記録の条件判定が
行われるため、通常のテスト条件生成では原因値がturnsに記録されない。§8.2参照。

---

**作成日**: 2026-02-05
**更新日**: 2026-09-02（決定表の正しさを義務集合として定義: §1.4。観測可能性を導入し「果たす」の定義に組み込み: §2.5。カバレッジ判定を実行されるテストの性質に変更し大文字小文字を問わないものに: §2.2 / §13.1。感度化条件を新設: §4.7。生成を義務単位のパイプラインに再構成: §5.1 / §5.2 / §6 / §7 / §12。弱テスト削除を義務 A∪B∪C の単一規則に統合し、旧フェーズ2「敗者復活」と MASK 実演保護をその帰結に: §14。観測不能状態と記号 `>` を追加: §13.4。合流履歴を `applied[]` に: §3.6）
**作成者**: Claude (AI Assistant)
**レビュー状態**: レビュー待ち

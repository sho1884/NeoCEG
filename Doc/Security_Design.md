# NeoCEG Security Design / セキュリティ設計

| Item / 項目 | Content / 内容 |
|------|---------|
| Document / 文書 | Security Design / セキュリティ設計 |
| Version / バージョン | 0.1 (Draft / ドラフト) |
| Created / 作成日 | 2026-02-01 |
| Reference / 参照 | OWASP Top 10 (2021) |

---

## 1. Overview / 概要

This document defines security design guidelines for NeoCEG based on OWASP Top 10 (2021).
本文書はOWASP Top 10 (2021)に基づくNeoCEGのセキュリティ設計指針を定義する。

### 1.1 System Characteristics / システム特性

| Characteristic / 特性 | Current State / 現状 |
|----------------------|---------------------|
| Data Storage / データ保存 | LocalStorage (browser-local) / ローカルストレージ（ブラウザローカル） |
| Authentication / 認証 | None (future consideration) / なし（将来検討） |
| Backend / バックエンド | None (static site on Vercel) / なし（Vercel上の静的サイト） |
| External API / 外部API | None (future: GraphViz MCP) / なし（将来：GraphViz MCP） |

### 1.2 Threat Model / 脅威モデル

| Threat / 脅威 | Risk Level / リスクレベル | Mitigation / 対策 |
|--------------|-------------------------|------------------|
| XSS (Cross-Site Scripting) | Medium / 中 | Input sanitization, CSP / 入力サニタイズ、CSP |
| DSL Injection | Medium / 中 | Parser validation / パーサー検証 |
| Dependency vulnerabilities / 依存関係の脆弱性 | Medium / 中 | Regular updates, audit / 定期更新、監査 |
| Data tampering in LocalStorage / LocalStorageの改ざん | Low / 低 | Integrity check (optional) / 整合性チェック（任意） |

---

## 2. OWASP Top 10 Mapping / OWASP Top 10 マッピング

### A01:2021 – Broken Access Control / アクセス制御の不備

**Relevance / 関連性**: Low (no authentication currently)
**現状**: 認証なしのため関連性低

**Future Considerations / 将来の考慮事項**:
- If cloud sync is added, implement proper authorization
- クラウド同期追加時は適切な認可を実装

---

### A02:2021 – Cryptographic Failures / 暗号化の失敗

**Relevance / 関連性**: Low (no sensitive data transmission)
**現状**: 機密データ送信なしのため関連性低

**Design Decisions / 設計決定**:
- HTTPS enforced via Vercel (automatic)
- Vercel経由でHTTPS強制（自動）

---

### A03:2021 – Injection / インジェクション

**Relevance / 関連性**: **High** (DSL parsing, React rendering)
**現状**: **高**（DSLパース、Reactレンダリング）

#### 3.1 DSL Parser Security / DSLパーサーセキュリティ

```typescript
// BAD: Unsafe eval-based parsing
const result = eval(dslInput); // NEVER DO THIS

// GOOD: Safe parser with validation
const parseResult = parseDSL(dslInput);
if (parseResult.errors.length > 0) {
  // Handle syntax errors safely
}
```

**Rules / ルール**:
1. Never use `eval()` or `Function()` constructor with user input
   - `eval()` や `Function()` コンストラクタをユーザー入力で使用しない
2. Use a proper lexer/parser (e.g., generated from grammar)
   - 適切なレクサー/パーサーを使用（文法から生成）
3. Validate all node names against allowlist pattern
   - ノード名を許可パターンで検証

```typescript
// Node name validation
const NODE_NAME_PATTERN = /^[a-zA-Z_\u3040-\u9FFF][a-zA-Z0-9_\u3040-\u9FFF]*$/;

function isValidNodeName(name: string): boolean {
  return NODE_NAME_PATTERN.test(name) && name.length <= 100;
}
```

#### 3.2 XSS Prevention / XSS防止

```typescript
// React automatically escapes JSX content (safe)
<div>{nodeLabel}</div>

// BAD: Dangerous HTML insertion
<div dangerouslySetInnerHTML={{ __html: userInput }} />

// If HTML is needed, use DOMPurify
import DOMPurify from 'dompurify';
const sanitized = DOMPurify.sanitize(userInput);
```

**Rules / ルール**:
1. Never use `dangerouslySetInnerHTML` with user input
   - ユーザー入力で `dangerouslySetInnerHTML` を使用しない
2. Sanitize any user content before rendering
   - レンダリング前にユーザーコンテンツをサニタイズ
3. Use React's built-in escaping for text content
   - テキストコンテンツにはReactの組み込みエスケープを使用

---

### A04:2021 – Insecure Design / 安全でない設計

**Relevance / 関連性**: Medium
**現状**: 中

**Secure Design Principles / セキュア設計原則**:

1. **Input Validation at Boundaries / 境界での入力検証**
   ```
   User Input → Validation → Internal Processing
   DSL Import → Parser Validation → Graph Model
   File Upload → Format Validation → Processing
   ```

2. **Fail Securely / 安全な失敗**
   - On parse error: Show error, don't process
   - On invalid state: Reset to last valid state
   - パースエラー時：エラー表示、処理しない
   - 無効状態時：最後の有効状態にリセット

3. **Defense in Depth / 多層防御**
   ```
   Layer 1: CSP (Content Security Policy)
   Layer 2: Input validation
   Layer 3: Output encoding (React default)
   Layer 4: Subresource Integrity (SRI)
   ```

---

### A05:2021 – Security Misconfiguration / セキュリティ設定ミス

**Relevance / 関連性**: **High** (Vercel deployment)
**現状**: **高**（Vercelデプロイ）

#### 5.1 Vercel Configuration / Vercel設定

Create `vercel.json`:
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        },
        {
          "key": "Referrer-Policy",
          "value": "strict-origin-when-cross-origin"
        },
        {
          "key": "Permissions-Policy",
          "value": "camera=(), microphone=(), geolocation=()"
        }
      ]
    }
  ]
}
```

#### 5.2 Content Security Policy (CSP) / コンテンツセキュリティポリシー

```json
{
  "key": "Content-Security-Policy",
  "value": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; frame-ancestors 'none';"
}
```

**Note / 注意**: `'unsafe-inline'` for styles may be needed for React Flow. Consider using nonce-based CSP in production.
スタイルの `'unsafe-inline'` はReact Flowで必要な場合あり。本番ではnonce-basedCSPを検討。

#### 5.3 Environment Variables / 環境変数

```bash
# .env.local (never commit)
# VERCEL_TOKEN should be in Vercel dashboard, not in code

# .gitignore must include:
.env
.env.local
.env*.local
```

---

### A06:2021 – Vulnerable and Outdated Components / 脆弱で古いコンポーネント

**Relevance / 関連性**: **High**
**現状**: **高**

#### 6.1 Dependency Management / 依存関係管理

**package.json scripts**:
```json
{
  "scripts": {
    "audit": "npm audit",
    "audit:fix": "npm audit fix",
    "outdated": "npm outdated"
  }
}
```

**CI/CD Integration / CI/CD統合**:
```yaml
# .github/workflows/security.yml
name: Security Audit
on:
  schedule:
    - cron: '0 0 * * 1'  # Weekly on Monday
  push:
    branches: [master]

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm audit --audit-level=high
```

#### 6.2 Lock File / ロックファイル

- Always commit `package-lock.json`
- Use `npm ci` in CI/CD (not `npm install`)
- `package-lock.json` を常にコミット
- CI/CDでは `npm ci` を使用（`npm install` ではなく）

---

### A07:2021 – Identification and Authentication Failures / 認証の失敗

**Relevance / 関連性**: N/A (no authentication currently)
**現状**: 該当なし（認証なし）

**Future Considerations / 将来の考慮事項**:
- If auth is added, use established providers (Auth0, Clerk, etc.)
- Never implement custom password storage
- 認証追加時は確立されたプロバイダを使用
- カスタムパスワード保存は実装しない

---

### A08:2021 – Software and Data Integrity Failures / ソフトウェアとデータの整合性の失敗

**Relevance / 関連性**: Medium
**現状**: 中

#### 8.1 Subresource Integrity (SRI) / サブリソース整合性

For any external CDN resources (if used):
```html
<script
  src="https://cdn.example.com/lib.js"
  integrity="sha384-xxx..."
  crossorigin="anonymous">
</script>
```

**Note**: Vercel builds bundle all dependencies, so SRI is mainly for external resources.
注：Vercelビルドは全依存関係をバンドルするため、SRIは主に外部リソース用。

#### 8.2 LocalStorage Integrity / LocalStorage整合性

```typescript
// Optional: Add checksum for data integrity
interface StoredGraph {
  version: string;
  data: GraphData;
  checksum: string;  // SHA-256 of data
}

function saveGraph(graph: GraphData): void {
  const data = JSON.stringify(graph);
  const checksum = sha256(data);
  localStorage.setItem('neoceg-graph', JSON.stringify({
    version: '1.0',
    data: graph,
    checksum
  }));
}

function loadGraph(): GraphData | null {
  const stored = localStorage.getItem('neoceg-graph');
  if (!stored) return null;

  const parsed = JSON.parse(stored);
  const expectedChecksum = sha256(JSON.stringify(parsed.data));

  if (parsed.checksum !== expectedChecksum) {
    console.warn('Data integrity check failed');
    // Optionally: reset or warn user
  }

  return parsed.data;
}
```

---

### A09:2021 – Security Logging and Monitoring Failures / ロギングと監視の失敗

**Relevance / 関連性**: Low (client-side only)
**現状**: 低（クライアントサイドのみ）

**Recommendations / 推奨事項**:
- Use Vercel Analytics for basic monitoring
- Consider error tracking service (Sentry) for production
- Vercel Analyticsで基本的な監視
- 本番ではエラー追跡サービス（Sentry）を検討

---

### A10:2021 – Server-Side Request Forgery (SSRF)

**Relevance / 関連性**: N/A (no server-side)
**現状**: 該当なし（サーバーサイドなし）

**Future Considerations / 将来の考慮事項**:
- If GraphViz MCP integration is added, validate all URLs
- GraphViz MCP統合追加時はすべてのURLを検証

---

## 3. Implementation Checklist / 実装チェックリスト

### Phase 1: Initial Setup / 初期セットアップ

- [ ] Create `vercel.json` with security headers
- [ ] Configure `.gitignore` for sensitive files
- [ ] Set up `npm audit` in CI/CD
- [ ] Enable Dependabot or similar for dependency updates

### Phase 2: Development / 開発

- [ ] Implement DSL parser with input validation
- [ ] Use React's built-in XSS protection
- [ ] Avoid `dangerouslySetInnerHTML`
- [ ] Validate all user inputs at boundaries

### Phase 3: Pre-Production / 本番前

- [ ] Review CSP configuration
- [ ] Run security audit (`npm audit`)
- [ ] Test with browser DevTools Security panel
- [ ] Verify all security headers are set

---

## 4. File Structure / ファイル構成

```
src/
  utils/
    security/
      sanitize.ts      # Input sanitization utilities
      validate.ts      # Validation functions
      csp.ts          # CSP nonce generation (if needed)
```

---

## 5. References / 参考文献

- [OWASP Top 10 (2021)](https://owasp.org/Top10/)
- [Vercel Security Headers](https://vercel.com/docs/concepts/edge-network/headers)
- [React Security Best Practices](https://react.dev/reference/react-dom/components/common#dangerously-setting-the-inner-html)
- [Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)

---

## 6. Change History / 変更履歴

| Date / 日付 | Version | Changes / 変更内容 |
|------------|---------|-------------------|
| 2026-02-01 | 0.1 | Initial draft based on OWASP Top 10 / OWASP Top 10に基づく初版 |
